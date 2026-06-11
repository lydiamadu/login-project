const mongoose = require('mongoose');

const scheduleEntrySchema = new mongoose.Schema({
    day: {
        type: String,
        enum: ['Monday','Tuesday','Wednesday','Thursday','Friday'],
        required: true
    },
    startTime: { type: String, required: true },
    endTime:   { type: String, required: true }
}, { _id: false });

const classSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    classType: {
        type: String,
        enum: ['science', 'art', 'commercial'],
        required: true
    },
    level: {
        type: String,
        enum: ['JSS1','JSS2','JSS3','SS1','SS2','SS3'],
        required: true
    },
    academicYear: {
        type: String,
        required: true
    },
    teacher: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    students: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    subjects:    [{ type: String, trim: true }],
    schedule:    [scheduleEntrySchema],
    room:        { type: String, trim: true },
    capacity:    { type: Number, min: 1 },
    description: { type: String, trim: true }

}, { timestamps: true });

module.exports = mongoose.model('Class', classSchema);