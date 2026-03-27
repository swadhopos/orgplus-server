const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Organization name is required'],
    trim: true,
    minlength: [2, 'Organization name must be at least 2 characters long'],
    maxlength: [200, 'Organization name cannot exceed 200 characters']
  },
  type: {
    type: String,
    trim: true
  },
  subtype: {
    type: String,
    trim: true,
    maxlength: [100, 'Subtype cannot exceed 100 characters']
  },
  nicheTypeKey: {
    type: String,
    required: [true, 'Niche type key is required'],
    trim: true,
    index: true
  },
  registrationNumber: {
    type: String,
    trim: true,
    sparse: true,
    maxlength: [100, 'Registration number cannot exceed 100 characters']
  },
  orgNumber: {
    type: String,
    unique: true,
    sparse: true
  },
  houseCounter: {
    type: Number,
    default: 0
  },
  independentMemberCounter: {
    type: Number,
    default: 0
  },
  establishedDate: {
    type: Date,
    default: null
  },
  totalUnits: {
    type: Number,
    min: [0, 'Total units cannot be negative'],
    default: 0
  },
  address: {
    type: String,
    required: [true, 'Address is required'],
    trim: true,
    minlength: [5, 'Address must be at least 5 characters long'],
    maxlength: [500, 'Address cannot exceed 500 characters']
  },
  city: {
    type: String,
    trim: true,
    maxlength: [100, 'City cannot exceed 100 characters']
  },
  state: {
    type: String,
    trim: true,
    maxlength: [100, 'State cannot exceed 100 characters']
  },
  pincode: {
    type: String,
    trim: true,
    maxlength: [20, 'Pincode cannot exceed 20 characters']
  },
  country: {
    type: String,
    trim: true,
    default: 'India',
    maxlength: [100, 'Country cannot exceed 100 characters']
  },
  contactEmail: {
    type: String,
    required: [true, 'Contact email is required'],
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
  },
  contactPhone: {
    type: String,
    required: [true, 'Contact phone is required'],
    trim: true,
    minlength: [10, 'Contact phone must be at least 10 characters long'],
    maxlength: [20, 'Contact phone cannot exceed 20 characters']
  },
  alternatePhone: {
    type: String,
    trim: true,
    maxlength: [20, 'Alternate phone cannot exceed 20 characters']
  },
  website: {
    type: String,
    trim: true,
    maxlength: [200, 'Website URL cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  logoUrl: {
    type: String,
    default: null,
    trim: true
  },
  logoKey: {
    type: String,
    default: null
  },
  primaryColor: {
    type: String,
    default: '#2563eb', // Default Blue
    match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Please provide a valid hex color']
  },
  secondaryColor: {
    type: String,
    default: '#1e40af', // Darker Blue
    match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Please provide a valid hex color']
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
organizationSchema.index({ isDeleted: 1 });

// Pre-save middleware to update updatedAt timestamp
organizationSchema.pre('save', function (next) {
  if (!this.isNew) {
    this.updatedAt = new Date();
  }
  next();
});

// Pre-update middleware to update updatedAt timestamp
organizationSchema.pre('findOneAndUpdate', function (next) {
  this.set({ updatedAt: new Date() });
  next();
});

// Instance method to soft delete
organizationSchema.methods.softDelete = function (userId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedByUserId = userId;
  return this.save();
};

// Static method to find non-deleted organizations
organizationSchema.statics.findActive = function (filter = {}) {
  return this.find({ ...filter, isDeleted: false });
};

// Static method to find by ID excluding deleted
organizationSchema.statics.findByIdActive = function (id) {
  return this.findOne({ _id: id, isDeleted: false });
};

const Organization = mongoose.model('Organization', organizationSchema);

module.exports = Organization;
