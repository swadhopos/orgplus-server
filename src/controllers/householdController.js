const Household = require('../models/Household');
const Organization = require('../models/Organization');
const { admin } = require('../config/firebase');
const { AppError, NotFoundError, ValidationError } = require('../utils/errors');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

/**
 * Create a new household with optional user creation
 */
exports.createHousehold = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { orgId } = req.params;
    const {
      houseNumber,
      block,
      floor,
      ownerName,
      contactPhone,
      contactEmail,
      occupancyStatus,
      email,
      password
    } = req.body;

    // Validate required fields
    if (!houseNumber || !ownerName || !contactPhone) {
      throw new ValidationError('Missing required fields: houseNumber, ownerName, contactPhone');
    }

    // Verify organization exists
    const organization = await Organization.findOne({ _id: orgId, isDeleted: false });
    if (!organization) {
      throw new NotFoundError('Organization not found');
    }

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

        // Note: Custom claims will be set after household is created
        userInfo = {
          userId: userRecord.uid,
          email: userRecord.email
        };

        logger.info('Firebase user created for household', {
          userId: userRecord.uid,
          email: userRecord.email,
          organizationId: orgId
        });
      } catch (error) {
        await session.abortTransaction();
        if (error.code === 'auth/email-already-exists') {
          throw new ValidationError('Email already exists');
        }
        throw error;
      }
    }

    // Create household
    const household = new Household({
      houseNumber,
      block,
      floor,
      ownerName,
      contactPhone,
      contactEmail,
      occupancyStatus: occupancyStatus || 'owner-occupied',
      userId,
      organizationId: orgId,
      createdByUserId: req.user.uid
    });

    await household.save({ session });

    // Set custom claims for the created user
    if (userId) {
      await admin.auth().setCustomUserClaims(userId, {
        role: 'orgMember',
        orgId: orgId,
        householdId: household._id.toString()
      });
    }

    await session.commitTransaction();

    logger.info('Household created', {
      householdId: household._id,
      organizationId: orgId,
      userId: userId,
      createdBy: req.user.uid
    });

    res.status(201).json({
      success: true,
      data: {
        household,
        user: userInfo
      }
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * List households (with tenant filtering)
 */
exports.listHouseholds = async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    // Apply tenant filter
    const filter = { organizationId: orgId, isDeleted: false, ...req.tenantFilter };

    const households = await Household.find(filter)
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

    const household = await Household.findOne(filter);

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
      houseNumber,
      block,
      floor,
      ownerName,
      contactPhone,
      contactEmail,
      occupancyStatus
    } = req.body;

    // Apply tenant filter
    const filter = { _id: id, organizationId: orgId, isDeleted: false, ...req.tenantFilter };

    const household = await Household.findOne(filter);

    if (!household) {
      throw new NotFoundError('Household not found');
    }

    // Update fields
    if (houseNumber) household.houseNumber = houseNumber;
    if (block !== undefined) household.block = block;
    if (floor !== undefined) household.floor = floor;
    if (ownerName) household.ownerName = ownerName;
    if (contactPhone) household.contactPhone = contactPhone;
    if (contactEmail !== undefined) household.contactEmail = contactEmail;
    if (occupancyStatus) household.occupancyStatus = occupancyStatus;

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
