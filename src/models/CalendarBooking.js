const mongoose = require('mongoose');

const calendarBookingSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: [true, 'Organization is required'],
        index: true
    },
    title: {
        type: String,
        required: [true, 'Booking title is required'],
        trim: true,
        maxlength: [200, 'Title cannot exceed 200 characters']
    },
    description: {
        type: String,
        trim: true,
        maxlength: [1000, 'Description cannot exceed 1000 characters'],
        default: null
    },
    type: {
        type: String,
        enum: {
            // Built-in types; UI can also allow open text if enum is removed, but enum keeps it clean
            values: ['marriage', 'funeral', 'branch_meeting', 'maintenance', 'other'],
            message: '{VALUE} is not a valid booking type'
        },
        default: 'other'
    },
    date: {
        type: Date,
        required: [true, 'Date is required'],
        index: true // Indexed for fast querying by month
    },
    startTime: {
        type: String, // format 'HH:mm' e.g. '14:30'
        required: [true, 'Start time is required']
    },
    endTime: {
        type: String, // format 'HH:mm' e.g. '15:30'
        required: [true, 'End time is required']
    },
    location: {
        type: String,
        trim: true,
        maxlength: [300, 'Location cannot exceed 300 characters'],
        default: null
    },
    status: {
        type: String,
        enum: {
            values: ['scheduled', 'completed', 'cancelled'],
            message: '{VALUE} is not a valid status'
        },
        default: 'scheduled'
    },
    autoCompleteWhenExpired: {
        type: Boolean,
        default: true
    },
    visibility: {
        type: String,
        enum: {
            values: ['public', 'internal'],
            message: '{VALUE} is not a valid visibility'
        },
        default: 'internal'
    },

    // Audit fields
    createdByUserId: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Indexes for high-efficiency querying
calendarBookingSchema.index({ organizationId: 1, date: 1 });

// Middleware
calendarBookingSchema.pre('save', function (next) {
    if (!this.isNew) this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('CalendarBooking', calendarBookingSchema);
