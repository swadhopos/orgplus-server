const mongoose = require('mongoose');

/**
 * LegalContent Model
 * Stores boilerplate and organization-specific legal documents and FAQs.
 */

const legalContentSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    default: null, // null means global/system-wide default
    index: true
  },

  type: {
    type: String,
    enum: ['tos', 'privacy', 'faq', 'support'],
    required: true,
    index: true
  },

  title: {
    type: String,
    required: true,
    trim: true
  },

  content: {
    type: String,
    required: true,
    trim: true
  },

  isActive: {
    type: Boolean,
    default: true,
    index: true
  },

  updatedBy: {
    type: String, // Firebase UID
    default: 'system'
  }
}, {
  timestamps: true
});

// Index for quick lookup of active content by type and org
legalContentSchema.index({ type: 1, organizationId: 1, isActive: 1 });

module.exports = mongoose.model('LegalContent', legalContentSchema);
