require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const User = require('./models/User');
const { authenticateToken, authorizeRoles } = require('./middleware/auth');
const classRoutes = require('./routes/classes');

const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const app = express();
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET;

app.use('/api/classes', classRoutes);
app.get('/api/class/:id', authenticateToken, async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ error: 'Invalid class ID.' });
        }
        const foundClass = await require('./models/Class').findById(req.params.id)
        .populate('teacher', 'name email')
        .populate('students', 'name email');

        if (!foundClass) {
            return res.status(404).json({ error: 'Class not found.' });
        }
        res.status(200).json(foundClass);
    } catch (err) {
        console.error('Get class error:', err);
        res.status(500).json({ error: 'Failed to fetch class.' });
    }
});

app.post('/api/register', async (req, res) => {
    try {
        const { email, password, role } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }
        if (!isValidEmail(email)) {
            return res.status(400).json({ error: 'Invalid email address.' });
        }
        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
        }
        if (!/[A-Z]/.test(password)) {
            return res.status(400).json({ error: 'Password must contain at least one uppercase letter.' });
        }
        if (!/[0-9]/.test(password)) {
            return res.status(400).json({ error: 'Password must contain at least one number.' });
        }
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            return res.status(400).json({ error: 'Password must contain at least one special character.' });
        }
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ error: 'An account with that email already exists.' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);

        const normalizedRole = role ? role.toUpperCase() : 'STUDENT';
        const validRoles = ['TEACHER', 'STUDENT', 'PARENT'];

        if (!validRoles.includes(normalizedRole)) {
            return res.status(400).json({
                error: 'Invalid role. Must be one of: TEACHER, STUDENT, PARENT.'
            });
        }

        await User.create({ email, password: hashedPassword, role: normalizedRole });
        res.status(201).json({ message: 'User registered successfully!' });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ error: 'An account with that email already exists.' });
        }
        res.status(500).json({ error: 'Registration failed.' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }
        if (!isValidEmail(email)) {
            return res.status(400).json({ error: 'Invalid email address.' });
        }
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ error: 'Invalid email or password.' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid password.' });
        }

        const token = jwt.sign({ id: user._id, email: user.email, role: user.role },
         JWT_SECRET, { expiresIn: '1h' });
        res.status(200).json({ message: 'Login successful!', token, role: user.role });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Login failed.' });
    }
});

app.post('/api/save-name', authenticateToken, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Please provide a name.' });
        }
        if (name.trim() === '') {
            return res.status(400).json({ error: 'Name cannot be empty.' });
        }
        if (name.trim().length < 3) {
            return res.status(400).json({ error: 'Name must be at least 3 characters long.' });
        }
        if (name.trim().length > 50) {
            return res.status(400).json({ error: 'Name cannot exceed 50 characters.' });
        }
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { name: name.trim() },
            { new: true }
        );
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }
        res.status(200).json({ message: 'Name saved successfully!', name: user.name });
    } catch (err) {
        console.error('Save name error:', err);
        res.status(500).json({ error: 'Failed to save name.' });
    }
});

app.get('/api/get-name', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }
        if (!user.name) {
            return res.status(404).json({ error: 'No name saved yet.' });
        }
        res.status(200).json({ message: 'Name retrieved successfully!', name: user.name });
    } catch (err) {
        console.error('Get name error:', err);
        res.status(500).json({ error: 'Failed to retrieve name.' });
    }
});

app.get('/api/results/:studentId', authenticateToken, authorizeRoles('ADMIN', 'PARENT', 'TEACHER'), async (req, res) => {
    try {
        if (!isValidObjectId(req.params.studentId)) {
            return res.status(400).json({ error: 'Invalid student ID.' });
        }
        const { studentId } = req.params;

        if (req.user.role === 'PARENT' || req.user.role === 'TEACHER') {
            const me = await User.findById(req.user.id);
            const isMyChild = me.children.map(id => id.toString()).includes(studentId);
            if (!isMyChild) {
                return res.status(403).json({ error: 'You can only view results for your own children.' });
            }
        }

        const classes = await require('./models/Class').find({ students: studentId })
        .populate('teacher', 'name')
        .select('name classType subjects term');

         res.json({ studentId, classes });

    } catch (err) {
        console.error('Results error:', err);
        res.status(500).json({ error: 'Failed to fetch results.' });
    }
});

app.post('/api/link-child', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
    try {
        const { parentId, childIds } = req.body;

        if (!isValidObjectId(parentId)) {
            return res.status(400).json({ error: 'Invalid parent ID.' });
        }
        if (!childIds.every(id => isValidObjectId(id))) {
            return res.status(400).json({ error: 'One or more invalid child IDs.' });
        }
        const parent = await User.findById(parentId);
        if (!parent || !['PARENT', 'TEACHER'].includes(parent.role)) {
            return res.status(400).json({ error: 'Invalid parent ID or user is not a parent/teacher.' });
        }
        const updated = await User.findByIdAndUpdate(
            parentId,
            { $addToSet: { children: { $each: childIds } } },
            { new: true }
        ).populate('children', 'name email');
        res.json({ message: 'Children linked successfully!', children: updated.children });
    } catch (err) {
        res.status(500).json({ error: 'Failed to link children.' });
    }
});

module.exports = app;
