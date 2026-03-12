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
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
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

const MarriageNOC = mongoose.model('MarriageNOC', marriageNocSchema);

module.exports = MarriageNOC;
