const Member = require('../../models/Member');
const Organization = require('../../models/Organization');
const Notice = require('../../models/Notice');
const Transaction = require('../../models/Transaction');
const CommitteeMember = require('../../models/CommitteeMember');

/**
 * Fetch a highly optimized summary payload for the mobile home screen.
 */
exports.getDashboardSummary = async (req, res, next) => {
  try {
    const { uid, orgId, householdId } = req.user;

    // 1. Core Data
    const orgPromise = Organization.findOne({ _id: orgId, isDeleted: false })
      .select('name primaryColor secondaryColor logoUrl type')
      .lean();

    const memberPromise = Member.findOne({ userId: uid, organizationId: orgId, isDeleted: false })
      .select('_id fullName status')
      .lean();

    const [org, member] = await Promise.all([orgPromise, memberPromise]);

    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    // 2. Fetch counts (Notices & Dues)
    // For notices, we first need committees
    const committees = await CommitteeMember.find({ memberId: member._id, organizationId: orgId })
      .select('committeeId')
      .lean();
    const committeeIds = committees.map(c => c.committeeId);

    const noticeCountPromise = Notice.countDocuments({
      organizationId: orgId,
      status: 'published',
      isDeleted: false,
      $or: [
        { audienceType: 'all' },
        { audienceType: 'household', targetIds: householdId },
        { audienceType: 'committee', targetIds: { $in: committeeIds } }
      ]
    });

    const pendingFeeCountPromise = Transaction.countDocuments({
      organizationId: orgId,
      status: { $in: ['unpaid', 'partially_paid', 'pending'] },
      'audit.isDeleted': false,
      $or: [
        { memberId: member._id },
        { householdId: householdId }
      ]
    });

    const [noticeCount, pendingFeeCount] = await Promise.all([
      noticeCountPromise,
      pendingFeeCountPromise
    ]);

    res.json({
      success: true,
      data: {
        greeting: member.fullName,
        orgName: org ? org.name : 'Organization',
        theme: {
          primary: org?.primaryColor,
          secondary: org?.secondaryColor,
          logo: org?.logoUrl
        },
        trackingType: org?.type || 'INDIVIDUAL',
        notificationsCount: noticeCount,
        pendingFees: pendingFeeCount
      }
    });
  } catch (error) {
    next(error);
  }
};
