const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  committeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Committee',
    required: true
  },
  meetingDate: {
    type: Date,
    required: true
  },
  startTime: {
    type: String, // 'HH:mm' format
    default: null
  },
  endTime: {
    type: String, // 'HH:mm' format
    default: null
  },
  location: {
    type: String,
    required: true,
    trim: true
  },
  agenda: [{
    topic: {
      type: String,
      required: true
    },
    presenter: String,
    status: {
      type: String,
      enum: ['pending', 'discussed', 'deferred'],
      default: 'pending'
    }
  }],
  minutes: [{
    content: {
      type: String,
      required: true
    },
    actionItems: [String],
    loggedAt: {
      type: Date,
      default: Date.now
    }
  }],
  attendanceFinalized: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['scheduled', 'completed', 'cancelled'],
    default: 'scheduled'
  },
  visibility: {
    type: String,
    enum: ['public', 'internal'],
    default: 'internal'
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
meetingSchema.index({ committeeId: 1, organizationId: 1 });
meetingSchema.index({ meetingDate: 1 });

// Middleware to update updatedAt
meetingSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Meeting', meetingSchema);
