const express = require('express');
const router = express.Router({ mergeParams: true });
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/authorize');

const {
    getSettings,
    updateSettings
} = require('../controllers/orgSettingsController');

router.use(authenticateToken);

// GET /api/organizations/:orgId/settings
router.get('/', getSettings);

// PUT /api/organizations/:orgId/settings
router.put('/', requireRole('admin', 'systemAdmin'), updateSettings);

module.exports = router;
