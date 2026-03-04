const mongoose = require('mongoose');
const auditSchema = require('./schemas/audit.schema');

/**
 * Category Model
 *
 * Per-organisation categories for classifying transactions across
 * Ledger, Event, and Fundraiser modules.
 *
 * A set of neutral default categories is seeded automatically when
 * an organisation is created. Each org can then add, rename, or
 * soft-delete categories freely.
 */

const categorySchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: [true, 'Organization ID is required'],
        index: true
    },

    name: {
        type: String,
        required: [true, 'Category name is required'],
        trim: true,
        minlength: [2, 'Category name must be at least 2 characters'],
        maxlength: [100, 'Category name cannot exceed 100 characters']
    },

    // income, expense, or usable for both
    type: {
        type: String,
        enum: {
            values: ['income', 'expense', 'both'],
            message: '{VALUE} is not a valid category type'
        },
        default: 'both'
    },

    // Which module(s) this category is relevant to
    module: {
        type: String,
        enum: {
            values: ['ledger', 'event', 'fundraiser', 'all'],
            message: '{VALUE} is not a valid module scope'
        },
        default: 'all'
    },

    // UI helpers — hex colour and icon name (e.g. lucide icon key)
    color: {
        type: String,
        trim: true,
        maxlength: [20, 'Color cannot exceed 20 characters'],
        default: null   // e.g. '#4CAF50'
    },
    icon: {
        type: String,
        trim: true,
        maxlength: [50, 'Icon name cannot exceed 50 characters'],
        default: null   // e.g. 'wallet', 'building', 'truck'
    },

    // True for the seed categories created with the org — still deletable
    isDefault: {
        type: Boolean,
        default: false
    },

    // ── Audit ──────────────────────────────────────────────────────
    audit: {
        type: auditSchema,
        default: () => ({})
    }
});

// Category names must be unique per org (among non-deleted records)
categorySchema.index(
    { organizationId: 1, name: 1 },
    { unique: true, partialFilterExpression: { 'audit.isDeleted': false } }
);
categorySchema.index({ organizationId: 1, type: 1 });
categorySchema.index({ organizationId: 1, module: 1 });
categorySchema.index({ 'audit.isDeleted': 1 });

// ── Middleware ─────────────────────────────────────────────────────
categorySchema.pre('save', function (next) {
    if (!this.isNew) this.audit.updatedAt = new Date();
    next();
});

categorySchema.pre('findOneAndUpdate', function (next) {
    this.set({ 'audit.updatedAt': new Date() });
    next();
});

// ── Instance methods ───────────────────────────────────────────────
categorySchema.methods.softDelete = function (userId, reason = null) {
    this.audit.isDeleted = true;
    this.audit.deletedAt = new Date();
    this.audit.deletedByUserId = userId;
    this.audit.deletionReason = reason;
    this.audit.history.push({ action: 'deleted', byUserId: userId, note: reason });
    return this.save();
};

// ── Static helpers ─────────────────────────────────────────────────
categorySchema.statics.findActive = function (filter = {}) {
    return this.find({ ...filter, 'audit.isDeleted': false });
};

categorySchema.statics.findByOrg = function (organizationId, { type, module } = {}) {
    const query = { organizationId, 'audit.isDeleted': false };
    if (type) query.type = type;
    if (module && module !== 'all') {
        query.$or = [{ module }, { module: 'all' }];
    }
    return this.find(query).sort({ name: 1 });
};

/**
 * Seed default categories for a newly created organisation.
 * Call this after org creation: await Category.seedDefaults(orgId, userId)
 */
categorySchema.statics.seedDefaults = async function (organizationId, createdByUserId) {
    const defaults = [
        // ── Income ──────────────────────────────────────────────────
        { name: 'Membership Dues', type: 'income', module: 'ledger' },
        { name: 'Donations', type: 'income', module: 'all' },
        { name: 'Grants & Aid', type: 'income', module: 'ledger' },
        { name: 'Event Ticket Sales', type: 'income', module: 'event' },
        { name: 'Sponsorship', type: 'income', module: 'all' },
        { name: 'Fundraising Collection', type: 'income', module: 'fundraiser' },
        { name: 'Miscellaneous Income', type: 'income', module: 'all' },
        // ── Expense ─────────────────────────────────────────────────
        { name: 'Venue / Hall Rental', type: 'expense', module: 'all' },
        { name: 'Catering & Refreshments', type: 'expense', module: 'event' },
        { name: 'Printing & Stationery', type: 'expense', module: 'all' },
        { name: 'Transport & Logistics', type: 'expense', module: 'all' },
        { name: 'Equipment & Supplies', type: 'expense', module: 'all' },
        { name: 'Staff / Labour Costs', type: 'expense', module: 'all' },
        { name: 'Utilities & Maintenance', type: 'expense', module: 'ledger' },
        { name: 'Marketing & Promotion', type: 'expense', module: 'all' },
        { name: 'Welfare & Aid Disbursement', type: 'expense', module: 'ledger' },
        { name: 'Miscellaneous Expense', type: 'expense', module: 'all' },
    ];

    const docs = defaults.map(d => ({
        organizationId,
        ...d,
        isDefault: true,
        audit: { createdByUserId }
    }));

    // insertMany with ordered:false — skip duplicates if seeding runs twice
    return this.insertMany(docs, { ordered: false }).catch(err => {
        if (err.code !== 11000) throw err; // ignore duplicate key, rethrow rest
    });
};

const Category = mongoose.model('Category', categorySchema);
module.exports = Category;
