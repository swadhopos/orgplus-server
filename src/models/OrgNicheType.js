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
    hasGroups: { type: Boolean, default: true },
    hasCommittees: { type: Boolean, default: true },
    hasSponsorships: { type: Boolean, default: false },
    hasNOCIssuance: { type: Boolean, default: false },
    hasEventRSVP: { type: Boolean, default: false },
    hasBroadcast: { type: Boolean, default: false },
    hasMembershipExpiry: { type: Boolean, default: false },
    hasDuesAutoGeneration: { type: Boolean, default: false },
    hasDeathRegister: { type: Boolean, default: false },
    hasMarriageCertificate: { type: Boolean, default: false },
    hasMarriageNOC: { type: Boolean, default: false },
    hasLedger: { type: Boolean, default: true },
    hasCalendar: { type: Boolean, default: true },
    hasMeetings: { type: Boolean, default: true },
    hasNotices: { type: Boolean, default: true },
    hasStaff: { type: Boolean, default: true }
  },
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
