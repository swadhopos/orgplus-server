const express = require('express');
const router = express.Router();
const organizationController = require('../controllers/organizationController');
const capacityCategoryController = require('../controllers/capacityCategoryController');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/authorize');
const { applyTenantFilter } = require('../middleware/tenantFilter');
const multer = require('multer');

// Multer: store in memory, 5MB limit, images only
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

// All routes require authentication
router.use(authenticateToken);

// Create organization (systemAdmin only)
router.post(
  '/',
  requireRole('systemAdmin'),
  organizationController.createOrganization
);

// List organizations (with tenant filtering)
router.get(
  '/',
  applyTenantFilter,
  organizationController.listOrganizations
);

// Get organization by ID
router.get(
  '/:id',
  applyTenantFilter,
  organizationController.getOrganization
);

// Update organization
router.put(
  '/:id',
  requireRole('systemAdmin', 'admin'),
  applyTenantFilter,
  upload.single('logo'),
  organizationController.updateOrganization
);

// Delete organization (systemAdmin only)
router.delete(
  '/:id',
  requireRole('systemAdmin'),
  applyTenantFilter,
  organizationController.deleteOrganization
);

// Create organization admin (systemAdmin only)
router.post(
  '/:orgId/admins',
  requireRole('systemAdmin'),
  organizationController.createOrgAdmin
);

// Capacity Categories
router.get(
  '/:orgId/capacity-categories',
  capacityCategoryController.getCapacityCategories
);

router.post(
  '/:orgId/capacity-categories',
  requireRole('admin', 'systemAdmin'),
  capacityCategoryController.addCapacityCategory
);

router.put(
  '/:orgId/capacity-categories/:catId',
  requireRole('admin', 'systemAdmin'),
  capacityCategoryController.updateCapacityCategory
);

router.delete(
  '/:orgId/capacity-categories/:catId',
  requireRole('admin', 'systemAdmin'),
  capacityCategoryController.deleteCapacityCategory
);

module.exports = router;
