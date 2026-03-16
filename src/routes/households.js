const express = require('express');
const router = express.Router({ mergeParams: true });
const householdController = require('../controllers/householdController');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/authorize');
const { applyTenantFilter } = require('../middleware/tenantFilter');

const { requireMainCommitteeAccess } = require('../middleware/committeeAuth');

// All routes require admin, systemAdmin, or an active main committee officer role
router.use(requireRole('systemAdmin', 'admin', 'orgMember'));
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

// Delete household
router.delete('/:id', householdController.deleteHousehold);

module.exports = router;
