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

const marriageNocSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    memberId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Member',
        required: true,
        index: true
    },

    // Denormalized fields for search
    memberFullName: { type: String, trim: true },
    memberNumber: { type: String, trim: true },
    householdNumber: { type: String, trim: true },
    householdId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Household',
        index: true
    },
    
    certificateNumber: {
        type: String,
        required: true
    },
    // Set only after all required approvals are received
    issueDate: {
        type: Date,
        default: null
    },
    fianceDetails: {
        fullName: { type: String, required: true },
        address: { type: String, required: true },
        parishName: { type: String, required: true }
    },
    // pending → issued → revoked
    status: {
        type: String,
        enum: ['pending', 'issued', 'revoked'],
        default: 'pending'
    },
    approvals: [approvalSchema],
    issuedByUserId: {
        type: String,
        required: true
    },
    notes: {
        type: String
    }
}, {
    timestamps: true
});

// Ensure unique certificate numbers per organization
marriageNocSchema.index({ organizationId: 1, certificateNumber: 1 }, { unique: true });
marriageNocSchema.index({ memberFullName: 'text', memberNumber: 'text', householdNumber: 'text', certificateNumber: 'text' });

const MarriageNOC = mongoose.model('MarriageNOC', marriageNocSchema);

module.exports = MarriageNOC;
