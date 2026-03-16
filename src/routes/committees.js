const express = require('express');
const router = express.Router({ mergeParams: true });
const committeeController = require('../controllers/committeeController');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/authorize');
const { applyTenantFilter } = require('../middleware/tenantFilter');

const { requireMainCommitteeAccess } = require('../middleware/committeeAuth');

// All routes require admin, systemAdmin, or an active main committee officer
router.use(requireRole('systemAdmin', 'admin', 'orgMember'));
router.use(requireMainCommitteeAccess);

// All routes apply tenant filtering
router.use(applyTenantFilter);

// Create committee
router.post('/', committeeController.createCommittee);

// List committees
router.get('/', committeeController.listCommittees);

// Get committee by ID
router.get('/:id', committeeController.getCommittee);

// Update committee
router.put('/:id', committeeController.updateCommittee);

// Dissolve committee
router.post('/:id/dissolve', committeeController.dissolveCommittee);

// Delete committee
router.delete('/:id', committeeController.deleteCommittee);

// Committee member routes
router.post('/:committeeId/members', committeeController.addCommitteeMember);
router.get('/:committeeId/members', committeeController.listCommitteeMembers);
router.put('/:committeeId/members/:id', committeeController.updateCommitteeMember);
router.delete('/:committeeId/members/:id', committeeController.removeCommitteeMember);

// Create or link a Firebase login for a privileged committee officer (president/vp/secretary/treasurer)
router.post('/:committeeId/members/:memberId/create-login', committeeController.createMemberLogin);

module.exports = router;
