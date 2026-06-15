const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const disponibilitySchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User', 
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    isAvailable: {
        type: Boolean,
        default: true 
    }
});

module.exports = mongoose.model('Disponibility', disponibilitySchema);
