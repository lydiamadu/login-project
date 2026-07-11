const mongoose = require('mongoose');
const subjectResultSchema = new mongoose.Schema({
    subject: {
        type: String,
        required: true,
        trim: true
    },
    firstTest: {
        type: Number,
        required: true,
        min: 0,
        max: 20
    },
    secondTest: {
        type: Number,
        required: true,
        min: 0,
        max: 20
    },
    examScore: {
        type: Number,
        required: true,
        min: 0,
        max: 60
    },
    totalScore: {
        type: Number,
    },
    grade: {
        type: String,
    }
}, { _id: false });

const gradeSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
    },
    class: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
        required: true
    },
    term: {
        type: String,
        enum: ['First Term', 'Second Term', 'Third Term'],
        required: true
    },
    academicYear: {
        type: String,
        required: true
    },
    results: {
        type: [subjectResultSchema],
        validate: {
            validator: (arr) => arr.length > 0,
            message: 'At least one subject result is required.'
        }
    },
    average: {
        type: Number,
    },
    overallGrade: {
        type: String
    },
    comment: {
        type: String,
        trim: true
    },
    gradedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, { timestamps: true });
gradeSchema.index({ student: 1, class: 1, term: 1, academicYear: 1 }, { unique: true });
module.exports = mongoose.model('Grade', gradeSchema);