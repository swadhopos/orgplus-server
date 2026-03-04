const mongoose = require('mongoose');

/**
 * Audit Sub-Schema
 *
 * A reusable embedded schema that provides a consistent audit trail
 * for every document in the system. Tracks:
 *
 *   1. Creation     — who created it and when
 *   2. Last update  — who last touched it and when
 *   3. Soft delete  — who deleted it, when, and why
 *   4. Change log   — lightweight history of key actions (optional entries)
 *
 * USAGE — embed this inside any model schema:
 *
 *   const auditSchema = require('./audit.schema');
 *
 *   const mySchema = new mongoose.Schema({
 *     // ... your fields ...
 *     audit: { type: auditSchema, default: () => ({}) }
 *   });
 *
 * Then in your pre('save') middleware:
 *   if (this.isNew) {
 *     this.audit.createdByUserId = currentUserId;
 *   }
 *   this.audit.updatedByUserId = currentUserId;
 *   this.audit.updatedAt = new Date();
 *
 * Soft delete helper (call from a model method):
 *   doc.audit.isDeleted      = true;
 *   doc.audit.deletedAt      = new Date();
 *   doc.audit.deletedByUserId = userId;
 *   doc.audit.deletionReason = reason;
 *
 * Log a significant action:
 *   doc.audit.history.push({ action: 'status_changed', byUserId: uid, note: 'draft → active' });
 */

const changeLogEntrySchema = new mongoose.Schema(
    {
        // What happened — use a short snake_case verb
        // e.g. 'created', 'updated', 'deleted', 'restored',
        //      'status_changed', 'payment_received', 'pledge_added'
        action: {
            type: String,
            required: true,
            trim: true,
            maxlength: [100, 'Action label cannot exceed 100 characters']
        },

        // Firebase UID of the user who triggered this action
        byUserId: {
            type: String,
            required: true
        },

        // When it happened
        at: {
            type: Date,
            default: Date.now
        },

        // Optional human-readable context (e.g. "status: draft → active")
        note: {
            type: String,
            trim: true,
            maxlength: [500, 'Note cannot exceed 500 characters'],
            default: null
        }
    },
    { _id: false } // No separate _id per entry — keeps the array lean
);

const auditSchema = new mongoose.Schema(
    {
        // ── Creation ─────────────────────────────────────────────────
        createdByUserId: {
            type: String,
            required: [true, 'createdByUserId is required'],
            immutable: true   // once set, never changes
        },
        createdAt: {
            type: Date,
            default: Date.now,
            immutable: true
        },

        // ── Last update ───────────────────────────────────────────────
        updatedByUserId: {
            type: String,
            default: null   // null until first update after creation
        },
        updatedAt: {
            type: Date,
            default: null
        },

        // ── Soft delete ───────────────────────────────────────────────
        isDeleted: {
            type: Boolean,
            default: false
        },
        deletedByUserId: {
            type: String,
            default: null
        },
        deletedAt: {
            type: Date,
            default: null
        },
        deletionReason: {
            type: String,
            trim: true,
            maxlength: [500, 'Deletion reason cannot exceed 500 characters'],
            default: null
        },

        // ── Restore (undo soft-delete) ────────────────────────────────
        restoredByUserId: {
            type: String,
            default: null
        },
        restoredAt: {
            type: Date,
            default: null
        },

        // ── Change log ────────────────────────────────────────────────
        // Lightweight history of significant actions on this document.
        // NOT a full diff — just key lifecycle events worth surfacing in the UI.
        // Keep entries short; avoid logging every field edit here.
        history: {
            type: [changeLogEntrySchema],
            default: []
        }
    },
    {
        _id: false,       // audit is always embedded — no separate collection, no _id
        timestamps: false // we control timestamps manually above
    }
);

module.exports = auditSchema;
