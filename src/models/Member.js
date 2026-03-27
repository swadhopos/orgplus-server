const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },

  // Unique per-org identifiers
  memberSequence: {
    type: Number,
    required: true
  },
  memberNumber: {
    type: String,
    required: true
  },


  // Identity
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    required: true
  },
  dateOfBirth: {
    type: Date
  },

  // Current residence
  currentHouseholdId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Household',
    required: false
  },

  // Relationship graph (nullable until verified)
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

  // Temporary names during data collection
  fatherNameTemp: String,
  motherNameTemp: String,
  spouseNameTemp: String,

  maritalStatus: {
    type: String,
    enum: ['single', 'married', 'divorced', 'widowed', 'separated'],
    required: true
  },

  // Contact
  mobileNumber: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    lowercase: true,
    trim: true
  },

  // Firebase Auth link — set when a committee officer login is created for this member.
  // Only president / vice-president / secretary / treasurer will have this populated.
  userId: {
    type: String,      // Firebase UID (e.g. "f8a2kj...")
    sparse: true,
    index: true,
    default: null
  },

  // FCM push tokens — one per device (PWA browser or native app).
  // Upserted by deviceId on login / token refresh. Stale tokens auto-removed by fcmService.
  fcmTokens: [{
    token: { type: String, required: true },
    deviceId: { type: String, required: true }, // browser uuid or device id
    platform: {
      type: String,
      enum: ['web', 'android', 'ios'],
      default: 'web'
    },
    browser: { type: String, default: null }, // optional: 'chrome' | 'firefox' | 'safari'
    updatedAt: { type: Date, default: Date.now }
  }],

  // Work / Education
  occupation: String,
  isWorkingAbroad: {
    type: Boolean,
    default: false
  },
  abroadCountry: String,

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
    enum: ['active', 'relocated', 'deceased', 'inactive'],
    default: 'active'
  },
  relocatedAt: Date,
  relocationReason: {
    type: String,
    enum: ['marriage', 'jobTransfer', 'migration', 'education', 'movedWithinOrganization', 'movedOutsideOrganization', 'demolition', 'unknown']
  },

  // Death information
  isDeceased: {
    type: Boolean,
    default: false
  },
  deathDate: Date,
  deathCause: String,

  // Medical Info
  medicalInfo: {
    bloodGroup: {
      type: String,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown']
    },
    allergies: [String],
    medications: [String],
    specialNeeds: String
  },

  // Verification
  isRelationshipVerified: {
    type: Boolean,
    default: false
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
memberSchema.index({ organizationId: 1, currentHouseholdId: 1, memberSequence: 1 }, { unique: true });
memberSchema.index({ organizationId: 1, currentHouseholdId: 1, isDeleted: 1 });
memberSchema.index({ fatherId: 1 });
memberSchema.index({ motherId: 1 });
memberSchema.index({ spouseId: 1 });

// Analytics Indexes
memberSchema.index({ organizationId: 1, isDeleted: 1, status: 1 });
memberSchema.index({ organizationId: 1, isDeleted: 1, createdAt: 1 });
memberSchema.index({ organizationId: 1, isDeleted: 1, dateOfBirth: 1, maritalStatus: 1 });
memberSchema.index({ organizationId: 1, isDeleted: 1, gender: 1 });
memberSchema.index({ organizationId: 1, isDeleted: 1, 'medicalInfo.bloodGroup': 1 });
memberSchema.index({ organizationId: 1, isDeleted: 1, isWorkingAbroad: 1, abroadCountry: 1 });

// Middleware to update updatedAt
memberSchema.pre('save', function (next) {
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

memberSchema.post('save', function(doc) {
  markDemographicDirty(doc);
});
memberSchema.post('findOneAndUpdate', function(doc) {
  markDemographicDirty(doc);
});

module.exports = mongoose.model('Member', memberSchema);
