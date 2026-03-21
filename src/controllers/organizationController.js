const Organization = require('../models/Organization');
const { admin } = require('../config/firebase');
const { AppError, NotFoundError, ValidationError } = require('../utils/errors');
const logger = require('../utils/logger');
const Counter = require('../models/Counter');
const OrgNicheType = require('../models/OrgNicheType');
const OrgConfig = require('../models/OrgConfig');
const { getNextAlphaId } = require('../utils/idGenerator');

/**
 * Create a new organization (systemAdmin only)
 */
exports.createOrganization = async (req, res, next) => {
  try {
    const {
      name, nicheTypeKey, registrationNumber, establishedDate, totalUnits,
      address, city, state, pincode, country,
      contactEmail, contactPhone, alternatePhone, website, description,
      status, adminEmail, adminPassword
    } = req.body;

    // Validate nicheTypeKey
    if (!nicheTypeKey) {
      throw new ValidationError('nicheTypeKey is required');
    }

    const nicheType = await OrgNicheType.findOne({ key: nicheTypeKey, isActive: true });
    if (!nicheType) {
      throw new ValidationError(`Niche type '${nicheTypeKey}' not found or inactive`);
    }

    // Validate required fields
    if (!name || !address || !contactEmail || !contactPhone || !adminEmail || !adminPassword) {
      throw new ValidationError('Missing required fields: name, address, contactEmail, contactPhone, adminEmail, adminPassword');
    }

    // Check if organization name already exists
    const existing = await Organization.findOne({ name, isDeleted: false });
    if (existing) {
      throw new ValidationError('Organization with this name already exists');
    }

    // Generate Organization ID (orgNumber)
    const GLOBAL_ORG_COUNTER_ID = 'global_org_seq';
    let counter = await Counter.findOne({ _id: GLOBAL_ORG_COUNTER_ID });

    let currentId = null;
    if (counter) {
      currentId = counter.stringValue;
    }

    const nextOrgNumber = getNextAlphaId(currentId);

    // Update or create the global counter
    await Counter.findOneAndUpdate(
      { _id: GLOBAL_ORG_COUNTER_ID },
      {
        $set: { stringValue: nextOrgNumber }
      },
      { upsert: true, new: true }
    );

    // Create organization
    const organization = new Organization({
      name,
      type: nicheType.name, // Map niche name to type for legacy compatibility
      nicheTypeKey,
      registrationNumber,
      establishedDate,
      totalUnits,
      address,
      city,
      state,
      pincode,
      country,
      contactEmail,
      contactPhone,
      alternatePhone,
      website,
      description,
      status: status || 'active',
      orgNumber: nextOrgNumber,
      houseCounter: 0,
      independentMemberCounter: 0,
      createdByUserId: req.user.uid
    });

    await organization.save();

    // Create OrgConfig snapshot with optional overrides
    const { 
      membershipModel: overrideModel, 
      labels: overrideLabels, 
      features: overrideFeatures,
      financial: overrideFinancial 
    } = req.body;

    const finalModel = overrideModel || nicheType.membershipModel;
    const idFormat = finalModel === 'individual_only' ? 'member_only' : 'group_member';
    
    const orgConfig = new OrgConfig({
      organizationId: organization._id,
      nicheTypeKey: nicheType.key,
      membershipModel: finalModel,
      labels: overrideLabels || nicheType.labels,
      features: overrideFeatures ? { ...nicheType.features, ...overrideFeatures } : nicheType.features,
      financial: overrideFinancial || nicheType.financial,
      idFormat: { format: idFormat },
      createdByUserId: req.user.uid
    });

    await orgConfig.save();

    // Create organization admin user
    let adminUser = null;
    try {
      const userRecord = await admin.auth().createUser({
        email: adminEmail,
        password: adminPassword,
        emailVerified: true
      });

      // Set custom claims
      await admin.auth().setCustomUserClaims(userRecord.uid, {
        role: 'admin',
        orgId: organization._id.toString()
      });

      adminUser = {
        userId: userRecord.uid,
        email: userRecord.email
      };

      logger.info('Organization and admin created', {
        organizationId: organization._id,
        name: organization.name,
        adminUserId: userRecord.uid,
        adminEmail: userRecord.email,
        createdBy: req.user.uid
      });
    } catch (authError) {
      // If admin creation fails, delete the organization
      await Organization.deleteOne({ _id: organization._id });

      if (authError.code === 'auth/email-already-exists') {
        throw new ValidationError('Admin email already exists');
      }
      throw new AppError('Failed to create admin user: ' + authError.message);
    }

    res.status(201).json({
      success: true,
      data: {
        organization,
        admin: adminUser
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List all organizations (with tenant filtering)
 */
exports.listOrganizations = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    // Apply tenant filter
    // For systemAdmin: no filter (sees all)
    // For admin: filter by _id matching their orgId
    let filter = { isDeleted: false };

    if (req.user && req.user.role === 'admin' && req.user.orgId) {
      filter._id = req.user.orgId;
    }

    const organizations = await Organization.find(filter)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Organization.countDocuments(filter);

    res.json({
      success: true,
      data: organizations,
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
 * Get organization by ID
 */
exports.getOrganization = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Apply tenant filter
    // For systemAdmin: can access any org
    // For admin: can only access their own org
    let filter = { _id: id, isDeleted: false };

    if (req.user && req.user.role === 'admin') {
      if (req.user.orgId !== id) {
        throw new NotFoundError('Organization not found');
      }
    }

    const organization = await Organization.findOne(filter);

    if (!organization) {
      throw new NotFoundError('Organization not found');
    }

    res.json({
      success: true,
      data: organization
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update organization
 */
exports.updateOrganization = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, address, contactEmail, contactPhone, status } = req.body;

    // Apply tenant filter
    const filter = { _id: id, isDeleted: false };

    const organization = await Organization.findOne(filter);

    if (!organization) {
      throw new NotFoundError('Organization not found');
    }

    // Update fields
    if (name) organization.name = name;
    if (address) organization.address = address;
    if (contactEmail) organization.contactEmail = contactEmail;
    if (contactPhone) organization.contactPhone = contactPhone;
    if (status) organization.status = status;

    await organization.save();

    logger.info('Organization updated', {
      organizationId: organization._id,
      updatedBy: req.user.uid
    });

    res.json({
      success: true,
      data: organization
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Soft delete organization
 */
exports.deleteOrganization = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Apply tenant filter
    const filter = { _id: id, isDeleted: false };

    const organization = await Organization.findOne(filter);

    if (!organization) {
      throw new NotFoundError('Organization not found');
    }

    // Soft delete
    organization.isDeleted = true;
    organization.deletedAt = new Date();
    organization.deletedByUserId = req.user.uid;

    await organization.save();

    logger.info('Organization deleted', {
      organizationId: organization._id,
      deletedBy: req.user.uid
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

/**
 * Create organization admin user
 */
exports.createOrgAdmin = async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      throw new ValidationError('Missing required fields: email, password');
    }

    // Verify organization exists
    const organization = await Organization.findOne({ _id: orgId, isDeleted: false });
    if (!organization) {
      throw new NotFoundError('Organization not found');
    }

    // Create Firebase user
    const userRecord = await admin.auth().createUser({
      email,
      password,
      emailVerified: false
    });

    // Set custom claims
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      role: 'admin',
      orgId: orgId
    });

    logger.info('Organization admin created', {
      userId: userRecord.uid,
      email: userRecord.email,
      organizationId: orgId,
      createdBy: req.user.uid
    });

    res.status(201).json({
      success: true,
      data: {
        userId: userRecord.uid,
        email: userRecord.email,
        organizationId: orgId
      }
    });
  } catch (error) {
    if (error.code === 'auth/email-already-exists') {
      next(new ValidationError('Email already exists'));
    } else {
      next(error);
    }
  }
};


// End of controller

