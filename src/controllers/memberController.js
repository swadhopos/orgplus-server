const Member = require('../models/Member');
const Household = require('../models/Household');
const Counter = require('../models/Counter');
const { NotFoundError, ValidationError } = require('../utils/errors');
const logger = require('../utils/logger');

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
      status
    } = req.body;

    // Validate required fields
    if (!fullName || !gender || !currentHouseholdId || !maritalStatus) {
      throw new ValidationError('Missing required fields');
    }

    // Verify household exists in same organization
    const household = await Household.findOne({
      _id: currentHouseholdId,
      organizationId: orgId,
      isDeleted: false
    });

    if (!household) {
      throw new NotFoundError('Household not found');
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

    // Atomically increment member counter for this organization
    const counterId = `member_seq_${orgId}`;
    let counter = await Counter.findOneAndUpdate(
      { _id: counterId, organizationId: orgId },
      { $inc: { sequenceValue: 1 } },
      { new: true, upsert: true }
    );

    // If counter just created (sequenceValue is 1), let's ensure it starts at 1001 for member numbers
    // Alternatively, just add 1000 to whatever comes out
    const nextSequence = 1000 + counter.sequenceValue;
    const memberNumber = `MEM-${nextSequence}`;

    // Create member
    const member = new Member({
      memberSequence: nextSequence,
      memberNumber,
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
      status: status || 'active',
      organizationId: orgId,
      createdByUserId: req.user.uid
    });

    await member.save();

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
    const { page = 1, limit = 10, currentHouseholdId } = req.query;
    const skip = (page - 1) * limit;

    // Apply tenant filter
    const filter = { organizationId: orgId, isDeleted: false, ...req.tenantFilter };

    // Convert tenant filter householdId mapping if it exists
    if (filter.householdId) {
      filter.currentHouseholdId = filter.householdId;
      delete filter.householdId;
    }

    // Optional household filter
    if (currentHouseholdId) {
      filter.currentHouseholdId = currentHouseholdId;
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
      .populate('spouseId', 'fullName');

    if (!member) {
      throw new NotFoundError('Member not found');
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
      status
    } = req.body;

    // Apply tenant filter
    const filter = { _id: id, organizationId: orgId, isDeleted: false, ...req.tenantFilter };

    const member = await Member.findOne(filter);

    if (!member) {
      throw new NotFoundError('Member not found');
    }

    // Update fields
    if (fullName) member.fullName = fullName;
    if (gender) member.gender = gender;
    if (dateOfBirth) member.dateOfBirth = dateOfBirth;
    if (currentHouseholdId) member.currentHouseholdId = currentHouseholdId;
    if (maritalStatus) member.maritalStatus = maritalStatus;
    if (mobileNumber !== undefined) member.mobileNumber = mobileNumber;
    if (email !== undefined) member.email = email;
    if (occupation !== undefined) member.occupation = occupation;
    if (status) member.status = status;
    if (fatherId !== undefined) member.fatherId = fatherId;
    if (motherId !== undefined) member.motherId = motherId;
    if (spouseId !== undefined) member.spouseId = spouseId;

    await member.save();

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
