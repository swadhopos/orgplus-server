const express = require('express');
const router = express.Router({ mergeParams: true });
const householdController = require('../controllers/householdController');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/authorize');
const { requirePermission } = require('../middleware/permission');
const { applyTenantFilter } = require('../middleware/tenantFilter');

const { requireMainCommitteeAccess } = require('../middleware/committeeAuth');

// All routes require admin, systemAdmin, staff, or orgMember role
router.use(requireRole('systemAdmin', 'admin', 'staff', 'orgMember'));

// For staff, require household management permission
router.use(requirePermission('canManageHouseholds'));
router.use(requireMainCommitteeAccess);

// All routes apply tenant filtering
router.use(applyTenantFilter);

// Create household
router.post('/', householdController.createHousehold);

// List households
router.get('/', householdController.listHouseholds);

// Get household by ID
router.get('/:id', householdController.getHousehold);

// Update household
router.put('/:id', householdController.updateHousehold);

// Relocate household
router.put('/:id/relocate', householdController.relocateHousehold);

// Delete household
router.delete('/:id', householdController.deleteHousehold);


module.exports = router;
