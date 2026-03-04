const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: [true, 'User ID (Firebase UID) is required'],
        index: true
    },
    orgId: {
        type: String,
        required: [true, 'Organization ID is required'],
        index: true
    },
    name: {
        type: String,
        required: [true, 'Staff name is required'],
        trim: true,
        maxlength: [100, 'Name cannot exceed 100 characters']
    },
    email: {
        type: String,
        required: [true, 'Staff email is required'],
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
    },
    phone: {
        type: String,
        trim: true,
        maxlength: [20, 'Phone cannot exceed 20 characters']
    },
    staffType: {
        type: String,
        required: [true, 'Staff type/role name is required'],
        trim: true,
        maxlength: [50, 'Staff type cannot exceed 50 characters']
    },
    permissions: {
        type: [String],
        default: []
    },
    status: {
        type: String,
        enum: {
            values: ['active', 'inactive', 'suspended'],
            message: '{VALUE} is not a valid status'
        },
        default: 'active'
    },
    // Audit fields
    createdAt: {
        type: Date,
        default: Date.now,
        immutable: true
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    createdByUserId: {
        type: String,
        required: [true, 'Created by user ID is required'],
        immutable: true
    },
    // Soft delete fields
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedAt: {
        type: Date,
        default: null
    },
    deletedByUserId: {
        type: String,
        default: null
    }
});

// Indexes
staffSchema.index({ userId: 1, orgId: 1 }, { unique: true }); // A user can only have one staff profile per organization
staffSchema.index({ isDeleted: 1 });

// Pre-save middleware to update updatedAt timestamp
staffSchema.pre('save', function (next) {
    if (!this.isNew) {
        this.updatedAt = new Date();
    }
    next();
});

// Pre-update middleware to update updatedAt timestamp
staffSchema.pre('findOneAndUpdate', function (next) {
    this.set({ updatedAt: new Date() });
    next();
});

// Instance method to soft delete
staffSchema.methods.softDelete = function (userId) {
    this.isDeleted = true;
    this.deletedAt = new Date();
    this.deletedByUserId = userId;
    return this.save();
};

// Static method to find non-deleted staff
staffSchema.statics.findActive = function (filter = {}) {
    return this.find({ ...filter, isDeleted: false });
};

// Static method to find by ID excluding deleted
staffSchema.statics.findByIdActive = function (id) {
    return this.findOne({ _id: id, isDeleted: false });
};

const Staff = mongoose.model('Staff', staffSchema);

module.exports = Staff;
