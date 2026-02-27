const mongoose = require('mongoose');

const committeeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    enum: ['managing', 'sports', 'cultural', 'maintenance', 'other'],
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'dissolved'],
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
  },
  // Soft delete
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date,
  deletedByUserId: String
});

// Indexes
committeeSchema.index({ organizationId: 1, isDeleted: 1 });
committeeSchema.index({ name: 1, organizationId: 1 });

// Middleware to update updatedAt
committeeSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Committee', committeeSchema);
