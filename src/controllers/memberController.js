const mongoose = require('mongoose');
const Member = require('../models/Member');
const Household = require('../models/Household');
const Organization = require('../models/Organization');
const Counter = require('../models/Counter');
const { NotFoundError, ValidationError } = require('../utils/errors');
const logger = require('../utils/logger');
const { autoAssignPlansToNewTarget } = require('../services/subscriptionService');

/**
 * Create a new member with relationship validation
 */
exports.createMember = async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const {
      fullName,
      gender,
      dateOfBirth,
      currentHouseholdId,
      maritalStatus,
      mobileNumber,
      email,
      occupation,
      fatherId,
      motherId,
      spouseId,
      status,
      medicalInfo,
      isWorkingAbroad,
      abroadCountry,
      isDeceased,
      deathDate,
      deathCause
    } = req.body;

    // Validate required fields
    if (!fullName || !gender || !maritalStatus) {
      throw new ValidationError('Missing required fields: fullName, gender, maritalStatus');
    }

    let household = null;
    let organization = null;

    if (currentHouseholdId && mongoose.Types.ObjectId.isValid(currentHouseholdId)) {
      // Verify household exists in same organization
      household = await Household.findOne({
        _id: currentHouseholdId,
        organizationId: orgId,
        isDeleted: false
      });

      if (!household) {
        throw new NotFoundError('Household not found');
      }
    } else {
      // Verify organization exists (if no household)
      organization = await Organization.findOne({
        _id: orgId,
        isDeleted: false
      });

      if (!organization) {
        throw new NotFoundError('Organization not found');
      }
    }

    // Verify relationship references exist in same organization
    if (fatherId) {
      const father = await Member.findOne({
        _id: fatherId,
        organizationId: orgId,
        isDeleted: false
      });
      if (!father) {
        throw new NotFoundError('Father not found');
      }
    }

    if (motherId) {
      const mother = await Member.findOne({
        _id: motherId,
        organizationId: orgId,
        isDeleted: false
      });
      if (!mother) {
        throw new NotFoundError('Mother not found');
      }
    }

    if (spouseId) {
      const spouse = await Member.findOne({
        _id: spouseId,
        organizationId: orgId,
        isDeleted: false
      });
      if (!spouse) {
        throw new NotFoundError('Spouse not found');
      }
    }

    let memberNumber = '';
    let nextSequence = 0;

    if (currentHouseholdId && mongoose.Types.ObjectId.isValid(currentHouseholdId)) {
      // Atomically increment member counter for this household
      const updatedHousehold = await Household.findOneAndUpdate(
        { _id: currentHouseholdId, organizationId: orgId },
        { $inc: { memberCounter: 1 } },
        { new: true }
      );

      if (!updatedHousehold) throw new NotFoundError('Household not found for member counter increment');

      nextSequence = updatedHousehold.memberCounter;
      memberNumber = `${updatedHousehold.houseNumber}-${nextSequence}`;
    } else {
      // Atomically increment independent member counter for this organization
      const updatedOrg = await Organization.findOneAndUpdate(
        { _id: orgId },
        { $inc: { independentMemberCounter: 1 } },
        { new: true }
      );

      if (!updatedOrg) throw new NotFoundError('Organization not found for independent member counter increment');

      nextSequence = updatedOrg.independentMemberCounter;
      memberNumber = `${updatedOrg.orgNumber}-0-${nextSequence}`;
    }

    // Create member
    const member = new Member({
      memberSequence: nextSequence,
      memberNumber,
      fullName,
      gender,
      dateOfBirth,
      currentHouseholdId: (currentHouseholdId && mongoose.Types.ObjectId.isValid(currentHouseholdId)) ? currentHouseholdId : undefined,
      maritalStatus,
      mobileNumber,
      email,
      occupation,
      fatherId,
      motherId,
      spouseId,
      status: status || 'active',
      medicalInfo,
      isWorkingAbroad,
      abroadCountry,
      isDeceased,
      deathDate,
      deathCause,
      verificationStatus: 'verified',
      organizationId: orgId,
      createdByUserId: req.user.uid
    });

    await member.save();
    
    // Two-way spouse link
    if (spouseId) {
      await Member.updateOne(
        { _id: spouseId },
        { spouseId: member._id }
      );
    }

    // Trigger auto-assignment for Member
    autoAssignPlansToNewTarget(orgId, member._id, 'MEMBER', req.user.uid).catch(err => 
        console.error('Failed auto-assigning plans to new member:', err)
    );

    logger.info('Member created', {
      memberId: member._id,
      organizationId: orgId,
      currentHouseholdId,
      createdBy: req.user.uid
    });

    res.status(201).json({
      success: true,
      data: member
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List members (with tenant filtering)
 */
exports.listMembers = async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const { page = 1, limit = 10, currentHouseholdId: queryHHId, householdId, search } = req.query;
    const currentHouseholdId = queryHHId || householdId;
    const skip = (page - 1) * limit;

    // Apply tenant filter
    const filter = { 
      organizationId: new mongoose.Types.ObjectId(orgId), 
      isDeleted: false, 
      ...req.tenantFilter 
    };

    logger.info('LIST_MEMBERS_FILTER_DEBUG', {
      requestId: req.id,
      orgId,
      filter,
      tenantFilter: req.tenantFilter,
      user: {
        id: req.user?.id,
        role: req.user?.role,
        orgId: req.user?.orgId
      }
    });

    // Convert tenant filter householdId mapping if it exists
    if (filter.householdId) {
      filter.currentHouseholdId = new mongoose.Types.ObjectId(filter.householdId);
      delete filter.householdId;
    }

    // Optional household filter
    if (currentHouseholdId) {
      filter.currentHouseholdId = new mongoose.Types.ObjectId(currentHouseholdId);
    }

    // Cast IDs in tenant filter if they exist as strings
    if (filter.organizationId && typeof filter.organizationId === 'string') {
      filter.organizationId = new mongoose.Types.ObjectId(filter.organizationId);
    }

    if (filter._id && typeof filter._id === 'string') {
      filter._id = new mongoose.Types.ObjectId(filter._id);
    }

    // Search filter — matches fullName or memberNumber
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { memberNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const members = await Member.find(filter)
      .populate('currentHouseholdId', 'houseName houseNumber')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Member.countDocuments(filter);

    res.json({
      success: true,
      data: members,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get member by ID
 */
exports.getMember = async (req, res, next) => {
  try {
    const { orgId, id } = req.params;

    // Apply tenant filter
    const filter = { _id: id, organizationId: orgId, isDeleted: false, ...req.tenantFilter };

    const member = await Member.findOne(filter)
      .populate('currentHouseholdId', 'houseName houseNumber')
      .populate('fatherId', 'fullName')
      .populate('motherId', 'fullName')
      .populate('spouseId', 'fullName')
      .lean();

    if (!member) {
      throw new NotFoundError('Member not found');
    }

    // Check if member is a household head
    const headedHousehold = await Household.findOne({ headMemberId: id, isDeleted: false });
    member.isHouseholdHead = !!headedHousehold;

    res.json({
      success: true,
      data: member
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get member relationships (traverse relationship graph)
 */
exports.getMemberRelationships = async (req, res, next) => {
  try {
    const { orgId, id } = req.params;

    // Apply tenant filter
    const filter = { _id: id, organizationId: orgId, isDeleted: false, ...req.tenantFilter };

    const member = await Member.findOne(filter)
      .populate('fatherId', 'fullName dateOfBirth gender')
      .populate('motherId', 'fullName dateOfBirth gender')
      .populate('spouseId', 'fullName dateOfBirth gender');

    if (!member) {
      throw new NotFoundError('Member not found');
    }

    // Find children (where this member is father or mother)
    const children = await Member.find({
      $or: [
        { fatherId: id },
        { motherId: id }
      ],
      organizationId: orgId,
      isDeleted: false
    }).select('fullName dateOfBirth gender');

    // Find siblings (same father or mother, excluding self)
    const siblings = await Member.find({
      $or: [
        { fatherId: member.fatherId, _id: { $ne: id } },
        { motherId: member.motherId, _id: { $ne: id } }
      ],
      organizationId: orgId,
      isDeleted: false
    }).select('fullName dateOfBirth gender');

    res.json({
      success: true,
      data: {
        member: {
          _id: member._id,
          fullName: member.fullName,
          dateOfBirth: member.dateOfBirth,
          gender: member.gender
        },
        father: member.fatherId,
        mother: member.motherId,
        spouse: member.spouseId,
        children,
        siblings
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update member
 */
exports.updateMember = async (req, res, next) => {
  try {
    const { orgId, id } = req.params;
    const {
      fullName,
      gender,
      dateOfBirth,
      currentHouseholdId,
      maritalStatus,
      mobileNumber,
      email,
      occupation,
      fatherId,
      motherId,
      spouseId,
      status,
      medicalInfo,
      isWorkingAbroad,
      abroadCountry,
      isDeceased,
      deathDate,
      deathCause
    } = req.body;

    // Apply tenant filter
    const filter = { _id: id, organizationId: orgId, isDeleted: false, ...req.tenantFilter };

    const member = await Member.findOne(filter);

    if (!member) {
      throw new NotFoundError('Member not found');
    }

    const oldSpouseId = member.spouseId;
    const newSpouseId = spouseId;

    // Update fields
    if (fullName) member.fullName = fullName;
    if (gender) member.gender = gender;
    if (dateOfBirth) member.dateOfBirth = dateOfBirth;
    if (currentHouseholdId && mongoose.Types.ObjectId.isValid(currentHouseholdId)) member.currentHouseholdId = currentHouseholdId;
    else if (currentHouseholdId === '' || currentHouseholdId === null) member.currentHouseholdId = undefined;
    if (maritalStatus) member.maritalStatus = maritalStatus;
    if (mobileNumber !== undefined) member.mobileNumber = mobileNumber;
    if (email !== undefined) member.email = email;
    if (occupation !== undefined) member.occupation = occupation;
    if (status) member.status = status;
    if (fatherId !== undefined) member.fatherId = fatherId;
    if (motherId !== undefined) member.motherId = motherId;
    if (newSpouseId !== undefined) member.spouseId = newSpouseId;
    if (medicalInfo !== undefined) member.medicalInfo = medicalInfo;
    if (isWorkingAbroad !== undefined) member.isWorkingAbroad = isWorkingAbroad;
    if (abroadCountry !== undefined) member.abroadCountry = abroadCountry;
    if (isDeceased !== undefined) member.isDeceased = isDeceased;
    if (deathDate !== undefined) member.deathDate = deathDate;
    if (deathCause !== undefined) member.deathCause = deathCause;
    if (req.body.capacityOverrides !== undefined) member.capacityOverrides = req.body.capacityOverrides;

    await member.save();

    // Two-way spouse link handling
    if (newSpouseId !== undefined && oldSpouseId?.toString() !== newSpouseId?.toString()) {
      // Clear old spouse's link if it points to this member
      if (oldSpouseId) {
        await Member.updateOne(
          { _id: oldSpouseId, spouseId: id },
          { spouseId: null }
        );
      }
      // Set new spouse's link to point to this member
      if (newSpouseId) {
        await Member.updateOne(
          { _id: newSpouseId },
          { spouseId: id }
        );
      }
    }

    logger.info('Member updated', {
      memberId: member._id,
      organizationId: orgId,
      updatedBy: req.user.uid
    });

    res.json({
      success: true,
      data: member
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Soft delete member
 */
exports.deleteMember = async (req, res, next) => {
  try {
    const { orgId, id } = req.params;

    // Apply tenant filter
    const filter = { _id: id, organizationId: orgId, isDeleted: false, ...req.tenantFilter };

    const member = await Member.findOne(filter);

    if (!member) {
      throw new NotFoundError('Member not found');
    }

    // Soft delete
    member.isDeleted = true;
    member.deletedAt = new Date();
    member.deletedByUserId = req.user.uid;

    await member.save();

    logger.info('Member deleted', {
      memberId: member._id,
      organizationId: orgId,
      deletedBy: req.user.uid
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};


/**
 * Register FCM token for multi-device support
 * Upserts token by deviceId in the fcmTokens array.
 */
exports.updateFcmToken = async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const { token, deviceId, platform, browser } = req.body;
    const userId = req.user.uid;

    if (!token || !deviceId) {
      throw new ValidationError('token and deviceId are required');
    }

    // Find member by Firebase UID (or by memberId if provided in params)
    const filter = { organizationId: orgId, isDeleted: false };
    if (req.params.id && req.params.id !== 'me') {
      filter._id = req.params.id;
    } else {
      filter.userId = userId;
    }

    const member = await Member.findOne(filter);
    if (!member) {
      throw new NotFoundError('Member not found');
    }

    // Upsert token in fcmTokens array
    const existingIndex = member.fcmTokens.findIndex(t => t.deviceId === deviceId);
    const tokenData = {
      token,
      deviceId,
      platform: platform || 'web',
      browser,
      updatedAt: new Date()
    };

    if (existingIndex > -1) {
      member.fcmTokens[existingIndex] = tokenData;
    } else {
      member.fcmTokens.push(tokenData);
    }

    await member.save();

    res.json({
      success: true,
      message: 'FCM token updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove FCM token (logout)
 */
exports.removeFcmToken = async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const { deviceId } = req.body;
    const userId = req.user.uid;

    if (!deviceId) {
      throw new ValidationError('deviceId is required');
    }

    const filter = { organizationId: orgId, isDeleted: false };
    if (req.params.id && req.params.id !== 'me') {
      filter._id = req.params.id;
    } else {
      filter.userId = userId;
    }

    await Member.updateOne(filter, {
      $pull: { fcmTokens: { deviceId } }
    });

    res.json({
      success: true,
      message: 'FCM token removed successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List pending members for triage
 */
exports.getPendingMembers = async (req, res, next) => {
  try {
    const { orgId } = req.params;

    const members = await Member.find({
      organizationId: orgId,
      verificationStatus: 'pending',
      isDeleted: false
    })
    .populate('currentHouseholdId', 'houseName houseNumber')
    .populate('fatherId', 'fullName mobileNumber')
    .populate('motherId', 'fullName mobileNumber')
    .sort({ createdAt: -1 })
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
 * Admit a pending member
 */
exports.admitMember = async (req, res, next) => {
  try {
    const { orgId, id } = req.params;

    const member = await Member.findOneAndUpdate(
      { _id: id, organizationId: orgId, isDeleted: false },
      { 
        $set: { 
          verificationStatus: 'verified',
          status: 'active'
        } 
      },
      { new: true }
    );

    if (!member) {
      throw new NotFoundError('Member not found');
    }

    logger.info('Member admitted', {
      memberId: member._id,
      organizationId: orgId,
      admittedBy: req.user.uid
    });

    res.json({
      success: true,
      data: member
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reject a pending member
 */
exports.rejectMember = async (req, res, next) => {
  try {
    const { orgId, id } = req.params;

    const member = await Member.findOneAndUpdate(
      { _id: id, organizationId: orgId, isDeleted: false },
      { 
        $set: { 
          verificationStatus: 'rejected',
          status: 'inactive',
          isDeleted: true,
          deletedAt: new Date(),
          deletedByUserId: req.user.uid,
          deletionReason: 'Rejected during triage admission'
        } 
      },
      { new: true }
    );

    if (!member) {
      throw new NotFoundError('Member not found');
    }

    logger.info('Member rejected', {
      memberId: member._id,
      organizationId: orgId,
      rejectedBy: req.user.uid
    });

    res.json({
      success: true,
      message: 'Member admission rejected successfully'
    });
  } catch (error) {
    next(error);
  }
};

