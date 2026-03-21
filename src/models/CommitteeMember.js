const mongoose = require('mongoose');

const committeeMemberSchema = new mongoose.Schema({
  committeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Committee',
    required: true
  },
  memberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Member',
    required: function () { return !this.isExternal; }
  },
  isExternal: {
    type: Boolean,
    default: false
  },
  externalMemberName: {
    type: String,
    required: function () { return this.isExternal; }
  },
  externalMemberPhone: {
    type: String
  },
  role: {
    type: String,
    enum: ['president', 'vice-president', 'secretary', 'treasurer', 'member'],
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
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
committeeMemberSchema.index({ committeeId: 1, organizationId: 1, status: 1 });
committeeMemberSchema.index({ memberId: 1 });


// Middleware to update updatedAt
committeeMemberSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('CommitteeMember', committeeMemberSchema);
