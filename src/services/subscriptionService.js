const FeePlan = require('../models/FeePlan');
const Subscription = require('../models/Subscription');
const Transaction = require('../models/Transaction');
const CapacityCategory = require('../models/CapacityCategory');
const { generateBillingPeriod } = require('../utils/billing');

/**
 * Service to handle applying "applyToAll" fee plans to new users 
 * or existing users when a new plan is created.
 */

// Helper to determine the effective amount based on capacity overrides (V2 Tiered Logic)
async function getEffectiveAmount(plan, targetId, targetType, cachedTarget = null, pricingStash = null) {
    if (!plan.linkedCapacityCategoryId) {
        return plan.amount;
    }

    try {
        let target = cachedTarget;
        if (!target) {
            const Model = targetType === 'MEMBER' 
                ? require('../models/Member') 
                : require('../models/Household');
            target = await Model.findById(targetId).select('capacityOverrides');
        }

        if (target && target.capacityOverrides && target.capacityOverrides.length > 0) {
            const override = target.capacityOverrides.find(
                o => o.categoryId.toString() === plan.linkedCapacityCategoryId.toString()
            );
            
            if (override) {
                // Priority 1: Custom individual amount
                if (override.customAmount > 0) {
                    return override.customAmount;
                }

                // Priority 2: Tier lookup (Standardized pricing)
                if (override.tierId) {
                    let category = null;
                    
                    // Check if we have a pre-loaded stash (for high volume)
                    if (pricingStash && pricingStash.has(plan.linkedCapacityCategoryId.toString())) {
                        category = pricingStash.get(plan.linkedCapacityCategoryId.toString());
                    } else {
                        // Fallback to one-off lookup
                        category = await CapacityCategory.findById(plan.linkedCapacityCategoryId);
                    }

                    if (category && category.tiers) {
                        const tier = category.tiers.id(override.tierId);
                        if (tier) return tier.amount;
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error calculating effective amount:', error);
    }

    return plan.amount;
}

// Helper to generate an invoice transaction
async function generateInvoice(subscription, plan, userId, periodDate = null, cachedTarget = null) {
    let memberId = null;
    let householdId = null;

    if (subscription.targetType === 'MEMBER') {
        memberId = subscription.targetId;
    } else {
        householdId = subscription.targetId;
    }

    const billingDate = periodDate || new Date();
    
    // Determine the dynamic amount based on capacity overrides
    const amount = await getEffectiveAmount(plan, subscription.targetId, subscription.targetType, cachedTarget);

    return await Transaction.create({
        organizationId: subscription.organizationId,
        sourceType: 'subscription',
        sourceId: subscription._id,
        memberId,
        householdId,
        type: 'invoice',
        amount: amount,
        currency: plan.currency,
        date: new Date(),
        billingPeriod: plan.type === 'RECURRING' ? generateBillingPeriod(plan.frequency, billingDate) : null,
        description: `Invoice for ${plan.name}`,
        status: 'unpaid',
        audit: {
            createdByUserId: userId,
        }
    });
}

exports.getEffectiveAmount = getEffectiveAmount;
exports.generateInvoice = generateInvoice;

/**
 * Assign all applicable active "applyToAll" plans to a newly created target (Member or Household)
 */
exports.autoAssignPlansToNewTarget = async (organizationId, targetId, targetType, userId) => {
    try {
        // 1. Find all active applyToAll plans for this targetType in the org
        const plans = await FeePlan.find({
            organizationId,
            targetAudience: targetType,
            applyToAll: true,
            isActive: true,
            isDeleted: false
        });

        if (plans.length === 0) return;

        // 2. Assign each plan
        const startDate = new Date();
        
        for (const plan of plans) {
            let nextBillingDate = null;
            if (plan.type === 'RECURRING') {
                nextBillingDate = new Date(startDate);
                switch (plan.frequency) {
                    case 'WEEKLY': nextBillingDate.setDate(nextBillingDate.getDate() + 7); break;
                    case 'MONTHLY': nextBillingDate.setMonth(nextBillingDate.getMonth() + 1); break;
                    case 'QUARTERLY': nextBillingDate.setMonth(nextBillingDate.getMonth() + 3); break;
                    case 'YEARLY': nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1); break;
                }
            }

            const subscription = await Subscription.create({
                organizationId,
                planId: plan._id,
                targetId,
                targetType,
                startDate,
                nextBillingDate,
                createdByUserId: userId
            });

            await generateInvoice(subscription, plan, userId, startDate);
        }

        console.log(`Auto-assigned ${plans.length} plans to new ${targetType} ${targetId}`);
    } catch (error) {
        console.error('Error auto-assigning plans to new target:', error);
        // We don't throw here to avoid failing the member/household creation
    }
};

/**
 * Bulk assign a newly created "applyToAll" plan to all existing valid targets
 */
exports.bulkAssignPlanToExistingTargets = async (feePlan, userId) => {
    try {
        if (!feePlan.applyToAll) return;

        const targetModel = feePlan.targetAudience === 'MEMBER' 
            ? require('../models/Member') 
            : require('../models/Household');

        // Find all active targets in the organization
        const targets = await targetModel.find({
            organizationId: feePlan.organizationId,
            isDeleted: false,
        }).select('_id capacityOverrides');

        const startDate = new Date();
        let nextBillingDate = null;
        
        if (feePlan.type === 'RECURRING') {
            nextBillingDate = new Date(startDate);
            switch (feePlan.frequency) {
                case 'WEEKLY': nextBillingDate.setDate(nextBillingDate.getDate() + 7); break;
                case 'MONTHLY': nextBillingDate.setMonth(nextBillingDate.getMonth() + 1); break;
                case 'QUARTERLY': nextBillingDate.setMonth(nextBillingDate.getMonth() + 3); break;
                case 'YEARLY': nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1); break;
            }
        }

        let assignedCount = 0;

        // Process in small batches to avoid memory crush if they have thousands of users
        const batchSize = 50;
        for (let i = 0; i < targets.length; i += batchSize) {
            const batch = targets.slice(i, i + batchSize);
            
            for (const target of batch) {
                // Check for existing assignment just in case
                const existing = await Subscription.exists({
                    planId: feePlan._id,
                    targetId: target._id,
                    isDeleted: false
                });

                if (!existing) {
                    const sub = await Subscription.create({
                        organizationId: feePlan.organizationId,
                        planId: feePlan._id,
                        targetId: target._id,
                        targetType: feePlan.targetAudience,
                        startDate,
                        nextBillingDate,
                        createdByUserId: userId
                    });
                    
                    await generateInvoice(sub, feePlan, userId, startDate, target);
                    assignedCount++;
                }
            }
        }

        console.log(`Bulk assigned plan ${feePlan.name} to ${assignedCount} targets`);
    } catch (error) {
        console.error('Error in bulk assignment:', error);
    }
};
