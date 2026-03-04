const Category = require('../models/Category');
const { NotFoundError, ValidationError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * List all categories for an org
 * GET /api/organizations/:orgId/categories
 * Query: ?type=income|expense|both  &module=ledger|event|fundraiser|all
 */
exports.listCategories = async (req, res, next) => {
    try {
        const { orgId } = req.params;
        const { type, module: mod } = req.query;

        const categories = await Category.findByOrg(orgId, { type, module: mod });

        res.json({ success: true, data: categories });
    } catch (error) {
        next(error);
    }
};

/**
 * Create a category
 * POST /api/organizations/:orgId/categories
 * Body: { name, type, module, color, icon }
 */
exports.createCategory = async (req, res, next) => {
    try {
        const { orgId } = req.params;
        const { name, type, module: mod, color, icon } = req.body;

        if (!name) throw new ValidationError('Category name is required');

        const category = new Category({
            organizationId: orgId,
            name,
            type: type || 'both',
            module: mod || 'all',
            color: color || null,
            icon: icon || null,
            audit: { createdByUserId: req.user.uid }
        });

        await category.save();

        logger.info('Category created', {
            categoryId: category._id,
            organizationId: orgId,
            createdBy: req.user.uid
        });

        res.status(201).json({ success: true, data: category });
    } catch (error) {
        next(error);
    }
};

/**
 * Get a single category
 * GET /api/organizations/:orgId/categories/:id
 */
exports.getCategory = async (req, res, next) => {
    try {
        const { orgId, id } = req.params;

        const category = await Category.findOne({
            _id: id,
            organizationId: orgId,
            'audit.isDeleted': false
        });

        if (!category) throw new NotFoundError('Category not found');

        res.json({ success: true, data: category });
    } catch (error) {
        next(error);
    }
};

/**
 * Update a category
 * PATCH /api/organizations/:orgId/categories/:id
 * Body: { name, type, module, color, icon }
 */
exports.updateCategory = async (req, res, next) => {
    try {
        const { orgId, id } = req.params;
        const { name, type, module: mod, color, icon } = req.body;

        const category = await Category.findOne({
            _id: id,
            organizationId: orgId,
            'audit.isDeleted': false
        });

        if (!category) throw new NotFoundError('Category not found');

        if (name !== undefined) category.name = name;
        if (type !== undefined) category.type = type;
        if (mod !== undefined) category.module = mod;
        if (color !== undefined) category.color = color;
        if (icon !== undefined) category.icon = icon;

        category.audit.updatedByUserId = req.user.uid;
        category.audit.updatedAt = new Date();
        category.audit.history.push({ action: 'updated', byUserId: req.user.uid });

        await category.save();

        logger.info('Category updated', {
            categoryId: category._id,
            organizationId: orgId,
            updatedBy: req.user.uid
        });

        res.json({ success: true, data: category });
    } catch (error) {
        next(error);
    }
};

/**
 * Soft-delete a category
 * DELETE /api/organizations/:orgId/categories/:id
 */
exports.deleteCategory = async (req, res, next) => {
    try {
        const { orgId, id } = req.params;
        const { reason } = req.body;

        const category = await Category.findOne({
            _id: id,
            organizationId: orgId,
            'audit.isDeleted': false
        });

        if (!category) throw new NotFoundError('Category not found');

        await category.softDelete(req.user.uid, reason || null);

        logger.info('Category deleted', {
            categoryId: category._id,
            organizationId: orgId,
            deletedBy: req.user.uid
        });

        res.status(204).send();
    } catch (error) {
        next(error);
    }
};

/**
 * Seed default categories for an org (idempotent — safe to call multiple times)
 * POST /api/organizations/:orgId/categories/seed-defaults
 */
exports.seedDefaults = async (req, res, next) => {
    try {
        const { orgId } = req.params;
        await Category.seedDefaults(orgId, req.user.uid);
        // Return the full refreshed list
        const categories = await Category.findByOrg(orgId);
        logger.info('Categories seeded', { organizationId: orgId, seededBy: req.user.uid });
        res.json({ success: true, data: categories });
    } catch (error) {
        next(error);
    }
};

