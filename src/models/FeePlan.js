const mongoose = require('mongoose');

/**
 * FeePlan Model
 * Represents a template for a one-time fee or recurring subscription that can be assigned to households or members.
 */

const feePlanSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: [true, 'Organization is required'],
        index: true
    },
    name: {
        type: String,
        required: [true, 'Plan name is required'],
        trim: true,
        maxlength: [100, 'Plan name cannot exceed 100 characters']
    },
    description: {
        type: String,
        trim: true,
        maxlength: [500, 'Description cannot exceed 500 characters'],
        default: null
    },
    amount: {
        type: Number,
        required: [true, 'Amount is required'],
        min: [0, 'Amount cannot be negative']
    },
    currency: {
        type: String,
        default: 'INR',
        uppercase: true,
        trim: true
    },
    type: {
        type: String,
        enum: {
            values: ['ONE_TIME', 'RECURRING'],
            message: '{VALUE} is not a valid plan type'
        },
        required: [true, 'Plan type is required']
    },
    frequency: {
        type: String,
        enum: {
            values: ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', null],
            message: '{VALUE} is not a valid frequency'
        },
        default: null,
        validate: {
            validator: function(v) {
                // If type is RECURRING, frequency must be provided
                if (this.type === 'RECURRING') {
                    return v != null;
                }
                return true;
            },
            message: 'Frequency is required for recurring plans'
        }
    },
    targetAudience: {
        type: String,
        enum: {
            values: ['HOUSEHOLD', 'MEMBER'],
            message: '{VALUE} is not a valid target audience'
        },
        required: [true, 'Target audience is required']
    },
    applyToAll: {
        type: Boolean,
        default: false,
        description: 'If true, this plan is assigned to all existing and future records of the targetAudience'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    linkedCapacityCategoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CapacityCategory',
        default: null,
        description: 'If set, this plan will attempt to use the override amount from the target (household/member) for this capacity category.'
    },
    autoCloseWhenPaid: {
        type: Boolean,
        default: false,
        description: 'If true, the plan will automatically deactivate when all assigned targets have paid'
    },
    
    // Future-Proofing for Payment Gateway (e.g. Stripe)
    externalProductId: {
        type: String,
        default: null
    },
    externalPriceId: {
        type: String,
        default: null
    },

    // Audit
    createdByUserId: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null }
});

feePlanSchema.index({ organizationId: 1, isDeleted: 1 });

feePlanSchema.pre('save', function (next) {
    if (!this.isNew) this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('FeePlan', feePlanSchema);
