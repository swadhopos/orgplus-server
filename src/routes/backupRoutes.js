const express = require('express');
const router = express.Router();
const backupController = require('../controllers/backupController');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/authorize');

// All backup routes require systemAdmin role
router.use(authenticateToken);
router.use(requireRole('systemAdmin'));

// List all backup logs
router.get('/', backupController.getBackupLogs);

// Manually trigger a backup
router.post('/run', backupController.triggerManualBackup);

module.exports = router;
