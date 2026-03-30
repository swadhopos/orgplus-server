const Transaction = require('../../models/Transaction');
const Subscription = require('../../models/Subscription');

/**
 * Fetch all pending dues for the logged-in member/household.
 */
exports.getPendingDues = async (req, res, next) => {
  try {
    const { orgId, uid, householdId } = req.user;
    const Member = require('../../models/Member');
    
    const member = await Member.findOne({ userId: uid, organizationId: orgId }).select('_id').lean();
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    const query = {
      organizationId: orgId,
      status: { $in: ['unpaid', 'partially_paid', 'pending'] },
      'audit.isDeleted': false,
      $or: [
        { memberId: member._id },
        { householdId: householdId }
      ]
    };

    const dues = await Transaction.find(query)
      .sort({ dueDate: 1, date: 1 })
      .lean();

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

    const query = {
      organizationId: orgId,
      status: 'completed',
      'audit.isDeleted': false,
      $or: [
        { memberId: member._id },
        { householdId: householdId }
      ]
    };

    const history = await Transaction.find(query)
      .sort({ date: -1 })
      .limit(100)
      .lean();

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    next(error);
  }
};
