const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  dateOfBirth: {
    type: Date,
    required: true
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    required: true
  },
  householdId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Household',
    required: true
  },
  relationshipType: {
    type: String,
    enum: ['head', 'spouse', 'child', 'parent', 'sibling', 'other'],
    required: true
  },
  // Relationship references
  fatherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Member'
  },
  motherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Member'
  },
  spouseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Member'
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
memberSchema.index({ organizationId: 1, householdId: 1, isDeleted: 1 });
memberSchema.index({ fatherId: 1 });
memberSchema.index({ motherId: 1 });
memberSchema.index({ spouseId: 1 });

// Middleware to update updatedAt
memberSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Member', memberSchema);
