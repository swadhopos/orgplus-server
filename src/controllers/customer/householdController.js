const Member = require('../../models/Member');
const Household = require('../../models/Household');
const Organization = require('../../models/Organization');
const MarriageNOC = require('../../models/MarriageNOC');
const MarriageCertificate = require('../../models/MarriageCertificate');
const DeathRegister = require('../../models/DeathRegister');
const Transaction = require('../../models/Transaction');

/**
 * Fetch a comprehensive "Group Hub" payload for a household.
 * Includes members, total balance, and BMD lifecycle status.
 */
exports.getGroupDetails = async (req, res, next) => {
  try {
    const { orgId, householdId } = req.user;

    if (!householdId) {
      return res.status(404).json({ success: false, message: 'No household associated with this account' });
    }

    // 1. Fetch Household, Members & Organization (for labels)
    const householdPromise = Household.findOne({ _id: householdId, organizationId: orgId, isDeleted: false }).lean();
    
    const membersPromise = Member.find({ 
      currentHouseholdId: householdId, 
      organizationId: orgId, 
      isDeleted: false 
    })
    .sort({ memberSequence: 1 })
    .lean();

    const orgPromise = Organization.findById(orgId).select('config name').lean();

    const [household, members, org] = await Promise.all([householdPromise, membersPromise, orgPromise]);

    if (!household) {
      return res.status(404).json({ success: false, message: 'Household not found' });
    }

    const memberIds = members.map(m => m._id);

    // 2. Fetch BMD Records
    const nocsPromise = MarriageNOC.find({ memberId: { $in: memberIds }, status: { $ne: 'revoked' } }).select('memberId status issueDate').lean();
    const certsPromise = MarriageCertificate.find({ memberId: { $in: memberIds } }).select('memberId marriageDate certificateNumber').lean();
    const deathsPromise = DeathRegister.find({ memberId: { $in: memberIds } }).select('memberId dateOfDeath status').lean();

    // 3. Fetch Combined Balance
    const balancePromise = Transaction.aggregate([
      { 
        $match: { 
          organizationId: orgId,
          status: { $in: ['unpaid', 'partially_paid', 'pending'] },
          'audit.isDeleted': false,
          $or: [
            { householdId: household._id },
            { memberId: { $in: memberIds } }
          ]
        } 
      },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const [nocs, certs, deaths, balanceResult] = await Promise.all([
      nocsPromise,
      certsPromise,
      deathsPromise,
      balancePromise
    ]);

    // 4. Normalize & Enrich Members
    const enrichedMembers = members.map(m => {
      return {
        ...m,
        isHead: household.headMemberId?.toString() === m._id.toString(),
        bmd: {
            noc: nocs.find(n => n.memberId.toString() === m._id.toString()),
            certificate: certs.find(c => c.memberId.toString() === m._id.toString()),
            deathRecord: deaths.find(d => d.memberId.toString() === m._id.toString())
        }
      };
    });

    res.json({
      success: true,
      data: {
        household,
        members: enrichedMembers,
        totalBalance: balanceResult[0]?.total || 0,
        orgLabels: {
           groupLabel: org?.config?.labels?.groupLabel || 'Household',
           memberLabel: org?.config?.labels?.memberLabel || 'Member'
        },
        actions: [
            { id: 'add-member', label: 'Add Member', icon: 'UserPlus' },
            { id: 'edit-house', label: 'Edit Data', icon: 'Settings' },
            { id: 'history', label: 'History', icon: 'History' }
        ]
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update household details (Name, Address, Financial Status)
 */
exports.updateHousehold = async (req, res, next) => {
  try {
    const { orgId, householdId } = req.user;
    const { 
      houseName, 
      addressLine1, 
      addressLine2, 
      postalCode, 
      primaryMobile,
      financialStatus 
    } = req.body;

    if (!householdId) {
      return res.status(403).json({ success: false, message: 'No household associated with this account' });
    }

    const update = {};
    if (houseName) update.houseName = houseName;
    if (addressLine1) update.addressLine1 = addressLine1;
    if (addressLine2) update.addressLine2 = addressLine2;
    if (postalCode) update.postalCode = postalCode;
    if (primaryMobile) update.primaryMobile = primaryMobile;
    if (financialStatus) update.financialStatus = financialStatus;

    const household = await Household.findOneAndUpdate(
      { _id: householdId, organizationId: orgId, isDeleted: false },
      { $set: update },
      { new: true, runValidators: true }
    ).lean();

    if (!household) {
      return res.status(404).json({ success: false, message: 'Household not found' });
    }

    res.json({
      success: true,
      data: household
    });
  } catch (error) {
    next(error);
  }
};
