const Member = require('../../models/Member');
const Organization = require('../../models/Organization');
const Household = require('../../models/Household');
const Notice = require('../../models/Notice');
const Transaction = require('../../models/Transaction');
const CommitteeMember = require('../../models/CommitteeMember');
const OrgConfig = require('../../models/OrgConfig');
const Event = require('../../models/Event');
const Fundraiser = require('../../models/Fundraiser');

/**
 * Fetch a highly optimized summary payload for the mobile home screen.
 */
exports.getDashboardSummary = async (req, res, next) => {
  try {
    const { uid, orgId, householdId } = req.user;

    // 1. Core Data
    const orgPromise = Organization.findOne({ _id: orgId, isDeleted: false })
      .select('name primaryColor secondaryColor logoUrl type address city state pincode contactEmail contactPhone alternatePhone whatsappNumber socialLinks')
      .lean();

    const configPromise = OrgConfig.findOne({ organizationId: orgId }).select('labels').lean();
    
    const memberPromise = Member.findOne({ userId: uid, organizationId: orgId })
      .select('fullName _id memberNumber')
      .lean();

    const [org, member, config] = await Promise.all([orgPromise, memberPromise, configPromise]);

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

    const recentTransactionsPromise = Transaction.find({
      organizationId: orgId,
      type: 'income',
      status: 'completed',
      'audit.isDeleted': false,
      $or: [
        { memberId: member._id },
        { householdId: householdId }
      ]
    })
    .sort({ date: -1 })
    .limit(5)
    .select('amount categorySnapshot description date status')
    .lean();

    // 3. Urgent Items (Carousel)
    const upcomingEventsPromise = Event.find({
      organizationId: orgId,
      status: { $in: ['upcoming', 'ongoing'] },
      isDeleted: false,
      startDate: { $gte: new Date() }
    })
    .sort({ startDate: 1 })
    .limit(3)
    .lean();

    const activeFundraisersPromise = Fundraiser.find({
      organizationId: orgId,
      status: 'active',
      isDeleted: false
    })
    .sort({ createdAt: -1 })
    .limit(2)
    .lean();

    const pendingPaymentsPromise = Transaction.find({
      organizationId: orgId,
      status: { $in: ['unpaid', 'partially_paid', 'pending'] },
      'audit.isDeleted': false,
      $or: [
        { memberId: member._id },
        { householdId: householdId }
      ],
      dueDate: { $ne: null }
    })
    .sort({ dueDate: 1 })
    .limit(3)
    .lean();

    const [noticeCount, pendingFeeCount, recentTransactions, upcomingEvents, activeFundraisers, pendingPayments] = await Promise.all([
      noticeCountPromise,
      pendingFeeCountPromise,
      recentTransactionsPromise,
      upcomingEventsPromise,
      activeFundraisersPromise,
      pendingPaymentsPromise
    ]);

    // 4. Fetch Household for Group ID (if tracking type is not Individual)
    let displayId = member.memberNumber;
    const trackingType = org?.type || 'INDIVIDUAL';
    
    if (trackingType !== 'INDIVIDUAL' && householdId) {
      const household = await Household.findOne({ _id: householdId }).select('houseNumber').lean();
      if (household?.houseNumber) {
        displayId = household.houseNumber;
      }
    }

    // 5. Normalize for Carousel
    const urgentItems = [];

    // Add Events
    upcomingEvents.forEach(e => {
      urgentItems.push({
        id: e._id,
        type: 'event',
        title: e.name,
        highlight: e.startDate ? `Starts ${new Date(e.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : 'Upcoming',
        actionLabel: 'Details'
      });
    });

    // Add Fundraisers
    activeFundraisers.forEach(f => {
      urgentItems.push({
        id: f._id,
        type: 'fundraiser',
        title: f.name,
        highlight: `Goal: ${f.currency} ${f.goalAmount}`,
        actionLabel: 'Donate'
      });
    });

    // Add Payments
    pendingPayments.forEach(p => {
      urgentItems.push({
        id: p._id,
        type: 'payment',
        title: p.categorySnapshot || 'Pending Payment',
        highlight: `Due: ${new Date(p.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`,
        actionLabel: 'Pay Now'
      });
    });

    // 6. Final Sort: payments first, then events, then fundraisers
    urgentItems.sort((a, b) => {
      const priority = { payment: 1, event: 2, fundraiser: 3 };
      return priority[a.type] - priority[b.type];
    });

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
        displayId: displayId,
        trackingType: trackingType,
        notificationsCount: noticeCount,
        pendingFees: pendingFeeCount,
        recentActivity: recentTransactions,
        urgentItems: urgentItems,
        orgInfo: {
          address: `${org?.address}${org?.city ? `, ${org.city}` : ''}${org?.state ? `, ${org.state}` : ''}${org?.pincode ? ` - ${org.pincode}` : ''}`,
          email: org?.contactEmail,
          phone: org?.contactPhone,
          alternatePhone: org?.alternatePhone,
          whatsapp: org?.whatsappNumber,
          socialLinks: org?.socialLinks || {}
        },
        labels: {
          group: config?.labels?.groupLabel || 'Group',
          member: config?.labels?.memberLabel || 'Member'
        }
      }
    });
  } catch (error) {
    next(error);
  }
};
