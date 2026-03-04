const mongoose = require('mongoose');

/**
 * Sponsor Sub-Schema
 *
 * Reusable embedded schema for sponsors inside Event and Fundraiser.
 * Sponsors are embedded (not a separate collection) because:
 *  - They are always queried in context of their parent (event/fundraiser)
 *  - The list is bounded and manageable
 *  - No cross-org sponsor querying is needed
 *
 * If cross-org sponsor analytics are needed later, promote to a collection
 * and reference via sponsorId.
 */

const sponsorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Sponsor name is required'],
      trim: true,
      maxlength: [200, 'Sponsor name cannot exceed 200 characters']
    },
    contactPerson: {
      type: String,
      trim: true,
      maxlength: [200, 'Contact person name cannot exceed 200 characters']
    },
    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
      default: null
    },
    contactPhone: {
      type: String,
      trim: true,
      maxlength: [20, 'Contact phone cannot exceed 20 characters'],
      default: null
    },

    // What they're contributing
    sponsorshipType: {
      type: String,
      enum: {
        values: ['cash', 'in_kind', 'service', 'mixed'],
        message: '{VALUE} is not a valid sponsorship type'
      },
      default: 'cash'
    },
    committedAmount: {
      // Monetary value (cash or estimated value of in-kind)
      type: Number,
      default: 0,
      min: [0, 'Committed amount cannot be negative']
    },
    receivedAmount: {
      // How much has actually been received/fulfilled
      type: Number,
      default: 0,
      min: [0, 'Received amount cannot be negative']
    },
    inKindDescription: {
      // Describe in-kind contributions e.g. "50 chairs, PA system"
      type: String,
      trim: true,
      maxlength: [500, 'In-kind description cannot exceed 500 characters'],
      default: null
    },

    // Sponsorship tier — for tiered recognition (optional)
    tier: {
      type: String,
      enum: {
        values: ['title', 'gold', 'silver', 'bronze', 'community', 'other'],
        message: '{VALUE} is not a valid sponsor tier'
      },
      default: 'other'
    },

    status: {
      type: String,
      enum: {
        values: ['pledged', 'partially_received', 'fully_received', 'cancelled'],
        message: '{VALUE} is not a valid sponsor status'
      },
      default: 'pledged'
    },

    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
      default: null
    },

    // Link to the Transaction created when sponsor payment was received
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null
    },

    addedByUserId: {
      type: String,
      required: [true, 'Added by user ID is required']
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: true } // Each sponsor gets its own _id for targeted updates
);

module.exports = sponsorSchema;
