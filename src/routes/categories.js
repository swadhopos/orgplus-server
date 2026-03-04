const express = require('express');
const router = express.Router({ mergeParams: true });
const categoryController = require('../controllers/categoryController');
const { requireRole } = require('../middleware/authorize');
const { applyTenantFilter } = require('../middleware/tenantFilter');

// All routes require admin or systemAdmin role
router.use(requireRole('systemAdmin', 'admin'));

// All routes apply tenant filtering
router.use(applyTenantFilter);

// List categories  (GET /api/organizations/:orgId/categories?type=&module=)
router.get('/', categoryController.listCategories);

// Create category  (POST /api/organizations/:orgId/categories)
router.post('/', categoryController.createCategory);

// Seed default categories (POST /api/organizations/:orgId/categories/seed-defaults)
// IMPORTANT: must be before /:id routes so 'seed-defaults' isn't treated as an ID
router.post('/seed-defaults', categoryController.seedDefaults);


// Get category     (GET /api/organizations/:orgId/categories/:id)
router.get('/:id', categoryController.getCategory);

// Update category  (PATCH /api/organizations/:orgId/categories/:id)
router.patch('/:id', categoryController.updateCategory);

// Soft-delete      (DELETE /api/organizations/:orgId/categories/:id)
router.delete('/:id', categoryController.deleteCategory);

module.exports = router;
