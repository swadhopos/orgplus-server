const mongoose = require('mongoose');

/**
 * MarriageCertificate
 *
 * Lifecycle:  pending → issued  (on 3rd unique committee-member approval)
 *                              → annulled
 *
 * marriageType controls which side-effects fire on issue:
 *  - intra    : both spouses are existing members of this org
 *  - incoming : spouse B is new to the org (auto-created as Member on issue)
 *  - outgoing : spouse A leaves the org after marriage; spouse B is external
 */
const marriageCertificateSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },

    certificateNumber: {
        type: String,
        required: true
    },

    marriageDate: {
        type: Date,
        required: true
    },

    venue: {
        type: String,
        trim: true
    },

    marriageType: {
        type: String,
        enum: ['intra', 'incoming', 'outgoing'],
        required: true
    },

    // ─── Spouse A (always an existing member of this org) ───────────────────
    spouseAId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Member',
        required: true,
        index: true
    },

    // Denormalized fields for search
    spouseAFullName: { type: String, trim: true },
    spouseANumber: { type: String, trim: true },
    spouseAHouseholdNumber: { type: String, trim: true },
    spouseAHouseholdId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Household',
        index: true
    },
    
    // ─── Spouse B (varies by marriageType) ──────────────────────────────────
    // Populated after issue for intra / incoming
    spouseBId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Member',
        default: null
    },

    // For incoming: the payload used to create the new member on approval
    spouseBNewMemberData: {
        fullName: String,
        gender: { type: String, enum: ['male', 'female', 'other'] },
        dateOfBirth: Date,
        mobileNumber: String,
        currentHouseholdId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Household'
        }
    },

    // For outgoing: external spouse details stored as plain text
    spouseBExternal: {
        fullName: String,
        address: String,
        parishName: String
    },

    // ─── Witnesses ──────────────────────────────────────────────────────────
    witnesses: [{
        name: { type: String, trim: true },
        address: { type: String, trim: true }
    }],

    // ─── Approval Workflow ───────────────────────────────────────────────────
    status: {
        type: String,
        enum: ['pending', 'issued', 'annulled'],
        default: 'pending',
        index: true
    },

    approvals: [{
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
        approvedAt: {
            type: Date,
            default: Date.now
        },
        notes: String
    }],

    issuedAt: {
        type: Date
    },

    annulledAt: {
        type: Date
    },

    annulledByUserId: {
        type: String
    },

    annulmentReason: {
        type: String
    },

    notes: {
        type: String,
        trim: true
    },

    // ─── Audit ───────────────────────────────────────────────────────────────
    issuedByUserId: {
        type: String,
        required: true
    }
}, {
    timestamps: true
});

// Unique certificate numbers per organisation
marriageCertificateSchema.index({ organizationId: 1, certificateNumber: 1 }, { unique: true });
// Fast lookup: one active certificate per member
marriageCertificateSchema.index({ spouseAId: 1, status: 1 });
marriageCertificateSchema.index({ spouseAFullName: 'text', spouseANumber: 'text', spouseAHouseholdNumber: 'text', certificateNumber: 'text' });

module.exports = mongoose.model('MarriageCertificate', marriageCertificateSchema);
