const mongoose = require('mongoose');

/**
 * Event Model
 *
 * Represents an org-scoped event (festival, ceremony, sports day, etc.)
 * Pledges and Sponsors are stored in separate collections and
 * reference this event via `eventId` for independent pagination.
 * Financial transactions reference it via sourceType='event', sourceId=event._id.
 */

const eventSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: [true, 'Organization is required'],
        index: true
    },

    // ── Core ────────────────────────────────────────────────────────────────
    eventSequence: {
        type: Number,
        required: true
    },
    name: {
        type: String,
        required: [true, 'Event name is required'],
        trim: true,
        minlength: [2, 'Event name must be at least 2 characters'],
        maxlength: [200, 'Event name cannot exceed 200 characters']
    },
    description: {
        type: String,
        trim: true,
        maxlength: [1000, 'Description cannot exceed 1000 characters'],
        default: null
    },
    type: {
        type: String,
        enum: {
            values: ['general', 'cultural', 'sports', 'religious', 'community', 'other'],
            message: '{VALUE} is not a valid event type'
        },
        default: 'general'
    },
    status: {
        type: String,
        enum: {
            values: ['upcoming', 'ongoing', 'completed', 'cancelled'],
            message: '{VALUE} is not a valid event status'
        },
        default: 'upcoming'
    },
    visibility: {
        type: String,
        enum: {
            values: ['public', 'internal'],
            message: '{VALUE} is not a valid visibility'
        },
        default: 'public'
    },

    // ── Schedule ─────────────────────────────────────────────────────────────
    startDate: {
        type: Date,
        required: [true, 'Start date is required']
    },
    endDate: {
        type: Date,
        default: null
    },
    startTime: {
        type: String, // e.g. '09:00'
        default: null
    },
    endTime: {
        type: String, // e.g. '17:00'
        default: null
    },
    location: {
        type: String,
        trim: true,
        maxlength: [300, 'Location cannot exceed 300 characters'],
        default: null
    },

    // ── Budget ───────────────────────────────────────────────────────────────
    budget: {
        type: Number,
        default: null,
        min: [0, 'Budget cannot be negative']
    },
    currency: {
        type: String,
        default: 'INR',
        uppercase: true,
        trim: true,
        maxlength: [10, 'Currency code cannot exceed 10 characters']
    },

    // ── Committee link (the Committee's eventId points back to this) ──────────
    committeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Committee',
        default: null
    },

    // ── Payment ──────────────────────────────────────────────────────────────
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
eventSchema.index({ organizationId: 1, isDeleted: 1 });
eventSchema.index({ organizationId: 1, status: 1 });
eventSchema.index({ organizationId: 1, startDate: -1 });

// ── Middleware ────────────────────────────────────────────────────────────────
eventSchema.pre('save', function (next) {
    if (!this.isNew) this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('Event', eventSchema);
