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

module.exports = mongoose.model('Counter', counterSchema);
