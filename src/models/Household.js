const mongoose = require('mongoose');

const householdSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  // Area hierarchy (optional)
  regionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Region'
  },
  zoneId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Zone'
  },

  // Address
  houseName: {
    type: String,
    required: true,
    trim: true
  },
  houseNumber: {
    type: String,
    trim: true
  },
  memberCounter: {
    type: Number,
    default: 0
  },
  addressLine1: {
    type: String,
    trim: true
  },
  addressLine2: {
    type: String,
    trim: true
  },
  postalCode: {
    type: String,
    trim: true
  },

  // Head of household
  headMemberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Member'
  },

  // Contact
  primaryMobile: {
    type: String,
    trim: true
  },
  financialStatus: {
    type: String,
    enum: ['APL', 'BPL', 'None'],
    default: 'None'
  },

  // Capacity Overrides (Pricing)
  capacityOverrides: [{
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CapacityCategory',
      required: true
    },
    tierId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false // Optional if using customAmount
    },
    customAmount: {
      type: Number,
      required: false,
      min: 0
    }
  }],

  // Lifecycle
  status: {
    type: String,
    enum: ['active', 'relocated', 'inactive', 'archived'],
    default: 'active'
  },
  relocatedAt: {
    type: Date
  },
  relocationReason: {
    type: String,
    enum: ['movedWithinOrganization', 'movedOutsideOrganization', 'migration', 'demolition', 'unknown']
  },
  relocationNotes: {
    type: String
  },

  // Soft delete
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date,
  deletedByUserId: String,
  deletionReason: String,

  // Audit
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
householdSchema.index({ organizationId: 1, isDeleted: 1 });
householdSchema.index({ headMemberId: 1 });
householdSchema.index({ houseName: 1, organizationId: 1 });

// Analytics Indexes
householdSchema.index({ organizationId: 1, isDeleted: 1, status: 1 });
householdSchema.index({ organizationId: 1, isDeleted: 1, financialStatus: 1 });

// Middleware to update updatedAt
householdSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

// Analytics Cache Invalidation
const markDemographicDirty = (doc) => {
  if (doc && doc.organizationId) {
    const analyticsCacheService = require('../services/analyticsCacheService');
    setImmediate(() => {
      analyticsCacheService.markDirty(doc.organizationId, 'demographic').catch(err => {
        console.error('[Analytics] Error marking demographic cache dirty for org:', doc.organizationId, err);
      });
    });
  }
};

householdSchema.post('save', function(doc) { markDemographicDirty(doc); });
householdSchema.post('findOneAndUpdate', function(doc) { markDemographicDirty(doc); });

module.exports = mongoose.model('Household', householdSchema);
