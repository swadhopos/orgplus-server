const mongoose = require('mongoose');

/**
 * Subscription Model
 * Represents the assignment of a FeePlan to a specific Member or Household.
 */

const subscriptionSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: [true, 'Organization is required'],
        index: true
    },
    planId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FeePlan',
        required: [true, 'Fee plan reference is required'],
        index: true
    },
    
    // Polymorphic Target (Household vs Member)
    targetId: {
        type: mongoose.Schema.Types.ObjectId,
        required: [true, 'Target ID is required'],
        index: true
    },
    targetType: {
        type: String,
        enum: {
            values: ['HOUSEHOLD', 'MEMBER'],
            message: '{VALUE} is not a valid target type'
        },
        required: [true, 'Target type is required']
    },
    
    billingStatus: {
        type: String,
        enum: {
            values: ['ACTIVE', 'PAST_DUE', 'CANCELED', 'UNPAID', 'COMPLETED', 'VOIDED'],
            message: '{VALUE} is not a valid billing status'
        },
        default: 'ACTIVE' // Usually ACTIVE for recurring, or ACTIVE until paid for one-time
    },
    
    startDate: {
        type: Date,
        default: Date.now
    },
    nextBillingDate: {
        type: Date,
        default: null // Will be null for ONE_TIME plans or if canceled
    },

    // Future-Proofing for Payment Gateway (e.g. Stripe)
    externalSubscriptionId: {
        type: String,
        default: null
    },
    paymentMethod: {
        type: String,
        enum: ['manual', 'stripe_card', 'stripe_ach', 'paypal', 'cash'],
        default: 'manual'
    },

    // Audit
    createdByUserId: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null }
});

// A single target should not have the same plan assigned multiple times active simultaneously 
// (unless explicitly desired, but usually we don't want duplicate active subscriptions for the exact same thing)
subscriptionSchema.index({ organizationId: 1, planId: 1, billingStatus: 1, isDeleted: 1, createdAt: -1 });

// Index for efficient daily billing queries (used by Cron)
subscriptionSchema.index({ billingStatus: 1, nextBillingDate: 1, isDeleted: 1 });

subscriptionSchema.index({ planId: 1, targetId: 1, isDeleted: 1 });

subscriptionSchema.pre('save', function (next) {
    if (!this.isNew) this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('Subscription', subscriptionSchema);
