const mongoose = require('mongoose');
const auditSchema = require('./schemas/audit.schema');

/**
 * Ledger Model
 *
 * Represents a named financial book for an organization.
 * Multiple ledgers can exist per org (e.g. "General Fund 2024",
 * "Building Maintenance Fund", "Welfare Fund").
 *
 * Transactions are NOT embedded — they reference this ledger
 * via Transaction.sourceType = 'ledger' and Transaction.sourceId = ledger._id
 *
 * Computed balances (totalIncome, totalExpense, balance) should be
 * derived via Transaction.summarizeBySource() — not stored here —
 * to avoid sync issues. Cache them in a separate reporting layer if needed.
 */

const ledgerSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: [true, 'Organization ID is required'],
        index: true
    },

    name: {
        type: String,
        required: [true, 'Ledger name is required'],
        trim: true,
        minlength: [2, 'Ledger name must be at least 2 characters'],
        maxlength: [200, 'Ledger name cannot exceed 200 characters']
        // e.g. "General Fund 2024-25", "Building Maintenance Fund"
    },
    description: {
        type: String,
        trim: true,
        maxlength: [500, 'Description cannot exceed 500 characters']
    },

    // Fiscal period — optional, useful for annual ledgers
    fiscalYearStart: {
        type: Date,
        default: null
    },
    fiscalYearEnd: {
        type: Date,
        default: null
    },

    // Opening balance carried forward from previous period
    openingBalance: {
        type: Number,
        default: 0,
        min: [0, 'Opening balance cannot be negative']
    },
    currency: {
        type: String,
        default: 'INR',
        uppercase: true,
        trim: true,
        maxlength: [10, 'Currency code cannot exceed 10 characters']
    },

    status: {
        type: String,
        enum: {
            values: ['open', 'closed', 'archived'],
            message: '{VALUE} is not a valid ledger status'
        },
        default: 'open'
        // closed = finalized for the period; archived = hidden from UI
    },

    // ── Audit ──────────────────────────────────────────────────────
    audit: {
        type: auditSchema,
        default: () => ({})
    }
});

// An org can have many ledgers, but names must be unique per org (non-deleted)
ledgerSchema.index(
    { organizationId: 1, name: 1 },
    { unique: true, partialFilterExpression: { 'audit.isDeleted': false } }
);
ledgerSchema.index({ organizationId: 1, status: 1 });
ledgerSchema.index({ 'audit.isDeleted': 1 });

// ── Middleware ─────────────────────────────────────────────────────
ledgerSchema.pre('save', function (next) {
    if (!this.isNew) this.audit.updatedAt = new Date();
    next();
});

ledgerSchema.pre('findOneAndUpdate', function (next) {
    this.set({ 'audit.updatedAt': new Date() });
    next();
});

// ── Instance methods ───────────────────────────────────────────────
ledgerSchema.methods.softDelete = function (userId, reason = null) {
    this.audit.isDeleted = true;
    this.audit.deletedAt = new Date();
    this.audit.deletedByUserId = userId;
    this.audit.deletionReason = reason;
    this.audit.history.push({ action: 'deleted', byUserId: userId, note: reason });
    return this.save();
};

// ── Analytics Cache Invalidation ───────────────────────────────────
const markFinancialDirty = (doc) => {
    if (doc && doc.organizationId) {
        const analyticsCacheService = require('../services/analyticsCacheService');
        setImmediate(() => {
            analyticsCacheService.markDirty(doc.organizationId, 'financial').catch(err => {
                console.error('[Analytics] Error marking financial cache dirty for org:', doc.organizationId, err);
            });
        });
    }
};

ledgerSchema.post('save', function(doc) { markFinancialDirty(doc); });
ledgerSchema.post('findOneAndUpdate', function(doc) { markFinancialDirty(doc); });

// ── Static helpers ─────────────────────────────────────────────────
ledgerSchema.statics.findActive = function (filter = {}) {
    return this.find({ ...filter, 'audit.isDeleted': false });
};

ledgerSchema.statics.findByOrg = function (organizationId) {
    return this.find({ organizationId, 'audit.isDeleted': false }).sort({ 'audit.createdAt': -1 });
};

const Ledger = mongoose.model('Ledger', ledgerSchema);
module.exports = Ledger;
