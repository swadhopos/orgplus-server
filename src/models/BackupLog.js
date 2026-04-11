const mongoose = require('mongoose');

/**
 * BackupLog Model
 * Tracks the history and status of automated R2 backups.
 */
const backupLogSchema = new mongoose.Schema({
  env: {
    type: String,
    enum: ['dev', 'prod'],
    required: true,
    index: true
  },

  backupId: {
    type: String,
    required: true,
    unique: true
  },

  path: {
    type: String,
    required: true
  },

  status: {
    type: String,
    enum: ['running', 'success', 'failed'],
    default: 'running',
    index: true
  },

  totalSize: {
    type: Number, // Total size in bytes
    default: 0
  },

  collectionStats: [{
    name: { type: String, required: true },
    size: { type: Number, default: 0 },
    status: { type: String, enum: ['success', 'failed'], default: 'success' },
    error: { type: String, default: null }
  }],

  errorMessage: {
    type: String,
    default: null
  },

  startTime: {
    type: Date,
    default: Date.now
  },

  endTime: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Auto-expire logs after 30 days (optional, independent of R2 retention)
backupLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

module.exports = mongoose.model('BackupLog', backupLogSchema);
