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
    const { uid, orgId, householdId } = req.user;

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

    const currentMember = await Member.findOne({ userId: uid, organizationId: orgId }).select('_id');

    res.json({
      success: true,
      data: members,
      currentMemberId: currentMember?._id
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

/**
 * Create a new member within the user's household.
 */
exports.createMember = async (req, res, next) => {
  try {
    const { orgId, householdId } = req.user;
    const {
      fullName,
      gender,
      dateOfBirth,
      maritalStatus,
      mobileNumber,
      email,
      occupation,
      fatherId,
      motherId,
      spouseId,
      fatherNameTemp,
      motherNameTemp,
      spouseNameTemp,
      medicalInfo,
      isWorkingAbroad,
      abroadCountry
    } = req.body;

    // 1. Basic validation
    if (!fullName || !gender || !maritalStatus) {
      return res.status(400).json({ 
        success: false, 
        message: 'fullName, gender, and maritalStatus are required.' 
      });
    }

    if (!householdId) {
      return res.status(403).json({ 
        success: false, 
        message: 'You must belong to a household to add members.' 
      });
    }

    // 2. Fetch Household & Increment Counter
    const updatedHousehold = await Household.findOneAndUpdate(
      { _id: householdId, organizationId: orgId, isDeleted: false },
      { $inc: { memberCounter: 1 } },
      { new: true }
    );

    if (!updatedHousehold) {
      return res.status(404).json({ success: false, message: 'Household not found' });
    }

    const nextSequence = updatedHousehold.memberCounter;
    // Format: HOUSE_NUMBER-SEQUENCE
    const memberNumber = `${updatedHousehold.houseNumber}-${nextSequence}`;

    // 3. Create Member
    const member = new Member({
      organizationId: orgId,
      currentHouseholdId: householdId,
      memberSequence: nextSequence,
      memberNumber,
      fullName,
      gender,
      dateOfBirth,
      maritalStatus,
      mobileNumber,
      email,
      occupation,
      fatherId: fatherId || undefined,
      motherId: motherId || undefined,
      spouseId: spouseId || undefined,
      fatherNameTemp,
      motherNameTemp,
      spouseNameTemp,
      medicalInfo,
      isWorkingAbroad,
      abroadCountry,
      status: 'active',
      verificationStatus: 'pending',
      createdByUserId: req.user.uid
    });

    await member.save();

    // 4. Two-way spouse link (optional but good practice)
    if (spouseId) {
      await Member.updateOne(
        { _id: spouseId, organizationId: orgId },
        { spouseId: member._id }
      );
    }

    res.status(201).json({
      success: true,
      data: member
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update an existing member within the user's household.
 */
exports.updateMember = async (req, res, next) => {
  try {
    const { orgId, householdId } = req.user;
    const { id } = req.params;
    const updateData = req.body;

    if (!householdId) {
      return res.status(403).json({ success: false, message: 'You must belong to a household to edit members.' });
    }

    // 1. Verify membership and household isolation
    const targetMember = await Member.findOne({
      _id: id,
      organizationId: orgId,
      currentHouseholdId: householdId,
      isDeleted: false
    });

    if (!targetMember) {
      return res.status(404).json({ success: false, message: 'Member not found in your household.' });
    }

    // 2. Define safe fields for update (skip identifiers & verification)
    const safeFields = [
      'fullName', 'gender', 'dateOfBirth', 'maritalStatus', 
      'mobileNumber', 'email', 'occupation', 'isWorkingAbroad', 
      'abroadCountry', 'medicalInfo', 'fatherId', 'motherId', 
      'spouseId', 'fatherNameTemp', 'motherNameTemp', 'spouseNameTemp'
    ];

    const finalUpdate = {};
    safeFields.forEach(field => {
      if (updateData[field] !== undefined) {
        finalUpdate[field] = updateData[field];
      }
    });

    // 3. Perform update
    const updatedMember = await Member.findByIdAndUpdate(
      id,
      { $set: finalUpdate },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      data: updatedMember
    });
  } catch (error) {
    next(error);
  }
};
