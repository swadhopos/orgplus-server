const mongoose = require('mongoose');

const householdSchema = new mongoose.Schema({
  houseNumber: {
    type: String,
    required: true,
    trim: true
  },
  block: {
    type: String,
    trim: true
  },
  floor: {
    type: String,
    trim: true
  },
  ownerName: {
    type: String,
    required: true,
    trim: true
  },
  contactPhone: {
    type: String,
    required: true
  },
  contactEmail: {
    type: String,
    lowercase: true,
    trim: true
  },
  occupancyStatus: {
    type: String,
    enum: ['owner-occupied', 'rented', 'vacant'],
    default: 'owner-occupied'
  },
  userId: {
    type: String,  // Firebase user ID
    sparse: true
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
householdSchema.index({ organizationId: 1, isDeleted: 1 });
householdSchema.index({ userId: 1 });
householdSchema.index({ houseNumber: 1, organizationId: 1 });

// Middleware to update updatedAt
householdSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Household', householdSchema);
