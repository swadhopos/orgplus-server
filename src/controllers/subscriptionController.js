const Subscription = require('../models/Subscription');
const FeePlan = require('../models/FeePlan');
const Transaction = require('../models/Transaction');
const mongoose = require('mongoose');
const { generateBillingPeriod } = require('../utils/billing');
const { generateInvoice } = require('../services/subscriptionService');
const { ensureReceiptNumber } = require('./transactionController');

/**
 * Subscription Controller
 * Handles assigning plans and managing billing statuses.
 */

// Assign a fee plan to a target
exports.assignPlan = async (req, res) => {
    try {
        const { planId, targetId, targetType, startDate, upiAddress } = req.body;
        const organizationId = req.user.organizationId;
        const createdByUserId = req.user.id;

        // 1. Verify Plan
        const plan = await FeePlan.findOne({
            _id: planId,
            organizationId,
            isDeleted: false,
            isActive: true
        });

        if (!plan) {
            return res.status(404).json({ success: false, message: 'Active fee plan not found' });
        }

        // 2. Prevent duplicate active assignments
        const existing = await Subscription.findOne({
            planId,
            targetId,
            organizationId,
            billingStatus: { $in: ['ACTIVE', 'PAST_DUE', 'UNPAID'] },
            isDeleted: false
        });

        if (existing) {
            return res.status(400).json({ success: false, message: 'Target already has an active subscription for this plan' });
        }

        // 3. Calculate next billing date
        let nextBillingDate = null;
        const parsedStartDate = startDate ? new Date(startDate) : new Date();

        if (plan.type === 'RECURRING') {
            nextBillingDate = new Date(parsedStartDate);
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
        }

        // 4. Create Subscription
        const subscription = await Subscription.create({
            organizationId,
            planId,
            targetId,
            targetType,
            startDate: parsedStartDate,
            nextBillingDate,
            upiAddress: upiAddress || null,
            createdByUserId
        });

        // 5. Generate initial invoice for the amount due
        const transaction = await generateInvoice(subscription, plan, createdByUserId, parsedStartDate);

        res.status(201).json({ 
            success: true, 
            data: { subscription, initialInvoice: transaction } 
        });

    } catch (error) {
        console.error('Error assigning plan:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};


// Get all subscriptions for a target (member or household)
exports.getTargetSubscriptions = async (req, res) => {
    try {
        const { targetId } = req.params;
        const organizationId = req.user.organizationId;

        const subscriptions = await Subscription.find({
            targetId,
            organizationId,
            isDeleted: false
        }).populate('planId', 'name amount currency type frequency isMembership').sort({ createdAt: -1 });

        // Also fetch related invoices
        const subscriptionIds = subscriptions.map(sub => sub._id);
        const invoices = await Transaction.find({
            sourceType: 'subscription',
            sourceId: { $in: subscriptionIds },
            organizationId,
            'audit.isDeleted': false
        }).sort({ date: -1 });

        res.status(200).json({
            success: true,
            data: {
                subscriptions,
                invoices
            }
        });
    } catch (error) {
        console.error('Error fetching target subscriptions:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};
// Get all subscriptions for a specific plan with target names and latest status
exports.getPlanSubscriptions = async (req, res) => {
    try {
        const { planId } = req.params;
        const { period } = req.query;
        const organizationId = req.user.organizationId;

        // Pagination parameters
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 100;
        const skip = (page - 1) * limit;

        const results = await Subscription.aggregate([
            {
                $match: {
                    planId: new mongoose.Types.ObjectId(planId),
                    organizationId: new mongoose.Types.ObjectId(organizationId),
                    isDeleted: false
                }
            },
            {
                $facet: {
                    metadata: [{ $count: 'total' }],
                    data: [
                        { $sort: { createdAt: -1 } },
                        { $skip: skip },
                        { $limit: limit },
                        // Lookup targets (Member or Household)
                        {
                            $lookup: {
                                from: 'members',
                                localField: 'targetId',
                                foreignField: '_id',
                                as: 'memberInfo'
                            }
                        },
                        {
                            $lookup: {
                                from: 'households',
                                localField: 'targetId',
                                foreignField: '_id',
                                as: 'householdInfo'
                            }
                        },
                        // Lookup Latest Transaction
                        {
                            $lookup: {
                                from: 'transactions',
                                let: { subId: '$_id' },
                                pipeline: [
                                    {
                                        $match: {
                                            $expr: { $eq: ['$sourceId', '$$subId'] },
                                            'audit.isDeleted': false,
                                            ...(period ? { billingPeriod: period } : {})
                                        }
                                    },
                                    { $sort: { createdAt: -1 } },
                                    { $limit: 1 }
                                ],
                                as: 'latestTx'
                            }
                        },
                        // Format the data
                        {
                            $addFields: {
                                target: {
                                    $ifNull: [
                                        { $arrayElemAt: ['$memberInfo', 0] },
                                        { $arrayElemAt: ['$householdInfo', 0] }
                                    ]
                                },
                                latestTransaction: { $arrayElemAt: ['$latestTx', 0] }
                            }
                        },
                        {
                            $project: {
                                memberInfo: 0,
                                householdInfo: 0,
                                latestTx: 0
                            }
                        },
                        {
                            $addFields: {
                                targetName: {
                                    $cond: [
                                        { $eq: ['$targetType', 'MEMBER'] },
                                        '$target.fullName',
                                        '$target.houseName'
                                    ]
                                },
                                targetNumber: {
                                    $cond: [
                                        { $eq: ['$targetType', 'MEMBER'] },
                                        '$target.memberNumber',
                                        '$target.houseNumber'
                                    ]
                                }
                            }
                        },
                        { $project: { target: 0 } }
                    ]
                }
            }
        ]);

        const data = results[0].data;
        const total = results[0].metadata[0]?.total || 0;

        res.status(200).json({ 
            success: true, 
            data,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching plan subscriptions:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// Record payment for a subscription (marks the latest invoice as paid)
exports.collectPayment = async (req, res) => {
    try {
        const { subscriptionId } = req.params;
        const { paymentMethod, referenceNumber, notes, amount, period } = req.body;
        const organizationId = req.user.organizationId;
        const userId = req.user.id;

        // 0. Verify Subscription and Plan
        const subscription = await Subscription.findOne({ _id: subscriptionId, organizationId }).populate('planId');
        if (!subscription || !subscription.planId) {
            return res.status(404).json({ success: false, message: 'Subscription or associated plan not found' });
        }
        const plan = subscription.planId;

        // 1. Find the unpaid invoice for this subscription (optionally filtered by period)
        const query = {
            sourceType: 'subscription',
            sourceId: subscriptionId,
            organizationId,
            type: 'invoice',
            status: { $in: ['unpaid', 'pending'] },
            'audit.isDeleted': false
        };

        if (period) {
            query.billingPeriod = period;
        }

        const transaction = await Transaction.findOne(query).sort({ createdAt: -1 });

        if (!transaction) {
            return res.status(404).json({ success: false, message: 'No pending invoice found for this subscription' });
        }

        // 2. Update Transaction
        transaction.status = 'completed';
        
        // If the transaction was missing a billingPeriod (old bug), attach the one from the request
        // OR infer it from the transaction date and plan frequency
        if (!transaction.billingPeriod) {
            transaction.billingPeriod = period || generateBillingPeriod(plan.frequency, transaction.date || transaction.createdAt);
        }

        transaction.payment = {
            method: paymentMethod || 'cash',
            referenceNumber: referenceNumber || null,
            notes: notes || 'Manual payment collection',
            paidAt: new Date(),
            receivedByUserId: userId
        };
        
        // If they paid a partial amount, we might need more logic, 
        // but for now let's assume full payment or just update the amount if sent
        if (amount) transaction.amount = amount;

        transaction.audit.updatedByUserId = userId;
        transaction.audit.updatedAt = new Date();
        transaction.audit.history.push({ 
            action: 'payment_received', 
            byUserId: userId, 
            note: `Payment collected via ${paymentMethod || 'cash'}` 
        });

        await transaction.save();
        await ensureReceiptNumber(transaction, organizationId);

        // 3. Update Subscription if ONE_TIME
        if (subscription.planId.type === 'ONE_TIME') {
            subscription.billingStatus = 'COMPLETED';
            await subscription.save();

            // 4. Auto-Close Plan logic
            if (plan.autoCloseWhenPaid && plan.isActive) {
                // Check if there are any remaining unpaid subscriptions for this plan
                const remainingUnpaidCount = await Subscription.countDocuments({
                    planId: plan._id,
                    organizationId,
                    billingStatus: { $in: ['UNPAID', 'PAST_DUE', 'ACTIVE'] }, // Active but not completed
                    isDeleted: false
                });

                // If this was the last one, close the plan
                if (remainingUnpaidCount === 0) {
                    plan.isActive = false;
                    await plan.save();
                    console.log(`Plan ${plan.name} (${plan._id}) auto-closed as all subscriptions are paid.`);
                }
            }
        }

        res.status(200).json({ success: true, data: transaction });
    } catch (error) {
        console.error('Error collecting payment:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};
