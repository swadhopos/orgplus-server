const mongoose = require('mongoose');

const committeeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    enum: ['managing', 'sports', 'cultural', 'maintenance', 'other'],
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'dissolved'],
    default: 'active'
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  startDate: {
    type: Date
  },
  endDate: {
    type: Date
  },
  // Optional: links this committee to a specific event
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    default: null,
    index: true
  },
  fundraiserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Fundraiser',
    default: null,
    index: true
  },
  // Main committee flag
  isMain: {
    type: Boolean,
    default: false
  },
  // Audit fields
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  createdByUserId: {
    type: String,
    required: true
  },
  // Soft delete
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date,
  deletedByUserId: String
});

// Indexes
committeeSchema.index({ organizationId: 1, isDeleted: 1 });
committeeSchema.index({ name: 1, organizationId: 1 });

// Middleware to update updatedAt and handle isMain logic
committeeSchema.pre('save', async function (next) {
  this.updatedAt = new Date();
  
  if (this.isNew && !this.isMain) {
    // If there is no other main committee that is NOT dissolved, make this one main automatically
    const existingMain = await this.constructor.findOne({ 
      organizationId: this.organizationId, 
      isMain: true,
      status: { $ne: 'dissolved' }
    });
    
    if (!existingMain) {
      this.isMain = true;
    }
  }

  // If this committee is being set as the main committee, 
  // ensure no other committee in this org is main
  if (this.isModified('isMain') && this.isMain) {
    await this.constructor.updateMany(
      { 
        organizationId: this.organizationId, 
        _id: { $ne: this._id } 
      },
      { $set: { isMain: false } }
    );
  }
  
  next();
});

module.exports = mongoose.model('Committee', committeeSchema);
