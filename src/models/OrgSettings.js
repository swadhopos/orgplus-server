const mongoose = require('mongoose');

/**
 * OrgSettings — per-organisation configuration document.
 * One document per org, upserted on first access.
 *
 * Designed to be extended: add new top-level sections as needed.
 */
const orgSettingsSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        unique: true,
        index: true
    },

    // ─── BMD Approval Settings ───────────────────────────────────────────────
    // Applied to: Marriage NOC, Death Records, Marriage Certificates
    approvalSettings: {
        // The committee whose members are authorised to approve BMD records.
        // If null, no committee approvals are possible.
        approverCommitteeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Committee',
            default: null
        },
        // Restrict to specific roles within that committee.
        // Empty array = all roles in that committee are allowed.
        approverRoles: {
            type: [String],
            enum: ['president', 'vice-president', 'secretary', 'treasurer', 'member'],
            default: []
        },
        // How many unique approvals are required before a record is issued/verified.
        requiredApprovals: {
            type: Number,
            default: 3,
            min: 1,
            max: 10
        }
    },

    // ─── Audit ──────────────────────────────────────────────────────────────
    updatedByUserId: {
        type: String
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('OrgSettings', orgSettingsSchema);
