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
    hasMembers: { type: Boolean, default: true, immutable: true }, // Core structural requirement
    hasGroups: { type: Boolean, default: true, immutable: true }, // Core structural requirement
    hasEvents: { type: Boolean, default: false, immutable: true }, // Unified Events & Fundraising
    hasCommittees: { type: Boolean, default: false, immutable: true }, // Finance & Committees
    hasBMD: { type: Boolean, default: false, immutable: true }, // Birth, Marriage, Death
    hasSubscriptions: { type: Boolean, default: false, immutable: true }, // Fees & Subscriptions
    hasNotices: { type: Boolean, default: false, immutable: true }, // Notice Board / Broadcast
    hasLedger: { type: Boolean, default: false, immutable: true }, // Basic Accounting
    hasStaff: { type: Boolean, default: false, immutable: true }, // Employee/Staff Management
    hasCertificates: { type: Boolean, default: false, immutable: true }, // Cert Generation Module
    hasMembership: { type: Boolean, default: false } // Membership Module
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
    },
    fiscalYearStartMonth: {
      type: Number,
      default: 4,
      min: 1,
      max: 12
    },
    useCalendarYear: {
      type: Boolean,
      default: false
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
