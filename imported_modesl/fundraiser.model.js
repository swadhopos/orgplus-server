const mongoose = require('mongoose');
const sponsorSchema = require('./sponsor.schema');
const pledgeSchema = require('./pledge.schema');
const auditSchema = require('./audit.schema');

/**
 * Fundraiser Model
 *
 * Financial campaign with a goal — standalone or optionally linked to an Event.
 * Transactions live in Transaction collection: sourceType='fundraiser', sourceId=fundraiser._id
 * Pledges and Sponsors are embedded (bounded, always accessed in context of this fundraiser).
 * cachedNetRaised is a denormalized snapshot — refreshed on each Transaction write.
 * Source of truth is always Transaction.summarizeBySource().
 */

const fundraiserSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: [true, 'Organization ID is required'],
    index: true
  },

  title: {
    type: String,
    required: [true, 'Fundraiser title is required'],
    trim: true,
    minlength: [2, 'Title must be at least 2 characters'],
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters'],
    default: null
  },
  fundraiserType: {
    type: String,
    enum: {
      values: ['campaign', 'collection', 'charity_drive', 'zakat', 'welfare', 'construction', 'other'],
      message: '{VALUE} is not a valid fundraiser type'
    },
    default: 'campaign'
  },

  goalAmount: {
    type: Number,
    required: [true, 'Goal amount is required'],
    min: [1, 'Goal amount must be greater than 0']
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
    required: [true, 'Start date is required']
  },
  endDate: {
    type: Date,
    default: null   // null = open-ended, no deadline
  },

  // Denormalized cache — refresh after every Transaction write
  cachedTotalIncome: { type: Number, default: 0, min: [0, 'Cannot be negative'] },
  cachedTotalExpense: { type: Number, default: 0, min: [0, 'Cannot be negative'] },
  cachedNetRaised: { type: Number, default: 0 },
  cacheUpdatedAt: { type: Date, default: null },

  // Optional: link to an Event that this fundraiser runs alongside
  linkedEventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    default: null
  },

  pledges: [pledgeSchema],
  sponsors: [sponsorSchema],

  isPublic: {
    type: Boolean,
    default: false  // true = visible to members on portal
  },
  status: {
    type: String,
    enum: {
      values: ['draft', 'active', 'paused', 'completed', 'cancelled'],
      message: '{VALUE} is not a valid fundraiser status'
    },
    default: 'draft'
  },

  coverImageUrl: { type: String, trim: true, maxlength: [500, 'URL cannot exceed 500 characters'], default: null },
  tags: { type: [String], default: [] },

  // ── Audit ──────────────────────────────────────────────────────
  audit: {
    type: auditSchema,
    default: () => ({})
  }
});

fundraiserSchema.index({ organizationId: 1, status: 1 });
fundraiserSchema.index({ organizationId: 1, startDate: -1 });
fundraiserSchema.index({ linkedEventId: 1 }, { sparse: true });
fundraiserSchema.index({ 'audit.isDeleted': 1 });

fundraiserSchema.pre('save', function (next) {
  if (!this.isNew) this.audit.updatedAt = new Date();
  next();
});

fundraiserSchema.pre('findOneAndUpdate', function (next) {
  this.set({ 'audit.updatedAt': new Date() });
  next();
});

fundraiserSchema.methods.softDelete = function (userId, reason = null) {
  this.audit.isDeleted = true;
  this.audit.deletedAt = new Date();
  this.audit.deletedByUserId = userId;
  this.audit.deletionReason = reason;
  this.audit.history.push({ action: 'deleted', byUserId: userId, note: reason });
  return this.save();
};

fundraiserSchema.methods.progressPercent = function () {
  if (!this.goalAmount) return 0;
  return Math.min(100, Math.round((this.cachedNetRaised / this.goalAmount) * 100));
};

fundraiserSchema.methods.pledgeSummary = function () {
  return this.pledges.reduce(
    (acc, p) => { acc.totalPledged += p.pledgedAmount; acc.totalReceived += p.receivedAmount; return acc; },
    { totalPledged: 0, totalReceived: 0 }
  );
};

fundraiserSchema.methods.sponsorSummary = function () {
  return this.sponsors.reduce(
    (acc, s) => { acc.totalCommitted += s.committedAmount; acc.totalReceived += s.receivedAmount; return acc; },
    { totalCommitted: 0, totalReceived: 0 }
  );
};

// Call after every Transaction create/update/delete for this fundraiser
fundraiserSchema.methods.refreshCache = async function () {
  const Transaction = mongoose.model('Transaction');
  const summary = await Transaction.summarizeBySource('fundraiser', this._id);
  this.cachedTotalIncome = 0;
  this.cachedTotalExpense = 0;
  summary.forEach(({ _id, total }) => {
    if (_id === 'income') this.cachedTotalIncome = total;
    if (_id === 'expense') this.cachedTotalExpense = total;
  });
  this.cachedNetRaised = this.cachedTotalIncome - this.cachedTotalExpense;
  this.cacheUpdatedAt = new Date();
  return this.save();
};

fundraiserSchema.statics.findActive = function (filter = {}) {
  return this.find({ ...filter, 'audit.isDeleted': false });
};

fundraiserSchema.statics.findByOrg = function (organizationId, status = null) {
  const query = { organizationId, 'audit.isDeleted': false };
  if (status) query.status = status;
  return this.find(query).sort({ startDate: -1 });
};

const Fundraiser = mongoose.model('Fundraiser', fundraiserSchema);
module.exports = Fundraiser;
