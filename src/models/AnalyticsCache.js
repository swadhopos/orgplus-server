const mongoose = require('mongoose');

const analyticsCacheSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['demographic', 'financial'],
    required: true
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  computedAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true
  },
  isDirty: {
    type: Boolean,
    default: true // Starts dirty so it computes on first request
  },
  refreshRequests: {
    type: [Date],
    default: []
  },
  isRebuilding: {
    type: Boolean,
    default: false
  },
  version: {
    type: Number,
    default: 0
  },
  hasGroups: {
    type: Boolean,
    default: false // snapshot of OrgConfig.features.hasGroups at compute time
  }
}, {
  timestamps: true
});

// Ensure one cache document per org per type
analyticsCacheSchema.index({ organizationId: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('AnalyticsCache', analyticsCacheSchema);
