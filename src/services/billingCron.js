const cron = require('node-cron');
const Subscription = require('../models/Subscription');
const Transaction = require('../models/Transaction');
const mongoose = require('mongoose');
const CapacityCategory = require('../models/CapacityCategory');
const { generateBillingPeriod } = require('../utils/billing');
const { getEffectiveAmount } = require('./subscriptionService');

/**
 * Billing Cron Service
 * Runs daily to process recurring subscriptions that are due for billing.
 */

async function processSubscriptions() {
    console.log('--- Starting Daily Subscription Billing Process ---');
    const today = new Date();
    // Set to end of day to catch everything due today
    today.setHours(23, 59, 59, 999);

    try {
        // Find all subscriptions where nextBillingDate is today or earlier
        const dueSubscriptions = await Subscription.find({
            billingStatus: { $in: ['ACTIVE', 'PAST_DUE'] },
            nextBillingDate: { $lte: today },
            isDeleted: false
        }).populate('planId');

        if (dueSubscriptions.length === 0) {
            console.log('--- No subscriptions due for billing today. ---');
            return;
        }

        // --- PRE-FETCH STASH LOGIC ---
        // Load all CapacityCategories for the organizations involved to avoid massive redundant lookups
        const orgIds = [...new Set(dueSubscriptions.map(s => s.organizationId.toString()))];
        const allCategories = await CapacityCategory.find({ 
            organizationId: { $in: orgIds }, 
            isDeleted: false 
        });

        const pricingStash = new Map();
        allCategories.forEach(cat => {
            pricingStash.set(cat._id.toString(), cat);
        });
        // -----------------------------

        let generatedCount = 0;

        for (const subscription of dueSubscriptions) {
            const plan = subscription.planId;
            
            // Skip if plan was deleted or deactivated
            if (!plan || plan.isDeleted || !plan.isActive) continue;

            // Generate an invoice for this cycle
            let memberId = null;
            let householdId = null;
            if (subscription.targetType === 'MEMBER') {
                memberId = subscription.targetId;
            } else {
                householdId = subscription.targetId;
            }

            // Determine the dynamic amount based on capacity overrides (using Stash)
            const amount = await getEffectiveAmount(plan, subscription.targetId, subscription.targetType, null, pricingStash);

            await Transaction.create({
                organizationId: subscription.organizationId,
                sourceType: 'subscription',
                sourceId: subscription._id,
                memberId,
                householdId,
                type: 'invoice',
                amount: amount,
                currency: plan.currency,
                date: new Date(),
                billingPeriod: generateBillingPeriod(plan.frequency, subscription.nextBillingDate),
                description: `Recurring Invoice for ${plan.name}`,
                status: 'unpaid',
                audit: {
                    createdByUserId: 'SYSTEM_CRON',
                }
            });

            // Calculate the next billing date
            let nextBillingDate = new Date(subscription.nextBillingDate);
            switch (plan.frequency) {
                case 'WEEKLY':
                    nextBillingDate.setDate(nextBillingDate.getDate() + 7);
                    break;
                case 'MONTHLY':
                    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
                    break;
                case 'QUARTERLY':
                    nextBillingDate.setMonth(nextBillingDate.getMonth() + 3);
                    break;
                case 'YEARLY':
                    nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
                    break;
            }

            // If for some reason the next billing date is still in the past, push it to today + 1 cycle
            if (nextBillingDate <= new Date()) {
                 const newBaseDate = new Date();
                 switch (plan.frequency) {
                    case 'WEEKLY': newBaseDate.setDate(newBaseDate.getDate() + 7); break;
                    case 'MONTHLY': newBaseDate.setMonth(newBaseDate.getMonth() + 1); break;
                    case 'QUARTERLY': newBaseDate.setMonth(newBaseDate.getMonth() + 3); break;
                    case 'YEARLY': newBaseDate.setFullYear(newBaseDate.getFullYear() + 1); break;
                }
                nextBillingDate = newBaseDate;
            }

            // Update subscription
            subscription.nextBillingDate = nextBillingDate;
            if (subscription.billingStatus === 'ACTIVE') {
                 // Might want to change to PAST_DUE depending on business logic, but leaving active for now
                 // pending the payment of the new invoice.
            }
            await subscription.save();
            generatedCount++;
        }

        console.log(`--- Finished Daily Billing: Generated ${generatedCount} invoices ---`);
    } catch (error) {
        console.error('Error in daily billing cron:', error);
    }
}

// Export a function to initialize the cron job
exports.initBillingCron = () => {
    // Run every day at midnight server time
    cron.schedule('0 0 * * *', () => {
        processSubscriptions();
    });
    console.log('Billing cron job initialized.');
};
