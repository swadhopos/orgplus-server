const express = require('express');
const router = express.Router({ mergeParams: true });
const memberController = require('../controllers/memberController');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/authorize');
const { applyTenantFilter } = require('../middleware/tenantFilter');

// All routes require admin or systemAdmin role
router.use(requireRole('systemAdmin', 'admin'));

// All routes apply tenant filtering
router.use(applyTenantFilter);

// Create member
router.post('/', memberController.createMember);

// List members
router.get('/', memberController.listMembers);

// Get member by ID
router.get('/:id', memberController.getMember);

// Get member relationships
router.get('/:id/relationships', memberController.getMemberRelationships);

// Update member
router.put('/:id', memberController.updateMember);

// Delete member
router.delete('/:id', memberController.deleteMember);

module.exports = router;
