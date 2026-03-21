const mongoose = require('mongoose');

const orgConfigSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    unique: true,
    immutable: true
  },
  nicheTypeKey: {
    type: String,
    required: true,
    immutable: true
  },
  membershipModel: {
    type: String,
    required: true,
    enum: ['group_required', 'group_optional', 'individual_only'],
    immutable: true
  },
  labels: {
    groupLabel: {
      type: String,
      default: null,
      immutable: true
    },
    memberLabel: {
      type: String,
      required: true,
      immutable: true
    }
  },
  features: {
    hasGroups: { type: Boolean, default: true, immutable: true },
    hasCommittees: { type: Boolean, default: true, immutable: true },
    hasSponsorships: { type: Boolean, default: false, immutable: true },
    hasNOCIssuance: { type: Boolean, default: false, immutable: true },
    hasEventRSVP: { type: Boolean, default: false, immutable: true },
    hasBroadcast: { type: Boolean, default: false, immutable: true },
    hasMembershipExpiry: { type: Boolean, default: false, immutable: true },
    hasDuesAutoGeneration: { type: Boolean, default: false, immutable: true },
    hasDeathRegister: { type: Boolean, default: false, immutable: true },
    hasMarriageCertificate: { type: Boolean, default: false, immutable: true },
    hasMarriageNOC: { type: Boolean, default: false, immutable: true },
    hasLedger: { type: Boolean, default: true, immutable: true },
    hasCalendar: { type: Boolean, default: true, immutable: true },
    hasMeetings: { type: Boolean, default: true, immutable: true },
    hasNotices: { type: Boolean, default: true, immutable: true },
    hasStaff: { type: Boolean, default: true, immutable: true }
  },
  financial: {
    paymentType: {
      type: String,
      enum: ['Voluntary_AdHoc', 'Mandatory_Recurring'],
      default: 'Voluntary_AdHoc',
      immutable: true
    },
    canIssueTaxExemptions: {
      type: Boolean,
      default: false,
      immutable: true
    }
  },
  idFormat: {
    format: {
      type: String,
      enum: ['group_member', 'member_only'],
      required: true,
      immutable: true
    }
  },
  createdByUserId: {
    type: String,
    immutable: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('OrgConfig', orgConfigSchema);
