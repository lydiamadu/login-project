require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const User = require('./models/User');
const { authenticateToken, authorizeRoles } = require('./middleware/auth');
const classRoutes = require('./routes/classes');


const app = express();
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET;

mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('✅ Connected to MongoDB');
        app.listen(3000, () => console.log('🚀 Server running on port 3000'));
    })
    .catch(err => {
        console.error('❌ MongoDB connection failed:', err.message);
        process.exit(1);
    });

//Mount class routes
app.use('/api/classes', classRoutes);

//REGISTER
app.post('/api/register', async (req, res) => {
    try {
        const { email, password, role } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ error: 'An account with that email already exists.' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);

        //never let someone self-assign admin through register route
        const safeRole = ['teacher', 'student', 'parent'].includes(role) ? role : 'student';

        await User.create({ email, password: hashedPassword, role: safeRole });
        res.status(201).json({ message: 'User registered successfully!' });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ error: 'An account with that email already exists.' });
        }
        res.status(500).json({ error: 'Registration failed.' });
    }
});

//LOGIN
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ error: 'Invalid email or password.' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid password.' });
        }
//id + email + role all go into the token
        // this means every middleware can read role without hitting the database
        
        const token = jwt.sign({ id: user._id, email: user.email, role: user.role },
         JWT_SECRET, { expiresIn: '1h' });
        res.status(200).json({ message: 'Login successful!', token, role: user.role });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Login failed.' });
    }
});


//SAVE NAME
app.post('/api/save-name', authenticateToken, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Please provide a name.' });
        }
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { name },
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

//GET NAME
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

//view child results- parent, teacher (if they have children linked), admin
app.get('/api/results/:studentId', authenticateToken, authorizeRoles('admin', 'parent', 'teacher'), async (req, res) => {
    try {
        const { studentId } = req.params;

        //parents and teacher-parent must have the children in their children array
        if (req.user.role === 'parent' || req.user.role === 'teacher') {
            const me = await User.findById(req.user.id);
            const isMyChild = me.children.map(id => id.toString()).includes(studentId);
            if (!isMyChild) {
                return res.status(403).json({ error: 'You can only view results for your own children.' });
            }
        }

        const classes = await require('./models/Class').find({ students: studentId })
        .populate('teacher', 'name')
        .select('name classType subjects academicYear');

         res.json({ studentId, classes });

    } catch (err) {
        console.error('Results error:', err);
        res.status(500).json({ error: 'Failed to fetch results.' });
    }
});

//admin; link a parent (or teacher-parent) to their children
app.post('/api/link-child', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const { parentId, childIds } = req.body;
        const parent = await User.findById(parentId);
        if (!parent || !['parent', 'teacher'].includes(parent.role)) {
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
