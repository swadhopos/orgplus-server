const Member = require('../../models/Member');
const Household = require('../../models/Household');

/**
 * Fetch the logged-in member's full profile.
 */
exports.getProfile = async (req, res, next) => {
  try {
    const { uid, orgId } = req.user;

    const member = await Member.findOne({ 
      userId: uid, 
      organizationId: orgId,
      isDeleted: false 
    })
    .populate('currentHouseholdId', 'houseName houseNumber addressLine1 primaryMobile')
    .lean();

    if (!member) {
      return res.status(404).json({ success: false, message: 'Member profile not found' });
    }

    res.json({
      success: true,
      data: member
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Fetch all members in the same household.
 */
exports.getHouseholdMembers = async (req, res, next) => {
  try {
    const { orgId, householdId } = req.user;

    if (!householdId) {
      return res.json({ success: true, data: [] });
    }

    const members = await Member.find({
      organizationId: orgId,
      currentHouseholdId: householdId,
      isDeleted: false
    })
    .sort({ memberSequence: 1 })
    .lean();

    res.json({
      success: true,
      data: members
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update basic profile information.
 */
exports.updateProfile = async (req, res, next) => {
  try {
    const { uid, orgId } = req.user;
    const { mobileNumber, email, bloodGroup } = req.body;

    const update = {};
    if (mobileNumber) update.mobileNumber = mobileNumber;
    if (email) update.email = email.toLowerCase();
    if (bloodGroup) update['medicalInfo.bloodGroup'] = bloodGroup;

    const member = await Member.findOneAndUpdate(
      { userId: uid, organizationId: orgId, isDeleted: false },
      { $set: update },
      { new: true, runValidators: true }
    ).lean();

    if (!member) {
      return res.status(404).json({ success: false, message: 'Member profile not found' });
    }

    res.json({
      success: true,
      data: member
    });
  } catch (error) {
    next(error);
  }
};
