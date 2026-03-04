const mongoose = require('mongoose');

/**
 * Payment Sub-Schema
 *
 * Embedded inside Transaction to capture all payment-related details
 * in one place. Kept intentionally lean — covers the essentials.
 *
 * receivedByUserId:
 *   The Firebase UID of whoever physically received/handled the payment.
 *   May differ from the transaction's createdByUserId (the person who
 *   entered the record). E.g. the treasurer collected cash at the door,
 *   but the admin entered it into the system the next day.
 *   Leave null if the recorder and receiver are the same person.
 */

const paymentSchema = new mongoose.Schema(
    {
        // How the payment was  made
        method: {
            type: String,
            enum: {
                values: ['cash', 'bank_transfer', 'upi', 'cheque', 'card', 'online_gateway', 'other'],
                message: '{VALUE} is not a valid payment method'
            },
            default: 'cash'
        },

        // Single catch-all reference — UTR, cheque no, UPI ref, gateway tx ID, etc.
        referenceNumber: {
            type: String,
            trim: true,
            maxlength: [100, 'Reference number cannot exceed 100 characters'],
            default: null
        },

        // Receipt or invoice scan
        attachmentUrl: {
            type: String,
            trim: true,
            maxlength: [500, 'Attachment URL cannot exceed 500 characters'],
            default: null
        },

        // Actual date/time the payment was received
        // (may differ from Transaction.date if entered retrospectively)
        paidAt: {
            type: Date,
            default: null
        },

        // Who physically received / handled the payment
        // null = same as the person who created the transaction record
        receivedByUserId: {
            type: String,
            default: null
        },

        // Any extra notes specific to this payment
        notes: {
            type: String,
            trim: true,
            maxlength: [300, 'Payment notes cannot exceed 300 characters'],
            default: null
        }
    },
    {
        _id: false // always embedded — no separate collection, no _id needed
    }
);

module.exports = paymentSchema;
