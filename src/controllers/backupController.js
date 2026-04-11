const asyncHandler = require('express-async-handler');
const BackupLog = require('../models/BackupLog');
const backupService = require('../services/backupService');

/**
 * @desc    Get all backup logs
 * @route   GET /api/backups
 * @access  Private/Admin
 */
const getBackupLogs = asyncHandler(async (req, res) => {
  const logs = await BackupLog.find({}).sort({ startTime: -1 }).limit(50);
  res.json({
    success: true,
    count: logs.length,
    data: logs
  });
});

/**
 * @desc    Trigger manual backup
 * @route   POST /api/backups/run
 * @access  Private/Admin
 */
const triggerManualBackup = asyncHandler(async (req, res) => {
  // Trigger backup in background
  backupService.runFullBackup().catch(err => {
    console.error('[BackupController] Background backup failed:', err);
  });

  res.json({ 
    success: true,
    message: 'Backup initiated in the background' 
  });
});

module.exports = {
  getBackupLogs,
  triggerManualBackup
};
