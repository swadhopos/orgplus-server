const mongoose = require('mongoose');

const orgNicheTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Niche name is required'],
    unique: true,
    trim: true
  },
  key: {
    type: String,
    required: [true, 'Niche key is required'],
    unique: true,
    lowercase: true,
    trim: true,
    immutable: true
  },
  description: {
    type: String,
    trim: true
  },
  membershipModel: {
    type: String,
    required: true,
    enum: ['group_required', 'group_optional', 'individual_only']
  },
  labels: {
    groupLabel: {
      type: String,
      default: null
    },
    memberLabel: {
      type: String,
      required: true,
      default: 'Member'
    }
  },
  features: {
    hasMembers: { type: Boolean, default: true },
    hasGroups: { type: Boolean, default: true },
    hasEvents: { type: Boolean, default: false },
    hasCommittees: { type: Boolean, default: false },
    hasBMD: { type: Boolean, default: false },
    hasSubscriptions: { type: Boolean, default: false },
    hasNotices: { type: Boolean, default: false },
    hasLedger: { type: Boolean, default: false },
    hasStaff: { type: Boolean, default: false },
    hasCertificates: { type: Boolean, default: false }
  },
  subtypes: [{
    label: { type: String, required: true, trim: true },
    key: { type: String, required: true, trim: true, lowercase: true }
  }],
  suggestedColors: [{
    type: String,
    match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Please provide a valid hex color']
  }],
  financial: {
    paymentType: {
      type: String,
      enum: ['Voluntary_AdHoc', 'Mandatory_Recurring'],
      default: 'Voluntary_AdHoc'
    },
    canIssueTaxExemptions: {
      type: Boolean,
      default: false
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdByUserId: {
    type: String,
    immutable: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('OrgNicheType', orgNicheTypeSchema);
