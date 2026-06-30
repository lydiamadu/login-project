const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Class = require('../models/Class');
const User = require('../models/User');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// CREATE — admin only
router.post('/', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
    try {
        const {
            name, classType, level, term,
            teacher, subjects, schedule, capacity, description
        } = req.body;

        const foundTeacher = await User.findById(teacher);
        if (!foundTeacher) {
            return res.status(404).json({ error: 'Teacher not found.' });
        }

        if (foundTeacher.role !== 'TEACHER') {
            return res.status(400).json({ error: 'The specified user is not a teacher.' });
        }

        if (!subjects || subjects.length === 0) {
            return res.status(400).json({ error: 'A class must have at least one subject.' });
        }

        const newClass = await Class.create({
            name, classType, level, term,
            teacher, subjects, schedule, capacity, description
        });

        res.status(201).json({ message: 'Class created!', class: newClass });
    } catch (err) {
        console.error('Create class error:', err);
        res.status(500).json({ error: 'Failed to create class.' });
    }
});

// GET CLASSES - fILTERED BY ROLE
router.get('/', authenticateToken, async (req, res) => {
    try {
        let classes;
        if (req.user.role === 'ADMIN' || req.user.role === 'TEACHER') {
            classes = await Class.find()
                .populate('teacher', 'name')
                .select('name level classType teacher students capacity');
        } else if (req.user.role === 'STUDENT') {
            classes = await Class.find({ students: req.user.id })
                .populate('teacher', 'name')
                .select('name level classType teacher students capacity');
        } else if (req.user.role === 'PARENT') {
            const parent = await User.findById(req.user.id);
            classes = await Class.find({ students: { $in: parent.children } })
                .populate('teacher', 'name')
                .select('name level classType teacher students capacity');
        }

        //Group by level for admin and teacher 
        if (req.user.role === 'ADMIN' || req.user.role === 'TEACHER') {
            const levelOrder = ['JSS1','JSS2','JSS3','SS1','SS2','SS3'];
            const grouped = classes.reduce((acc, cls) => {
                if (!acc[cls.level]) {
                    acc[cls.level] = [];
                }
                acc[cls.level].push({
                    _id: cls._id,
                    name: cls.name,
                    classType: cls.classType,
                    teacher: cls.teacher ? cls.teacher.name : 'Not assigned',
                    totalStudents: cls.students.length,
                    capacity: cls.capacity
                });
                return acc;
            }, {});

            const sorted = {};
            levelOrder.forEach(level => {
                if (grouped[level]) {
                    sorted[level] = grouped[level];
                }
            });
            return res.status(200).json(sorted);
        }
        res.status(200).json(classes);
    } catch (err) {
        console.error('Get classes error:', err);
        res.status(500).json({ error: 'Failed to fetch classes.' });
    }
});


       
// READ ONE — any logged-in user
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ error: 'Invalid class ID.' });
        }
        
        const foundClass = await Class.findById(req.params.id)
            .populate('teacher', 'name email')
            .populate('students', 'name email');

            if (!foundClass) {
            return res.status(404).json({ error: 'Class not found.' });
        }

        if (req.user.role === 'STUDENT' &&
            !foundClass.students.map(s => s._id.toString()).includes(req.user.id)) {
            return res.status(403).json({ error: 'You can only view your own class.' });
        }

        if (req.user.role === 'PARENT') {
            const parent = await User.findById(req.user.id);
            const hasChild = foundClass.students.some(s =>
                parent.children.map(id => id.toString()).includes(s._id.toString())
            );

            if (!hasChild) {
                return res.status(403).json({ error: 'You can only view your children\'s class.' });
            }
        }

        res.status(200).json(foundClass);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch class.' });
    }
});



// UPDATE — admin can edit any, teacher can only edit their own
router.put('/:id', authenticateToken, authorizeRoles('ADMIN', 'TEACHER'), async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ error: 'Invalid class ID.' });
        }
        const foundClass = await Class.findById(req.params.id);
        if (!foundClass) return res.status(404).json({ error: 'Class not found.' });

        // Ownership check — only blocks teachers, not admins
        if (req.user.role === 'TEACHER' &&
            foundClass.teacher.toString() !== req.user.id) {
            return res.status(403).json({ error: 'You can only edit your own class.' });
        }

        if (req.body.teacher) {
            if (!isValidObjectId(req.body.teacher)) {
                return res.status(400).json({ error: 'Invalid teacher ID.' });
            }
            const newTeacher = await User.findById(req.body.teacher);
            if (!newTeacher) {
                return res.status(404).json({ error: 'New teacher not found.' });
            }
            if (newTeacher.role !== 'TEACHER') {
                return res.status(400).json({ error: 'The specified user is not a teacher.' });
            }
        }

        const updated = await Class.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        res.status(200).json({ message: 'Class updated!', class: updated });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update class.' });
}
});

// DELETE — admin only
router.delete('/:id', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ error: 'Invalid class ID.' });
        }
        const foundClass = await Class.findByIdAndDelete(req.params.id);
        if (!foundClass) return res.status(404).json({ error: 'Class not found.' });
        res.json({ message: 'Class deleted.' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete class.' });
    }
});

// ENROL STUDENTS — admin or the class's own teacher
router.post('/:id/enrol', authenticateToken, authorizeRoles('ADMIN', 'TEACHER'), async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ error: 'Invalid class ID.' });
        }
        const { studentIds } = req.body;

        const foundClass = await Class.findById(req.params.id);
        if (!foundClass) return res.status(404).json({ error: 'Class not found.' });

        if (req.user.role === 'TEACHER' &&
            foundClass.teacher.toString() !== req.user.id) {
            return res.status(403).json({ error: 'You can only enrol students in your own class.' });
        }

        const students = await User.find({ _id: { $in: studentIds }, role: 'STUDENT' });
        if (students.length !== studentIds.length) {
            return res.status(400).json({ error: 'One or more student IDs are invalid.' });
        }
        const currentCount = foundClass.students.length;
        if (foundClass.capacity && currentCount + studentIds.length > foundClass.capacity) {
            return res.status(400).json({ error: 'Enrolling these students would exceed the class capacity.' });
        }

        const updated = await Class.findByIdAndUpdate(
            req.params.id,
            { $addToSet: { students: { $each: studentIds } } },
            { new: true }
        ).populate('students', 'name email');

        res.status(200).json({ message: 'Students enrolled!', class: updated });
    } catch (err) {
        res.status(500).json({ error: 'Failed to enrol students.' });
    }
});

module.exports = router;