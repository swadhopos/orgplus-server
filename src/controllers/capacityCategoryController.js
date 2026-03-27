const CapacityCategory = require('../models/CapacityCategory');
const { NotFoundError, ValidationError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Get capacity categories for an organization
 */
exports.getCapacityCategories = async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const { isMembershipTier } = req.query;

    // Tenant check
    if (req.user.role === 'admin' && req.user.orgId !== orgId) {
      throw new NotFoundError('Organization not found');
    }

    const query = { 
      organizationId: orgId, 
      isDeleted: false 
    };

    if (isMembershipTier !== undefined) {
      query.isMembershipTier = isMembershipTier === 'true';
    }

    const categories = await CapacityCategory.find(query).sort({ createdAt: 1 });

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add a capacity category with tiers
 */
exports.addCapacityCategory = async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const { name, targetType, tiers } = req.body;

    if (!name || !targetType) {
      throw new ValidationError('Name and targetType are required');
    }

    // Tenant check
    if (req.user.role === 'admin' && req.user.orgId !== orgId) {
      throw new NotFoundError('Organization not found');
    }

    const category = new CapacityCategory({
      organizationId: orgId,
      name,
      targetType,
      isMembershipTier: req.body.isMembershipTier || false,
      tiers: tiers || [],
      createdByUserId: req.user.uid
    });

    await category.save();

    logger.info('Capacity category created', {
      categoryId: category._id,
      organizationId: orgId,
      createdBy: req.user.uid
    });

    res.status(201).json({
      success: true,
      data: category
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a capacity category and its tiers
 */
exports.updateCapacityCategory = async (req, res, next) => {
  try {
    const { orgId, catId } = req.params;
    const { name, targetType, tiers } = req.body;

    // Tenant check
    if (req.user.role === 'admin' && req.user.orgId !== orgId) {
      throw new NotFoundError('Organization not found');
    }

    const category = await CapacityCategory.findOneAndUpdate(
      { _id: catId, organizationId: orgId, isDeleted: false },
      { 
        $set: { 
          name, 
          targetType, 
          isMembershipTier: req.body.isMembershipTier,
          tiers: tiers || [] 
        } 
      },
      { new: true, runValidators: true }
    );

    if (!category) {
      throw new NotFoundError('Category not found');
    }

    logger.info('Capacity category updated', {
      categoryId: category._id,
      organizationId: orgId,
      updatedBy: req.user.uid
    });

    res.json({
      success: true,
      data: category
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a capacity category (soft delete)
 */
exports.deleteCapacityCategory = async (req, res, next) => {
  try {
    const { orgId, catId } = req.params;

    // Tenant check
    if (req.user.role === 'admin' && req.user.orgId !== orgId) {
      throw new NotFoundError('Organization not found');
    }

    const category = await CapacityCategory.findOneAndUpdate(
      { _id: catId, organizationId: orgId, isDeleted: false },
      { 
        $set: { 
          isDeleted: true,
          deletedAt: new Date(),
          deletedByUserId: req.user.uid
        } 
      },
      { new: true }
    );

    if (!category) {
      throw new NotFoundError('Category not found');
    }

    logger.info('Capacity category soft deleted', {
      categoryId: category._id,
      organizationId: orgId,
      deletedBy: req.user.uid
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
