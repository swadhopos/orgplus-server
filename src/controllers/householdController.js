const Household = require('../models/Household');
const Organization = require('../models/Organization');
const Member = require('../models/Member');
const { admin } = require('../config/firebase');
const { AppError, NotFoundError, ValidationError } = require('../utils/errors');
const logger = require('../utils/logger');
const { autoAssignPlansToNewTarget } = require('../services/subscriptionService');
const { escapeRegex } = require('../utils/stringUtils');

/**
 * Create a new household with optional user creation and automatic Head Member creation
 */
exports.createHousehold = async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const {
      houseName,
      houseNumber,
      addressLine1,
      addressLine2,
      postalCode,
      primaryMobile,
      status,
      email,
      password,
      // Member fields for the Head
      headFullName,
      headGender,
      headMaritalStatus
    } = req.body;

    // Validate required fields
    if (!houseName) {
      throw new ValidationError('Missing required fields: houseName');
    }

    // Verify organization exists and atomically increment houseCounter
    const organization = await Organization.findOneAndUpdate(
      { _id: orgId, isDeleted: false },
      { $inc: { houseCounter: 1 } },
      { new: true }
    );

    if (!organization) {
      throw new NotFoundError('Organization not found');
    }

    const generatedHouseNumber = `${organization.orgNumber}-${organization.houseCounter}`;

    let userId = null;
    let userInfo = null;

    // Create Firebase user if email and password provided
    if (email && password) {
      try {
        const userRecord = await admin.auth().createUser({
          email,
          password,
          emailVerified: false
        });

        userId = userRecord.uid;
        userInfo = { userId: userRecord.uid, email: userRecord.email };

        logger.info('Firebase user created for household', {
          userId: userRecord.uid,
          email: userRecord.email,
          organizationId: orgId
        });
      } catch (error) {
        if (error.code === 'auth/email-already-exists') {
          throw new ValidationError('Email already exists');
        }
        throw error;
      }
    }

    // 1. Create household (without headMemberId initially)
    const household = new Household({
      houseName,
      houseNumber: generatedHouseNumber,
      memberCounter: 0,
      addressLine1,
      addressLine2,
      postalCode,
      primaryMobile,
      status: status || 'active',
      organizationId: orgId,
      createdByUserId: req.user.uid
    });

    await household.save();

    // Trigger auto-assignment for Household
    autoAssignPlansToNewTarget(orgId, household._id, 'HOUSEHOLD', req.user.uid).catch(err => 
        console.error('Failed auto-assigning plans to new household:', err)
    );

    // 2. Automatically create Head Member if details provided
    let headMember = null;
    if (headFullName && headGender && headMaritalStatus) {

      // Increment household member counter for the head
      household.memberCounter += 1;
      const headMemberNumber = `${generatedHouseNumber}-${household.memberCounter}`;

      headMember = new Member({
        memberSequence: household.memberCounter, // To keep the schema happy if it needs a number
        memberNumber: headMemberNumber,
        fullName: headFullName,
        gender: headGender,
        maritalStatus: headMaritalStatus,
        mobileNumber: primaryMobile,
        email: email,
        userId: userId,
        currentHouseholdId: household._id,
        status: 'active',
        organizationId: orgId,
        createdByUserId: req.user.uid
      });

      await headMember.save();

      // Update household with head member
      household.headMemberId = headMember._id;
      await household.save();
    }

    // 3. Set custom claims for the created user
    if (userId) {
      await admin.auth().setCustomUserClaims(userId, {
        role: 'orgMember',
        orgId: orgId,
        householdId: household._id.toString()
      });
    }

    logger.info('Household and Head Member created', {
      householdId: household._id,
      memberId: headMember ? headMember._id : null,
      organizationId: orgId,
      userId: userId,
      createdBy: req.user.uid
    });

    res.status(201).json({
      success: true,
      data: {
        household,
        headMember,
        user: userInfo
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List households (with tenant filtering)
 */
exports.listHouseholds = async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const { page = 1, limit = 10, search, status } = req.query;
    const skip = (page - 1) * limit;

    // Apply tenant filter
    const filter = { organizationId: orgId, isDeleted: false, ...req.tenantFilter };

    // Search filter
    if (search) {
      const safeSearch = escapeRegex(search);
      filter.$or = [
        { houseName: { $regex: safeSearch, $options: 'i' } },
        { houseNumber: { $regex: safeSearch, $options: 'i' } }
      ];
    }

    if (status && status !== 'all') {
      filter.status = status;
    }

    // Convert tenant filter householdId mapping to _id for Household queries
    if (filter.householdId) {
      filter._id = filter.householdId;
      delete filter.householdId;
    }

    const households = await Household.find(filter)
      .populate('headMemberId', 'fullName')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Household.countDocuments(filter);

    res.json({
      success: true,
      data: households,
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
 * Get household by ID
 */
exports.getHousehold = async (req, res, next) => {
  try {
    const { orgId, id } = req.params;

    // Apply tenant filter
    const filter = { _id: id, organizationId: orgId, isDeleted: false, ...req.tenantFilter };

    // Remove householdId from filter if present to avoid schema strictQuery warnings,
    // since we already filter by _id = id
    delete filter.householdId;

    const household = await Household.findOne(filter).populate('headMemberId', 'fullName');

    if (!household) {
      throw new NotFoundError('Household not found');
    }

    res.json({
      success: true,
      data: household
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update household
 */
exports.updateHousehold = async (req, res, next) => {
  try {
    const { orgId, id } = req.params;
    const {
      houseName,
      houseNumber,
      addressLine1,
      addressLine2,
      postalCode,
      primaryMobile,
      status
    } = req.body;

    // Apply tenant filter
    const filter = { _id: id, organizationId: orgId, isDeleted: false, ...req.tenantFilter };

    delete filter.householdId;

    const household = await Household.findOne(filter);

    if (!household) {
      throw new NotFoundError('Household not found');
    }

    // Update fields
    if (houseName) household.houseName = houseName;
    if (houseNumber !== undefined) household.houseNumber = houseNumber;
    if (addressLine1 !== undefined) household.addressLine1 = addressLine1;
    if (addressLine2 !== undefined) household.addressLine2 = addressLine2;
    if (postalCode !== undefined) household.postalCode = postalCode;
    if (primaryMobile !== undefined) household.primaryMobile = primaryMobile;
    if (status) household.status = status;
    if (req.body.capacityOverrides !== undefined) household.capacityOverrides = req.body.capacityOverrides;

    await household.save();

    logger.info('Household updated', {
      householdId: household._id,
      organizationId: orgId,
      updatedBy: req.user.uid
    });

    res.json({
      success: true,
      data: household
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Soft delete household
 */
exports.deleteHousehold = async (req, res, next) => {
  try {
    const { orgId, id } = req.params;

    // Apply tenant filter
    const filter = { _id: id, organizationId: orgId, isDeleted: false, ...req.tenantFilter };

    delete filter.householdId;

    const household = await Household.findOne(filter);

    if (!household) {
      throw new NotFoundError('Household not found');
    }

    // Soft delete
    household.isDeleted = true;
    household.deletedAt = new Date();
    household.deletedByUserId = req.user.uid;

    await household.save();

    logger.info('Household deleted', {
      householdId: household._id,
      organizationId: orgId,
      deletedBy: req.user.uid
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

/**
 * Relocate household (Transition to 'relocated' status)
 */
exports.relocateHousehold = async (req, res, next) => {
  try {
    const { orgId, id } = req.params;
    const { relocationReason, relocationNotes } = req.body;

    if (!relocationReason) {
      throw new ValidationError('Relocation reason is required');
    }

    // Apply tenant filter
    const filter = { _id: id, organizationId: orgId, isDeleted: false, ...req.tenantFilter };
    delete filter.householdId;

    const household = await Household.findOne(filter);

    if (!household) {
      throw new NotFoundError('Household not found');
    }

    // Update status and relocation details
    household.status = 'relocated';
    household.relocatedAt = new Date();
    household.relocationReason = relocationReason;
    household.relocationNotes = relocationNotes;

    await household.save();

    // Synchronize status to all members of this household
    await Member.updateMany(
      { currentHouseholdId: household._id, organizationId: orgId, isDeleted: false },
      { 
        $set: { 
          status: 'relocated',
          relocatedAt: household.relocatedAt,
          relocationReason: relocationReason
        } 
      }
    );

    logger.info('Household and members relocated', {
      householdId: household._id,
      organizationId: orgId,
      relocatedBy: req.user.uid,
      reason: relocationReason
    });


    res.json({
      success: true,
      data: household
    });
  } catch (error) {
    next(error);
  }
};

