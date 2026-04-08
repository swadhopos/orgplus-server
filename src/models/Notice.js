const mongoose = require('mongoose');

/**
 * Notice Model
 * Represents a notice published to org members via the notice board and FCM push.
 */

const noticeSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  
  expiresAt: {
    type: Date,
    default: null,
    index: true
  },

  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },

  body: {
    type: String,
    required: true,
    trim: true,
    maxlength: [5000, 'Body cannot exceed 5000 characters']
  },

  // Optional image — stored via the IStorageProvider (default: Cloudflare R2)
  imageUrl: {
    type: String,
    default: null
  },
  imageKey: {
    type: String,
    default: null  // Storage key for deletion
  },

  // Lifecycle
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft',
    index: true
  },
  publishedAt: {
    type: Date,
    default: null
  },

  /**
   * Audience targeting
   *
   * Topic-based (FCM subscribes automatically on app login):
   *   all           → FCM topic: notices_all
   *   ward          → FCM topic: ward_{wardId}  (targetIds = [wardId, ...])
   *   household     → FCM topic: household_{householdId} (targetIds = [...])
   *
   * Token-batch (server resolves members at publish time):
   *   committee             → CommitteeMember -> Member.fcmTokens
   *   payment_monthly       → Subscription(ACTIVE, MONTHLY plan) -> Member.fcmTokens
   *   payment_recurring     → Subscription(ACTIVE, RECURRING plan) -> Member.fcmTokens
   *   payment_lapsed        → Subscription(PAST_DUE | UNPAID) -> Member.fcmTokens
   */
  audienceType: {
    type: String,
    enum: [
      'all',
      'ward',
      'household',
      'committee',
      'payment_monthly',
      'payment_recurring',
      'payment_lapsed'
    ],
    required: true,
    default: 'all'
  },

  // Used for ward / household / committee targeting
  targetIds: {
    type: [mongoose.Schema.Types.ObjectId],
    default: []
  },

  // Audit
  createdByUserId: {
    type: String,
    required: true
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },

  // Soft delete
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date, default: null },
  deletedByUserId: { type: String, default: null }
});

// Indexes
noticeSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
noticeSchema.index({ organizationId: 1, isDeleted: 1, createdAt: -1 });

noticeSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Notice', noticeSchema);
