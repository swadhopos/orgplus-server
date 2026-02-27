const express = require('express');
const router = express.Router();
const organizationController = require('../controllers/organizationController');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/authorize');
const { applyTenantFilter } = require('../middleware/tenantFilter');

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

module.exports = router;
