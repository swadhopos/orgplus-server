const mongoose = require('mongoose');
const paymentSchema = require('./schemas/payment.schema');
const auditSchema = require('./schemas/audit.schema');

/**
 * Transaction Model — Shared financial primitive
 *
 * Single source of truth for all money movement across
 * Ledger, Event, Fundraiser, and Subscription modules.
 *
 * Payment details are grouped in the embedded `payment` sub-doc.
 * Audit trail (who created/updated/deleted and when) lives in `audit`.
 *
 * Double-entry fields (debitAccount, creditAccount, journalEntryId)
 * are nullable — populate them during a future migration without
 * breaking existing simple income/expense records.
 */

const transactionSchema = new mongoose.Schema({

    // ── Organisation scope ─────────────────────────────────────────
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: [true, 'Organization ID is required'],
        index: true
    },

    // ── Polymorphic source ─────────────────────────────────────────
    // Which module owns this transaction
    sourceType: {
        type: String,
        enum: {
            values: ['ledger', 'event', 'fundraiser', 'subscription'],
            message: '{VALUE} is not a valid source type'
        },
        required: [true, 'Source type is required'],
        index: true
    },
    sourceId: {
        type: mongoose.Schema.Types.ObjectId,
        required: [true, 'Source ID is required'],
        index: true
    },

    // ── Category ───────────────────────────────────────────────────
    // Structured reference to the org's Category collection
    categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        default: null   // nullable — allow uncategorized transactions
    },
    // Denormalized name snapshot — for reports/lists without .populate()
    categorySnapshot: {
        type: String,
        trim: true,
        maxlength: [100, 'Category snapshot cannot exceed 100 characters'],
        default: null
    },

    // ── Member / Household linkage ─────────────────────────────────
    // Optional — tie this transaction to an individual or a household.
    // Set ONE at most; leave both null for general org-level transactions.
    memberId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Member',
        default: null
    },
    householdId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Household',
        default: null
    },

    // ── Core fields ────────────────────────────────────────────────
    type: {
        type: String,
        enum: {
            values: ['income', 'expense', 'invoice'], // added 'invoice' for unpaid subscription dues
            message: '{VALUE} is not a valid transaction type'
        },
        required: [true, 'Transaction type is required']
    },
    amount: {
        type: Number,
        required: [true, 'Amount is required'],
        min: [0, 'Amount must be greater than or equal to 0']
    },
    currency: {
        type: String,
        default: 'INR',
        uppercase: true,
        trim: true,
        maxlength: [10, 'Currency code cannot exceed 10 characters']
    },
    // The effective date of the transaction (shown in ledger / reports)
    date: {
        type: Date,
        required: [true, 'Transaction date is required'],
        default: Date.now
    },
    // Computed at invoice creation from plan.dueDate (ONE_TIME)
    // or plan.gracePeriodDays (RECURRING). Null for non-invoice transactions.
    dueDate: {
        type: Date,
        default: null,
        index: true
    },
    description: {
        type: String,
        trim: true,
        maxlength: [500, 'Description cannot exceed 500 characters'],
        default: null
    },
    status: {
        type: String,
        enum: {
            values: ['pending', 'completed', 'cancelled', 'reversed', 'voided', 'unpaid', 'partially_paid'],
            message: '{VALUE} is not a valid status'
        },
        default: 'completed'
    },
    
    // ── Future-Proofing for Payment Gateway ────────────────────────
    externalTransactionId: {
        type: String,
        default: null
    },

    // ── Void details ───────────────────────────────────────────────
    // Populated when status is set to 'voided'. Never deleted — audit compliant.
    voidReason: {
        type: String,
        trim: true,
        maxlength: [500, 'Void reason cannot exceed 500 characters'],
        default: null
    },
    voidedAt: {
        type: Date,
        default: null
    },
    voidedByUserId: {
        type: String,
        default: null
    },

    // ── Period tracking ───────────────────────────────────────────
    // Optional — for recurring subscriptions (e.g., '2024-03', '2024-W12')
    billingPeriod: {
        type: String,
        trim: true,
        index: true,
        default: null
    },

    // ── Payment details (embedded) ─────────────────────────────────
    // method, referenceNumber, attachmentUrl, paidAt, receivedByUserId, notes
    payment: {
        type: paymentSchema,
        default: () => ({})   // always present; inner fields are all optional
    },

    // ── Double-entry fields (nullable — future migration) ──────────
    // Leave null for simple mode; populate during double-entry upgrade
    debitAccount: { type: String, default: null, trim: true },
    creditAccount: { type: String, default: null, trim: true },
    journalEntryId: { type: mongoose.Schema.Types.ObjectId, default: null },

    // ── Audit ──────────────────────────────────────────────────────
    // create / update / soft-delete trail + change history
    audit: {
        type: auditSchema,
        default: () => ({})
    }

});

// ── Indexes ────────────────────────────────────────────────────────
// Index for efficient payment reminder queries (9 AM Cron)
transactionSchema.index({ type: 1, status: 1, 'audit.isDeleted': 1, date: 1 });

/**
 * Common Indexes for lookup and reporting
 */
transactionSchema.index({ sourceType: 1, sourceId: 1 });
transactionSchema.index({ organizationId: 1, date: -1 });
transactionSchema.index({ organizationId: 1, type: 1 });
transactionSchema.index({ organizationId: 1, categoryId: 1 });
transactionSchema.index({ organizationId: 1, memberId: 1 });
transactionSchema.index({ organizationId: 1, householdId: 1 });
transactionSchema.index({ 
    sourceId: 1, 
    organizationId: 1, 
    billingPeriod: 1, 
    'audit.isDeleted': 1 
});
transactionSchema.index({ 'audit.isDeleted': 1 });

// ── Middleware ─────────────────────────────────────────────────────
transactionSchema.pre('save', function (next) {
    if (!this.isNew) {
        this.audit.updatedAt = new Date();
    }
    next();
});

transactionSchema.pre('findOneAndUpdate', function (next) {
    this.set({ 'audit.updatedAt': new Date() });
    next();
});

// ── Instance methods ───────────────────────────────────────────────

transactionSchema.methods.softDelete = function (userId, reason = null) {
    this.audit.isDeleted = true;
    this.audit.deletedAt = new Date();
    this.audit.deletedByUserId = userId;
    this.audit.deletionReason = reason;
    this.audit.history.push({ action: 'deleted', byUserId: userId, note: reason });
    return this.save();
};

transactionSchema.methods.voidTransaction = function (userId, reason) {
    this.status = 'voided';
    this.voidReason = reason || 'No reason provided';
    this.voidedAt = new Date();
    this.voidedByUserId = userId;
    this.audit.updatedByUserId = userId;
    this.audit.updatedAt = new Date();
    this.audit.history.push({ action: 'voided', byUserId: userId, note: reason });
    return this.save();
};

transactionSchema.methods.restore = function (userId) {
    this.audit.isDeleted = false;
    this.audit.deletedAt = null;
    this.audit.deletedByUserId = null;
    this.audit.deletionReason = null;
    this.audit.restoredByUserId = userId;
    this.audit.restoredAt = new Date();
    this.audit.history.push({ action: 'restored', byUserId: userId });
    return this.save();
};

// ── Static helpers ─────────────────────────────────────────────────

transactionSchema.statics.findActive = function (filter = {}) {
    return this.find({ ...filter, 'audit.isDeleted': false });
};

transactionSchema.statics.findBySource = function (sourceType, sourceId) {
    return this.find({ sourceType, sourceId, 'audit.isDeleted': false });
};

transactionSchema.statics.findByMember = function (organizationId, memberId) {
    return this.find({ organizationId, memberId, 'audit.isDeleted': false }).sort({ date: -1 });
};

transactionSchema.statics.findByHousehold = function (organizationId, householdId) {
    return this.find({ organizationId, householdId, 'audit.isDeleted': false }).sort({ date: -1 });
};

// Summarize income / expense totals — excludes voided & soft-deleted
transactionSchema.statics.summarizeBySource = function (sourceType, sourceId) {
    return this.aggregate([
        {
            $match: {
                sourceType,
                sourceId: new mongoose.Types.ObjectId(sourceId),
                'audit.isDeleted': false,
                status: { $in: ['completed', 'pending'] }
            }
        },
        {
            $group: {
                _id: '$type',
                total: { $sum: '$amount' }
            }
        }
    ]);
};

const Transaction = mongoose.model('Transaction', transactionSchema);
module.exports = Transaction;
