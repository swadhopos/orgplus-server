const mongoose = require('mongoose');

/**
 * Fundraiser Model
 *
 * Represents an org-scoped fundraising campaign with a specific financial goal.
 * Pledges are stored in the Sponsor collection (linked via fundraiserId).
 * Financial transactions reference it via sourceType='fundraiser', sourceId=fundraiser._id.
 */

const fundraiserSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: [true, 'Organization is required'],
        index: true
    },

    // ── Core ────────────────────────────────────────────────────────────────
    name: {
        type: String,
        required: [true, 'Fundraiser name is required'],
        trim: true,
        minlength: [2, 'Fundraiser name must be at least 2 characters'],
        maxlength: [200, 'Fundraiser name cannot exceed 200 characters']
    },
    description: {
        type: String,
        trim: true,
        maxlength: [2000, 'Description cannot exceed 2000 characters'],
        default: null
    },
    type: {
        type: String,
        required: [true, 'Fundraiser type is required'],
        trim: true,
        default: 'Other'
    },
    status: {
        type: String,
        enum: {
            values: ['active', 'completed', 'cancelled', 'paused'],
            message: '{VALUE} is not a valid fundraiser status'
        },
        default: 'active'
    },
    visibility: {
        type: String,
        enum: {
            values: ['public', 'internal'],
            message: '{VALUE} is not a valid visibility'
        },
        default: 'public'
    },

    // ── Goals ─────────────────────────────────────────────────────────────
    goalAmount: {
        type: Number,
        required: [true, 'Goal amount is required'],
        min: [1, 'Goal amount must be at least 1']
    },
    currency: {
        type: String,
        default: 'INR',
        uppercase: true,
        trim: true,
        maxlength: [10, 'Currency code cannot exceed 10 characters']
    },
    startDate: {
        type: Date,
        required: [true, 'Start date is required'],
        default: Date.now
    },
    endDate: {
        type: Date,
        default: null
    },

    // ── Related ─────────────────────────────────────────────────────────────
    committeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Committee',
        default: null
    },

    // ── Payment ─────────────────────────────────────────────────────────────
    upiAddress: {
        type: String,
        trim: true,
        default: null
    },

    // ── Audit ─────────────────────────────────────────────────────────────────
    createdByUserId: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedByUserId: { type: String, default: null }
});

// ── Indexes ──────────────────────────────────────────────────────────────────
fundraiserSchema.index({ organizationId: 1, isDeleted: 1 });
fundraiserSchema.index({ organizationId: 1, status: 1 });
fundraiserSchema.index({ organizationId: 1, startDate: -1 });

// ── Middleware ────────────────────────────────────────────────────────────────
fundraiserSchema.pre('save', function (next) {
    if (!this.isNew) this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('Fundraiser', fundraiserSchema);
