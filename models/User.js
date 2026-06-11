const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    name: {
        type: String,
        default: null
    },
    role: {
        type: String,
        enum: ['admin', 'teacher', 'student', 'parent'],
        default: 'student'
    },
    children: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }]
    
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);