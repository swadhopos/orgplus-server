const Transaction = require('../../models/Transaction');
const Subscription = require('../../models/Subscription');

/**
 * Fetch all pending dues for the logged-in member/household.
 * Optimized with a single MongoDB aggregation to fetch UPI IDs and details efficiently.
 */
exports.getPendingDues = async (req, res, next) => {
  try {
    const { orgId, uid, householdId } = req.user;
    const mongoose = require('mongoose');
    const Member = require('../../models/Member');
    
    // Get member record to find memberId
    const member = await Member.findOne({ userId: uid, organizationId: orgId }).select('_id').lean();
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    const orConditions = [{ memberId: member._id }];
    if (householdId && mongoose.Types.ObjectId.isValid(householdId)) {
      orConditions.push({ householdId: new mongoose.Types.ObjectId(householdId) });
    }

    const matchConditions = {
      organizationId: new mongoose.Types.ObjectId(orgId),
      status: { $in: ['unpaid', 'partially_paid', 'pending'] },
      'audit.isDeleted': false,
      $or: orConditions
    };

    const dues = await Transaction.aggregate([
      { $match: matchConditions },
      { $sort: { dueDate: 1, date: 1 } },
      
      // 1. Join with Subscription to get the Plan
      {
        $lookup: {
          from: 'subscriptions',
          localField: 'sourceId',
          foreignField: '_id',
          as: 'subscriptionSource'
        }
      },
      { $unwind: { path: '$subscriptionSource', preserveNullAndEmptyArrays: true } },

      // 2. Join with FeePlan via Subscription
      {
        $lookup: {
          from: 'feeplans',
          localField: 'subscriptionSource.planId',
          foreignField: '_id',
          as: 'feePlanSource'
        }
      },
      { $unwind: { path: '$feePlanSource', preserveNullAndEmptyArrays: true } },

      // 3. Join with Event directly (if sourceType is event)
      {
        $lookup: {
          from: 'events',
          localField: 'sourceId',
          foreignField: '_id',
          as: 'eventSource'
        }
      },
      { $unwind: { path: '$eventSource', preserveNullAndEmptyArrays: true } },

      // 4. Consolidate upiAddress and cleaned source data
      {
        $addFields: {
          // If dueDate is null, fallback logic
          dueDate: {
            $ifNull: [
              '$dueDate',
              {
                $cond: {
                  if: { $eq: ['$feePlanSource.type', 'RECURRING'] },
                  then: {
                    $add: [
                      { $ifNull: ['$subscriptionSource.nextBillingDate', '$date'] },
                      { $multiply: [{ $ifNull: ['$feePlanSource.gracePeriodDays', 0] }, 86400000] }
                    ]
                  },
                  else: {
                    $ifNull: ['$feePlanSource.dueDate', { $ifNull: ['$subscriptionSource.nextBillingDate', '$date'] }]
                  }
                }
              }
            ]
          },
          upiAddress: {
            $cond: {
              if: { $eq: ['$sourceType', 'subscription'] },
              then: { $ifNull: ['$feePlanSource.upiAddress', null] },
              else: {
                $cond: {
                  if: { $eq: ['$sourceType', 'event'] },
                  then: { $ifNull: ['$eventSource.upiAddress', null] },
                  else: null
                }
              }
            }
          },
          // Include plan info for the detail sheet and labels
          planType: { $ifNull: ['$feePlanSource.type', '$sourceType'] },
          planName: { $ifNull: ['$feePlanSource.name', null] },
          categoryName: { $ifNull: ['$feePlanSource.categorySnapshot', null] }
        }
      },

      // 5. Cleanup response payload
      {
        $project: {
          subscriptionSource: 0,
          feePlanSource: 0,
          eventSource: 0,
          'audit.history': 0,
          'audit.isDeleted': 0
        }
      }
    ]);

    res.json({
      success: true,
      data: dues
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Fetch past successful payments.
 */
exports.getPaymentHistory = async (req, res, next) => {
  try {
    const { orgId, uid, householdId } = req.user;
    const Member = require('../../models/Member');

    const member = await Member.findOne({ userId: uid, organizationId: orgId }).select('_id').lean();
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    const mongoose = require('mongoose');
    const orConditions = [{ memberId: member._id }];
    if (householdId && mongoose.Types.ObjectId.isValid(householdId)) {
      orConditions.push({ householdId: new mongoose.Types.ObjectId(householdId) });
    }

    const query = {
      organizationId: new mongoose.Types.ObjectId(orgId),
      status: 'completed',
      'audit.isDeleted': false,
      $or: orConditions
    };

    const history = await Transaction.aggregate([
      { $match: query },
      { $sort: { date: -1 } },
      { $limit: 100 },

      // 1. Join with Subscription to get the Plan
      {
        $lookup: {
          from: 'subscriptions',
          localField: 'sourceId',
          foreignField: '_id',
          as: 'subscriptionSource'
        }
      },
      { $unwind: { path: '$subscriptionSource', preserveNullAndEmptyArrays: true } },

      // 2. Join with FeePlan via Subscription
      {
        $lookup: {
          from: 'feeplans',
          localField: 'subscriptionSource.planId',
          foreignField: '_id',
          as: 'feePlanSource'
        }
      },
      { $unwind: { path: '$feePlanSource', preserveNullAndEmptyArrays: true } },

      // 3. Join with Event directly (if sourceType is event)
      {
        $lookup: {
          from: 'events',
          localField: 'sourceId',
          foreignField: '_id',
          as: 'eventSource'
        }
      },
      { $unwind: { path: '$eventSource', preserveNullAndEmptyArrays: true } },

      // 4. Consolidate metadata
      {
        $addFields: {
          planType: { $ifNull: ['$feePlanSource.type', '$sourceType'] },
          planName: { $ifNull: ['$feePlanSource.name', null] },
          categoryName: { $ifNull: ['$feePlanSource.categorySnapshot', null] }
        }
      },

      // 5. Cleanup
      {
        $project: {
          subscriptionSource: 0,
          feePlanSource: 0,
          eventSource: 0,
          'audit.history': 0,
          'audit.isDeleted': 0
        }
      }
    ]);

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    next(error);
  }
};
