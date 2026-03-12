const mongoose = require('mongoose');

const tierSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Tier name is required'],
    trim: true
  },
  amount: {
    type: Number,
    required: [true, 'Tier amount is required'],
    min: [0, 'Amount cannot be negative']
  }
});

const capacityCategorySchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  name: {
    type: String,
    required: [true, 'Category name is required'],
    trim: true
  },
  targetType: {
    type: String,
    enum: {
      values: ['HOUSEHOLD', 'MEMBER'],
      message: '{VALUE} is not a valid target type'
    },
    required: [true, 'Target type is required']
  },
  tiers: [tierSchema],
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date,
  deletedByUserId: String,
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
    required: true
  }
});

// Indexes
capacityCategorySchema.index({ organizationId: 1, isDeleted: 1 });

// Update updatedAt on save
capacityCategorySchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

const CapacityCategory = mongoose.model('CapacityCategory', capacityCategorySchema);

module.exports = CapacityCategory;
