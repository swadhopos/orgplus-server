const Notice = require('../../models/Notice');
const Member = require('../../models/Member');
const CommitteeMember = require('../../models/CommitteeMember');

/**
 * Fetch all notices applicable to the logged-in member.
 */
exports.getNotices = async (req, res, next) => {
  try {
    const { uid, orgId, householdId } = req.user;

    // 1. Get member's committees
    const member = await Member.findOne({ userId: uid, organizationId: orgId }).select('_id').lean();
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member profile not found' });
    }

    const committees = await CommitteeMember.find({ memberId: member._id, organizationId: orgId })
      .select('committeeId')
      .lean();
    const committeeIds = committees.map(c => c.committeeId);

    const { history } = req.query;
    
    // 2. Query notices based on audience targeting
    const query = {
      organizationId: orgId,
      status: history === 'true' ? 'archived' : 'published',
      isDeleted: false,
      $or: [
        { audienceType: 'all' },
        { audienceType: 'household', targetIds: householdId },
        { audienceType: 'committee', targetIds: { $in: committeeIds } }
      ]
    };

    const notices = await Notice.find(query)
      .sort({ publishedAt: -1, createdAt: -1 })
      .limit(50)
      .lean();

    res.json({
      success: true,
      data: notices
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Fetch a single notice detail.
 */
exports.getNoticeById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { orgId } = req.user;

    const notice = await Notice.findOne({
      _id: id,
      organizationId: orgId,
      status: 'published',
      isDeleted: false
    }).lean();

    if (!notice) {
      return res.status(404).json({ success: false, message: 'Notice not found' });
    }

    res.json({
      success: true,
      data: notice
    });
  } catch (error) {
    next(error);
  }
};
