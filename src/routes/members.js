const express = require('express');
const router = express.Router({ mergeParams: true });
const memberController = require('../controllers/memberController');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/authorize');
const { requirePermission } = require('../middleware/permission');
const { applyTenantFilter } = require('../middleware/tenantFilter');

const { requireMainCommitteeAccess } = require('../middleware/committeeAuth');

// All routes require admin, systemAdmin, staff, or orgMember role
router.use(requireRole('systemAdmin', 'admin', 'staff', 'orgMember'));

// For staff, require member management permission
router.use(requirePermission('canManageMembers'));

// All routes apply tenant filtering
router.use(applyTenantFilter);

// FCM Token Management (Accessible by anyone with orgMember role or above)
// These are placed BEFORE requireMainCommitteeAccess
router.post('/fcm-token', memberController.updateFcmToken);
router.post('/:id/fcm-token', memberController.updateFcmToken);
router.delete('/fcm-token', memberController.removeFcmToken);
router.delete('/:id/fcm-token', memberController.removeFcmToken);

// All following routes require an active main committee officer role or admin
router.use(requireMainCommitteeAccess);

// Create member
router.post('/', memberController.createMember);


// Triage routes
router.get('/triage', memberController.getPendingMembers);
router.post('/:id/admit', memberController.admitMember);
router.post('/:id/reject', memberController.rejectMember);

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
