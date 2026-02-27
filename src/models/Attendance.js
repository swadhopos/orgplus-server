const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  meetingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Meeting',
    required: true
  },
  committeeMemberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CommitteeMember',
    required: true
  },
  attendanceStatus: {
    type: String,
    enum: ['present', 'absent', 'excused'],
    required: true
  },
  remarks: {
    type: String,
    trim: true
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  // Audit fields
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  createdByUserId: {
    type: String,
    required: true
  }
});

// Indexes
attendanceSchema.index({ meetingId: 1, organizationId: 1 });
attendanceSchema.index({ committeeMemberId: 1 });

// Middleware to update updatedAt
attendanceSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Attendance', attendanceSchema);
