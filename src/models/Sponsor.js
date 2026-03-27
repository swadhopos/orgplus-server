const mongoose = require('mongoose');

/**
 * Sponsor Model
 * Represents a financial or in-kind commitment toward an Event (and later, Fundraisers).
 */

const sponsorSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: [true, 'Organization is required'],
        index: true
    },
    eventId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
        default: null,
        index: true
    },
    fundraiserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Fundraiser',
        default: null,
        index: true
    },

    // ── Sponsor Identification ──
    sponsorType: {
        type: String,
        enum: {
            values: ['member', 'household', 'external'],
            message: '{VALUE} is not a valid sponsor type'
        },
        required: [true, 'Sponsor type is required']
    },
    // If sponsorType === 'member'
    memberId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Member',
        default: null
    },
    // If sponsorType === 'household'
    householdId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Household',
        default: null
    },
    // If sponsorType === 'external'
    externalName: {
        type: String,
        trim: true,
        maxlength: [200, 'External name cannot exceed 200 characters'],
        default: null
    },
    // Who brought this external sponsor in? (Optional)
    careOfMemberId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Member',
        default: null
    },

    // ── Contact Info (Primarily for external, but can be used generally) ──
    contactPerson: {
        type: String,
        trim: true,
        maxlength: [200, 'Contact person name cannot exceed 200 characters'],
        default: null
    },
    contactPhone: {
        type: String,
        trim: true,
        maxlength: [20, 'Contact phone cannot exceed 20 characters'],
        default: null
    },
    contactEmail: {
        type: String,
        trim: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
        default: null
    },

    // ── Contribution Details ──
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
    type: { // Contribution type (cash, in-kind, etc.)
        type: String,
        enum: {
            values: ['cash', 'in_kind', 'service'],
            message: '{VALUE} is not a valid contribution type'
        },
        default: 'cash'
    },
    status: {
        type: String,
        enum: {
            values: ['confirmed', 'pending', 'cancelled', 'voided'],
            message: '{VALUE} is not a valid sponsor status'
        },
        default: 'confirmed'
    },
    notes: {
        type: String,
        trim: true,
        maxlength: [500, 'Notes cannot exceed 500 characters'],
        default: null
    },
    voidReason: {
        type: String,
        trim: true,
        maxlength: [500, 'Void reason cannot exceed 500 characters'],
        default: null
    },
    voidedAt: { type: Date, default: null },
    voidedByUserId: { type: String, default: null },

    // ── Audit ──
    createdByUserId: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null }
});

sponsorSchema.index({ eventId: 1, isDeleted: 1 });

sponsorSchema.pre('save', function (next) {
    if (!this.isNew) this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('Sponsor', sponsorSchema);
