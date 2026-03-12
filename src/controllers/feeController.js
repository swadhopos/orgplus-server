const FeePlan = require('../models/FeePlan');
const mongoose = require('mongoose');
const { bulkAssignPlanToExistingTargets } = require('../services/subscriptionService');

/**
 * FeePlan Controller
 * Handles creating, reading, updating, and deleting fee plans.
 */

// Get all fee plans for an organization
exports.getFeePlans = async (req, res) => {
    try {
        const query = { 
            organizationId: req.user.organizationId,
            isDeleted: false
        };
        
        // Optional filtering
        if (req.query.type) query.type = req.query.type;
        if (req.query.targetAudience) query.targetAudience = req.query.targetAudience;
        if (req.query.isActive !== undefined) query.isActive = req.query.isActive === 'true';

        const feePlans = await FeePlan.find(query).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: feePlans.length,
            data: feePlans
        });
    } catch (error) {
        console.error('Error fetching fee plans:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// Get single fee plan
exports.getFeePlan = async (req, res) => {
    try {
        const feePlan = await FeePlan.findOne({
            _id: req.params.id,
            organizationId: req.user.organizationId,
            isDeleted: false
        });

        if (!feePlan) {
            return res.status(404).json({ success: false, message: 'Fee plan not found' });
        }

        res.status(200).json({ success: true, data: feePlan });
    } catch (error) {
        console.error('Error fetching fee plan:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// Create a new fee plan
exports.createFeePlan = async (req, res) => {
    try {
        // Add required audit fields from auth user
        req.body.organizationId = req.user.organizationId;
        req.body.createdByUserId = req.user.id;
        
        // Handle validation for recurring vs one-time
        if (req.body.type === 'ONE_TIME') {
            req.body.frequency = null;
        } else if (req.body.type === 'RECURRING' && !req.body.frequency) {
            return res.status(400).json({ success: false, message: 'Frequency is required for recurring plans' });
        }

        const feePlan = await FeePlan.create(req.body);

        if (feePlan.applyToAll) {
            // Run this asynchronously so we don't block the API response
            bulkAssignPlanToExistingTargets(feePlan, req.user.id).catch(err => 
                console.error('Failed to trigger bulk assignment:', err)
            );
        }

        res.status(201).json({ success: true, data: feePlan });
    } catch (error) {
        console.error('Error creating fee plan:', error);
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ success: false, message: messages.join(', ') });
        }
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// Update an existing fee plan
exports.updateFeePlan = async (req, res) => {
    try {
        let feePlan = await FeePlan.findOne({
            _id: req.params.id,
            organizationId: req.user.organizationId,
            isDeleted: false
        });

        if (!feePlan) {
            return res.status(404).json({ success: false, message: 'Fee plan not found' });
        }

        // Prevent updating organizationId or createdBy
        delete req.body.organizationId;
        delete req.body.createdByUserId;

        if (req.body.type === 'ONE_TIME') {
            req.body.frequency = null;
        }

        // Apply changes
        Object.assign(feePlan, req.body);
        await feePlan.save();
        
        // Note: Changing applyToAll from false to true after creation may require additional logic to retroactively assign users

        res.status(200).json({ success: true, data: feePlan });
    } catch (error) {
        console.error('Error updating fee plan:', error);
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ success: false, message: messages.join(', ') });
        }
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// Delete (soft delete) a fee plan
exports.deleteFeePlan = async (req, res) => {
    try {
        const feePlan = await FeePlan.findOne({
            _id: req.params.id,
            organizationId: req.user.organizationId,
            isDeleted: false
        });

        if (!feePlan) {
            return res.status(404).json({ success: false, message: 'Fee plan not found' });
        }

        feePlan.isDeleted = true;
        feePlan.deletedAt = new Date();
        feePlan.isActive = false;
        await feePlan.save();

        // Optional: Do we cancel all active subscriptions tied to this plan? 
        // For now, let's keep it simple and just soft-delete the template. 

        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        console.error('Error deleting fee plan:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};
// Get analytics for a single fee plan
exports.getFeePlanStats = async (req, res) => {
    try {
        const { id } = req.params;
        const organizationId = req.user.organizationId;

        // Efficient Single-Trip aggregation starting from Subscription
        const results = await require('../models/Subscription').aggregate([
            // 1. Match the plan's subscriptions
            {
                $match: {
                    planId: new mongoose.Types.ObjectId(id),
                    organizationId: new mongoose.Types.ObjectId(organizationId),
                    isDeleted: false
                }
            },
            // 2. Join non-deleted transactions
            {
                $lookup: {
                    from: 'transactions',
                    let: { subId: '$_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ['$sourceId', '$$subId'] },
                                'audit.isDeleted': { $ne: true }
                            }
                        }
                    ],
                    as: 'transactions'
                }
            },
            // 3. Unwind to process each transaction (keep subscriptions even without transactions)
            { 
                $unwind: { 
                    path: '$transactions', 
                    preserveNullAndEmptyArrays: true 
                } 
            },
            // 4. Facet for total results across three categories
            {
                $facet: {
                    assignmentCount: [
                        { $group: { _id: '$_id' } }, // Deduplicate after unwind
                        { $count: 'total' }
                    ],
                    overall: [
                        // Filter out soft-deleted transactions during group
                        { $match: { 'transactions.audit.isDeleted': { $ne: true } } },
                        {
                            $group: {
                                _id: '$transactions.status',
                                count: { $sum: 1 },
                                totalAmount: { $sum: '$transactions.amount' }
                            }
                        }
                    ],
                    periodBreakdown: [
                        { $match: { 'transactions.audit.isDeleted': { $ne: true } } },
                        {
                            $group: {
                                _id: '$transactions.billingPeriod',
                                paidCount: { $sum: { $cond: [{ $eq: ['$transactions.status', 'completed'] }, 1, 0] } },
                                unpaidCount: { $sum: { $cond: [{ $in: ['$transactions.status', ['unpaid', 'pending', 'invoice']] }, 1, 0] } },
                                totalCollected: { $sum: { $cond: [{ $eq: ['$transactions.status', 'completed'] }, '$transactions.amount', 0] } },
                                totalPending: { $sum: { $cond: [{ $in: ['$transactions.status', ['unpaid', 'pending', 'invoice']] }, '$transactions.amount', 0] } }
                            }
                        },
                        { $sort: { _id: -1 } }
                    ]
                }
            }
        ]);

        const txStats = results[0] || { assignmentCount: [], overall: [], periodBreakdown: [] };
        const totalAssignments = txStats.assignmentCount[0]?.total || 0;

        let totalCollected = 0;
        let totalPending = 0;
        let paidCount = 0;
        let unpaidCount = 0;

        txStats.overall.forEach(s => {
            if (s._id === 'completed') {
                totalCollected = s.totalAmount;
                paidCount = s.count;
            } else if (['unpaid', 'pending', 'invoice'].includes(s._id)) {
                totalPending += s.totalAmount;
                unpaidCount += s.count;
            }
        });

        res.status(200).json({
            success: true,
            data: {
                totalAssignments,
                totalCollected,
                totalPending,
                paidCount,
                unpaidCount,
                periodBreakdown: txStats.periodBreakdown.filter(p => p._id !== null).map(p => ({
                    period: p._id,
                    paidCount: p.paidCount,
                    unpaidCount: p.unpaidCount,
                    totalCollected: p.totalCollected,
                    totalPending: p.totalPending
                }))
            }
        });
    } catch (error) {
        console.error('Error fetching fee plan stats:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};
