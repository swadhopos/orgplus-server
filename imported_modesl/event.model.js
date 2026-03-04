const mongoose = require('mongoose');
const sponsorSchema = require('./sponsor.schema');
const pledgeSchema = require('./pledge.schema');
const auditSchema = require('./audit.schema');

/**
 * Event Model
 *
 * Represents a time-bound activity (festival, meeting, ceremony, etc.)
 * with its own financial footprint, committee, pledges, and sponsors.
 *
 * Financial transactions (income/expense) are NOT embedded.
 * They live in the Transaction collection with:
 *   sourceType = 'event', sourceId = event._id
 *
 * Pledges and Sponsors ARE embedded because they are always
 * accessed in context of this event and lists are bounded.
 *
 * Committee members reference your existing Committee/Committer model.
 */

const eventSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: [true, 'Organization ID is required'],
    index: true
  },

  // --- Core Info ---
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
  eventType: {
    type: String,
    enum: {
      values: ['festival', 'meeting', 'ceremony', 'sports', 'cultural', 'religious', 'welfare', 'other'],
      message: '{VALUE} is not a valid event type'
    },
    default: 'other'
  },

  // --- Schedule ---
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  endDate: {
    type: Date,
    default: null
    // null = single-day event; set for multi-day events
  },
  venue: {
    type: String,
    trim: true,
    maxlength: [300, 'Venue cannot exceed 300 characters'],
    default: null
  },

  // --- Budget ---
  budgetedIncome: {
    type: Number,
    default: 0,
    min: [0, 'Budgeted income cannot be negative']
  },
  budgetedExpense: {
    type: Number,
    default: 0,
    min: [0, 'Budgeted expense cannot be negative']
  },
  currency: {
    type: String,
    default: 'INR',
    uppercase: true,
    trim: true,
    maxlength: [10, 'Currency code cannot exceed 10 characters']
  },

  // --- Committee ---
  // References your existing Committee model.
  // Store the committeeId if the entire committee is pre-assigned,
  // or list individual committerIds for ad-hoc assignments.
  committeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Committee',
    default: null
  },
  // Ad-hoc committee members assigned specifically for this event
  committeeMembers: [
    {
      committerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Committer',
        required: true
      },
      role: {
        type: String,
        trim: true,
        maxlength: [100, 'Role cannot exceed 100 characters'],
        default: 'member'
        // e.g. 'chairperson', 'treasurer', 'coordinator'
      },
      addedAt: { type: Date, default: Date.now }
    }
  ],

  // --- Pledges (embedded) ---
  pledges: [pledgeSchema],

  // --- Sponsors (embedded) ---
  sponsors: [sponsorSchema],

  // --- Status ---
  status: {
    type: String,
    enum: {
      values: ['draft', 'planned', 'ongoing', 'completed', 'cancelled'],
      message: '{VALUE} is not a valid event status'
    },
    default: 'draft'
  },

  // Optional link to a Fundraiser running alongside this event
  fundraiserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Fundraiser',
    default: null
  },

  tags: {
    type: [String],
    default: []
    // e.g. ['annual', 'public', 'members-only']
  },

  // ── Audit ──────────────────────────────────────────────────────
  audit: {
    type: auditSchema,
    default: () => ({})
  }
});

eventSchema.index({ organizationId: 1, startDate: -1 });
eventSchema.index({ organizationId: 1, status: 1 });
eventSchema.index({ 'audit.isDeleted': 1 });

eventSchema.pre('save', function (next) {
  if (!this.isNew) this.audit.updatedAt = new Date();
  next();
});

eventSchema.pre('findOneAndUpdate', function (next) {
  this.set({ 'audit.updatedAt': new Date() });
  next();
});

eventSchema.methods.softDelete = function (userId, reason = null) {
  this.audit.isDeleted = true;
  this.audit.deletedAt = new Date();
  this.audit.deletedByUserId = userId;
  this.audit.deletionReason = reason;
  this.audit.history.push({ action: 'deleted', byUserId: userId, note: reason });
  return this.save();
};

// Helper: total pledged vs received across all pledges
eventSchema.methods.pledgeSummary = function () {
  return this.pledges.reduce(
    (acc, p) => {
      acc.totalPledged += p.pledgedAmount;
      acc.totalReceived += p.receivedAmount;
      return acc;
    },
    { totalPledged: 0, totalReceived: 0 }
  );
};

// Helper: total sponsor committed vs received
eventSchema.methods.sponsorSummary = function () {
  return this.sponsors.reduce(
    (acc, s) => {
      acc.totalCommitted += s.committedAmount;
      acc.totalReceived += s.receivedAmount;
      return acc;
    },
    { totalCommitted: 0, totalReceived: 0 }
  );
};

eventSchema.statics.findActive = function (filter = {}) {
  return this.find({ ...filter, 'audit.isDeleted': false });
};

eventSchema.statics.findByOrg = function (organizationId, status = null) {
  const query = { organizationId, 'audit.isDeleted': false };
  if (status) query.status = status;
  return this.find(query).sort({ startDate: -1 });
};

const Event = mongoose.model('Event', eventSchema);
module.exports = Event;
