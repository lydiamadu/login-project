const express = require('express');
const router = express.Router();
const Class = require('../models/Class');
const User = require('../models/User');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// CREATE — admin only
router.post('/', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const {
            name, classType, level, academicYear,
            teacher, subjects, schedule, room, capacity, description
        } = req.body;

        const newClass = await Class.create({
            name, classType, level, academicYear,
            teacher, subjects, schedule, room, capacity, description
        });

        res.status(201).json({ message: 'Class created!', class: newClass });
    } catch (err) {
        console.error('Create class error:', err);
        res.status(500).json({ error: 'Failed to create class.' });
    }
});

// READ ALL — any logged-in user
router.get('/', authenticateToken, async (req, res) => {
    try {
        const classes = await Class.find()
            .populate('teacher', 'name email')
            .populate('students', 'name email');

        res.json(classes);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch classes.' });
    }
});

// READ ONE — any logged-in user
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const foundClass = await Class.findById(req.params.id)
            .populate('teacher', 'name email')
            .populate('students', 'name email');

        if (!foundClass) return res.status(404).json({ error: 'Class not found.' });
        res.json(foundClass);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch class.' });
    }
});

// UPDATE — admin can edit any, teacher can only edit their own
router.put('/:id', authenticateToken, authorizeRoles('admin', 'teacher'), async (req, res) => {
    try {
        const foundClass = await Class.findById(req.params.id);
        if (!foundClass) return res.status(404).json({ error: 'Class not found.' });

        // Ownership check — only blocks teachers, not admins
        if (req.user.role === 'teacher' &&
            foundClass.teacher.toString() !== req.user.id) {
            return res.status(403).json({ error: 'You can only edit your own class.' });
        }

        const updated = await Class.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        res.json({ message: 'Class updated!', class: updated });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update class.' });
    }
});

// DELETE — admin only
router.delete('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const foundClass = await Class.findByIdAndDelete(req.params.id);
        if (!foundClass) return res.status(404).json({ error: 'Class not found.' });
        res.json({ message: 'Class deleted.' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete class.' });
    }
});

// ENROL STUDENTS — admin or the class's own teacher
router.post('/:id/enrol', authenticateToken, authorizeRoles('admin', 'teacher'), async (req, res) => {
    try {
        const { studentIds } = req.body;

        const foundClass = await Class.findById(req.params.id);
        if (!foundClass) return res.status(404).json({ error: 'Class not found.' });

        if (req.user.role === 'teacher' &&
            foundClass.teacher.toString() !== req.user.id) {
            return res.status(403).json({ error: 'You can only enrol students in your own class.' });
        }

        const updated = await Class.findByIdAndUpdate(
            req.params.id,
            { $addToSet: { students: { $each: studentIds } } },
            { new: true }
        ).populate('students', 'name email');

        res.json({ message: 'Students enrolled!', class: updated });
    } catch (err) {
        res.status(500).json({ error: 'Failed to enrol students.' });
    }
});

module.exports = router;