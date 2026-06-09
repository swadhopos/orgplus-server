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

router.use(requireMainCommitteeAccess);

// All routes apply tenant filtering
router.use(applyTenantFilter);

// Create household
router.post('/', requirePermission('canManageHouseholds'), householdController.createHousehold);

// Create household via survey (bulk members)
router.post('/survey', requirePermission('canTriageMembers', 'canManageHouseholds'), householdController.createHouseholdSurvey);

// List households
router.get('/', requirePermission('canManageHouseholds'), householdController.listHouseholds);

// Get household by ID
router.get('/:id', requirePermission('canManageHouseholds'), householdController.getHousehold);

// Update household
router.put('/:id', requirePermission('canManageHouseholds'), householdController.updateHousehold);

// Relocate household
router.put('/:id/relocate', requirePermission('canManageHouseholds'), householdController.relocateHousehold);

// Delete household
router.delete('/:id', requirePermission('canManageHouseholds'), householdController.deleteHousehold);


module.exports = router;
