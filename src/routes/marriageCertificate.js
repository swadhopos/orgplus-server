const express = require('express');
const router = express.Router({ mergeParams: true });
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/authorize');

const {
    getCertificates,
    createCertificate,
    approveCertificate,
    updateCertificateStatus
} = require('../controllers/marriageCertificateController');

router.use(authenticateToken);

// GET  /api/organizations/:orgId/certificates/marriage
// POST /api/organizations/:orgId/certificates/marriage
router.route('/')
    .get(getCertificates)
    .post(requireRole('admin', 'systemAdmin'), createCertificate);

// POST /api/organizations/:orgId/certificates/marriage/:id/approve
router.post('/:id/approve', approveCertificate);

// PUT  /api/organizations/:orgId/certificates/marriage/:id/status
router.put('/:id/status', requireRole('admin', 'systemAdmin'), updateCertificateStatus);

module.exports = router;
