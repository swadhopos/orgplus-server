const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
    _id: {
        type: String,
        required: true
    },
    sequenceValue: {
        type: Number,
        default: 0
    },
    stringValue: {
        type: String,
        default: 'AA'
    },
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: false // Made optional so we can use a global Counter
    }
});

counterSchema.statics.getNextSequence = async function(orgId, counterType, sequenceField) {
    const counterId = `${orgId}_${counterType}_${sequenceField}`;
    const counter = await this.findOneAndUpdate(
        { _id: counterId },
        { 
            $inc: { sequenceValue: 1 },
            $setOnInsert: { organizationId: orgId }
        },
        { new: true, upsert: true }
    );
    return counter.sequenceValue;
};

module.exports = mongoose.model('Counter', counterSchema);
