const mongoose = require('mongoose');

const approvalSchema = new mongoose.Schema({
    committeeMemberId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CommitteeMember',
        required: true
    },
    memberId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Member',
        required: true
    },
    approvedAt: { type: Date, default: Date.now },
    notes: { type: String }
}, { _id: false });

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

    // Denormalized fields for search
    memberFullName: { type: String, trim: true },
    memberNumber: { type: String, trim: true },
    householdNumber: { type: String, trim: true },

    // Death details
    dateOfDeath: { type: Date, required: true },
    causeOfDeath: { type: String, trim: true },
    placeOfDeath: { type: String, trim: true },

    // Burial Info
    burialPlace: { type: String, trim: true },
    burialLocation: {
        lat: { type: Number },
        lng: { type: Number }
    },

    // Reporting and Verification
    reportedBy: { type: String, trim: true },
    dateReported: { type: Date, default: Date.now },

    // Certificate Details
    certificateNumber: { type: String, trim: true },
    officialCertificateUrl: { type: String, trim: true },

    // pending → verified | rejected
    status: {
        type: String,
        enum: ['pending', 'verified', 'rejected'],
        default: 'pending'
    },

    // Committee approvals (committee workflow path)
    approvals: [approvalSchema],

    notes: { type: String, trim: true },

    // Audit
    createdByUserId: { type: String, required: true },
    verifiedByUserId: { type: String },
    verifiedAt: { type: Date }
}, {
    timestamps: true
});

// Indexes
deathRegisterSchema.index({ organizationId: 1, status: 1 });
deathRegisterSchema.index({ memberId: 1 }, { unique: true });
deathRegisterSchema.index({ householdId: 1 });
deathRegisterSchema.index({ memberFullName: 'text', memberNumber: 'text', householdNumber: 'text', certificateNumber: 'text' });

module.exports = mongoose.model('DeathRegister', deathRegisterSchema);
