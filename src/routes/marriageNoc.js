const express = require('express');
const router = express.Router({ mergeParams: true });
const { authenticateToken } = require('../middleware/auth');
const { requireMainCommitteeAccess } = require('../middleware/committeeAuth');

const {
    getNOCs,
    createNOC,
    approveNOC,
    updateNOCStatus
} = require('../controllers/marriageNocController');

// All routes require authentication
router.use(authenticateToken);
router.use(requireMainCommitteeAccess);

// Map: /api/organizations/:orgId/certificates/noc
router.route('/')
    .get(getNOCs)
    .post(createNOC);

router.route('/:id/approve')
    .post(approveNOC);

router.route('/:id/status')
    .put(updateNOCStatus);

module.exports = router;
