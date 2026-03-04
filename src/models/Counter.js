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
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true
    }
});

module.exports = mongoose.model('Counter', counterSchema);
