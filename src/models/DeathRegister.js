const mongoose = require('mongoose');

const deathRegisterSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true
    },
    memberId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Member',
        required: true
    },
    householdId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Household',
        required: true
    },

    // Death details
    dateOfDeath: {
        type: Date,
        required: true
    },
    causeOfDeath: {
        type: String,
        trim: true
    },
    placeOfDeath: {
        type: String,
        trim: true
    },

    // Burial Info
    burialPlace: {
        type: String,
        trim: true
    },
    burialLocation: {
        lat: { type: Number },
        lng: { type: Number }
    },

    // Reporting and Verification
    reportedBy: {
        type: String,
        trim: true
    },
    dateReported: {
        type: Date,
        default: Date.now
    },

    // Certificate Details
    certificateNumber: {
        type: String,
        trim: true
    },
    officialCertificateUrl: {
        type: String,
        trim: true
    },

    status: {
        type: String,
        enum: ['pending', 'verified', 'rejected'],
        default: 'pending'
    },
    notes: {
        type: String,
        trim: true
    },

    // Audit
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    createdByUserId: {
        type: String,
        required: true
    },
    verifiedByUserId: {
        type: String
    },
    verifiedAt: {
        type: Date
    }
});

// Indexes for common queries
deathRegisterSchema.index({ organizationId: 1, status: 1 });
deathRegisterSchema.index({ memberId: 1 }, { unique: true }); // One death record per member
deathRegisterSchema.index({ householdId: 1 });

// Middleware to update updatedAt
deathRegisterSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('DeathRegister', deathRegisterSchema);
