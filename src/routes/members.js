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

// Create member (requires full member management permission)
router.post('/', requirePermission('canManageMembers'), memberController.createMember);


// Triage routes (accessible by triage volunteers or full member managers)
router.get('/triage', requirePermission('canTriageMembers', 'canManageMembers'), memberController.getPendingMembers);
router.post('/:id/admit', requirePermission('canTriageMembers', 'canManageMembers'), memberController.admitMember);
router.post('/:id/reject', requirePermission('canTriageMembers', 'canManageMembers'), memberController.rejectMember);

// List members (requires full member management permission)
router.get('/', requirePermission('canManageMembers'), memberController.listMembers);

// Get member by ID (requires full member management permission)
router.get('/:id', requirePermission('canManageMembers'), memberController.getMember);

// Get member relationships (requires full member management permission)
router.get('/:id/relationships', requirePermission('canManageMembers'), memberController.getMemberRelationships);

// Update member (requires full member management permission)
router.put('/:id', requirePermission('canManageMembers'), memberController.updateMember);

// Delete member (requires full member management permission)
router.delete('/:id', requirePermission('canManageMembers'), memberController.deleteMember);

module.exports = router;
