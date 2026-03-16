const express = require('express');
const router = express.Router({ mergeParams: true });
const { authenticateToken } = require('../middleware/auth');
const { requireMainCommitteeAccess } = require('../middleware/committeeAuth');
const { requireRole } = require('../middleware/authorize');

const {
    getCertificates,
    createCertificate,
    approveCertificate,
    updateCertificateStatus
} = require('../controllers/marriageCertificateController');

router.use(authenticateToken);
router.use(requireMainCommitteeAccess);

// GET  /api/organizations/:orgId/certificates/marriage
// POST /api/organizations/:orgId/certificates/marriage
router.route('/')
    .get(getCertificates)
    .post(createCertificate);

// POST /api/organizations/:orgId/certificates/marriage/:id/approve
router.post('/:id/approve', approveCertificate);

// PUT  /api/organizations/:orgId/certificates/marriage/:id/status
router.put('/:id/status', updateCertificateStatus);

module.exports = router;
