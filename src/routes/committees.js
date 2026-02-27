const express = require('express');
const router = express.Router({ mergeParams: true });
const committeeController = require('../controllers/committeeController');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/authorize');
const { applyTenantFilter } = require('../middleware/tenantFilter');

// All routes require authentication
router.use(authenticateToken);

// All routes require admin or systemAdmin role
router.use(requireRole('systemAdmin', 'admin'));

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

// Delete committee
router.delete('/:id', committeeController.deleteCommittee);

// Committee member routes
router.post('/:committeeId/members', committeeController.addCommitteeMember);
router.get('/:committeeId/members', committeeController.listCommitteeMembers);
router.put('/:committeeId/members/:id', committeeController.updateCommitteeMember);
router.delete('/:committeeId/members/:id', committeeController.removeCommitteeMember);

module.exports = router;
