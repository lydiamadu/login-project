const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Grade = require('../models/Grade');
const Class = require('../models/Class');
const User = require('../models/User');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// Helper: calculate grade from total score using Nigerian grading scale
const calculateGrade = (totalScore) => {
    if (totalScore >= 70) return 'A';
    if (totalScore >= 60) return 'B';
    if (totalScore >= 50) return 'C';
    if (totalScore >= 45) return 'D';
    if (totalScore >= 40) return 'E';
    return 'F';
};

// POST GRADES — class teacher or admin
router.post('/', authenticateToken, authorizeRoles('ADMIN', 'TEACHER'), async (req, res) => {
    try {
        const { studentId, classId, term, academicYear, results, comment } = req.body;

        // Validate IDs
        if (!isValidObjectId(studentId)) {
            return res.status(400).json({ error: 'Invalid student ID.' });
        }
        if (!isValidObjectId(classId)) {
            return res.status(400).json({ error: 'Invalid class ID.' });
        }

        // Check class exists
        const foundClass = await Class.findById(classId);
        if (!foundClass) {
            return res.status(404).json({ error: 'Class not found.' });
        }

        // Teacher can only post grades for their own class
        if (req.user.role === 'TEACHER' && foundClass.teacher.toString() !== req.user.id) {
            return res.status(403).json({ error: 'You can only post grades for your own class.' });
        }

        // Check student exists and has role STUDENT
        const student = await User.findById(studentId);
        if (!student || student.role !== 'STUDENT') {
            return res.status(404).json({ error: 'Student not found.' });
        }

        // Check student is enrolled in this class
        const isEnrolled = foundClass.students.map(id => id.toString()).includes(studentId);
        if (!isEnrolled) {
            return res.status(400).json({ error: 'Student is not enrolled in this class.' });
        }

        // Check for duplicate grade entry
        const existingGrade = await Grade.findOne({ student: studentId, class: classId, term, academicYear });
        if (existingGrade) {
            return res.status(409).json({ error: 'A result sheet already exists for this student, class, term and year. Use PUT to update it.' });
        }

        // Validate and calculate scores for each subject
        if (!results || results.length === 0) {
            return res.status(400).json({ error: 'At least one subject result is required.' });
        }

        const processedResults = results.map(subject => {
            if (subject.firstTest < 0 || subject.firstTest > 20) {
                throw new Error(`First test score for ${subject.subject} must be between 0 and 20.`);
            }
            if (subject.secondTest < 0 || subject.secondTest > 20) {
                throw new Error(`Second test score for ${subject.subject} must be between 0 and 20.`);
            }
            if (subject.examScore < 0 || subject.examScore > 60) {
                throw new Error(`Exam score for ${subject.subject} must be between 0 and 60.`);
            }

            const totalScore = subject.firstTest + subject.secondTest + subject.examScore;
            const grade = calculateGrade(totalScore);

            return {
                subject: subject.subject,
                firstTest: subject.firstTest,
                secondTest: subject.secondTest,
                examScore: subject.examScore,
                totalScore,
                grade
            };
        });

        // Calculate average and overall grade
        const average = processedResults.reduce((sum, s) => sum + s.totalScore, 0) / processedResults.length;
        
        // BUG FIX: Passed the raw average value straight into the function instead of Math.round()
        const overallGrade = calculateGrade(average);

        const newGrade = await Grade.create({
            student: studentId,
            class: classId,
            term,
            academicYear,
            results: processedResults,
            average: Math.round(average * 10) / 10,
            overallGrade,
            comment,
            gradedBy: req.user.id
        });

        res.status(201).json({ message: 'Grades posted successfully!', grade: newGrade });

    } catch (err) {
        if (err.message.includes('must be between')) {
            return res.status(400).json({ error: err.message });
        }
        console.error('Post grades error:', err);
        res.status(500).json({ error: 'Failed to post grades.' });
    }
});

// UPDATE GRADES — class teacher or admin
router.put('/:id', authenticateToken, authorizeRoles('ADMIN', 'TEACHER'), async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ error: 'Invalid grade ID.' });
        }

        const existingGrade = await Grade.findById(req.params.id);
        if (!existingGrade) {
            return res.status(404).json({ error: 'Grade record not found.' });
        }

        // Teacher can only update grades for their own class
        if (req.user.role === 'TEACHER') {
            const foundClass = await Class.findById(existingGrade.class);
            
            // BUG FIX: Added a safety check to ensure the class exists in DB before accessing .teacher properties
            if (!foundClass) {
                return res.status(404).json({ error: 'Associated class record not found.' });
            }
            
            if (foundClass.teacher.toString() !== req.user.id) {
                return res.status(403).json({ error: 'You can only update grades for your own class.' });
            }
        }

        const { results, comment } = req.body;

        if (!results || results.length === 0) {
            return res.status(400).json({ error: 'At least one subject result is required.' });
        }

        // Recalculate scores
        const processedResults = results.map(subject => {
            if (subject.firstTest < 0 || subject.firstTest > 20) {
                throw new Error(`First test score for ${subject.subject} must be between 0 and 20.`);
            }
            if (subject.secondTest < 0 || subject.secondTest > 20) {
                throw new Error(`Second test score for ${subject.subject} must be between 0 and 20.`);
            }
            if (subject.examScore < 0 || subject.examScore > 60) {
                throw new Error(`Exam score for ${subject.subject} must be between 0 and 60.`);
            }

            const totalScore = subject.firstTest + subject.secondTest + subject.examScore;
            const grade = calculateGrade(totalScore);

            return {
                subject: subject.subject,
                firstTest: subject.firstTest,
                secondTest: subject.secondTest,
                examScore: subject.examScore,
                totalScore,
                grade
            };
        });

        const average = processedResults.reduce((sum, s) => sum + s.totalScore, 0) / processedResults.length;
        
        // BUG FIX: Passed the raw average value straight into the function instead of Math.round()
        const overallGrade = calculateGrade(average);

        const updated = await Grade.findByIdAndUpdate(
            req.params.id,
            {
                results: processedResults,
                average: Math.round(average * 10) / 10,
                overallGrade,
                comment
            },
            { new: true }
        );

        res.status(200).json({ message: 'Grades updated successfully!', grade: updated });

    } catch (err) {
        if (err.message.includes('must be between')) {
            return res.status(400).json({ error: err.message });
        }
        console.error('Update grades error:', err);
        res.status(500).json({ error: 'Failed to update grades.' });
    }
});

// GET GRADES — filtered by role
router.get('/:studentId', authenticateToken, async (req, res) => {
    try {
        if (!isValidObjectId(req.params.studentId)) {
            return res.status(400).json({ error: 'Invalid student ID.' });
        }

        const { term, academicYear } = req.query;
        const { studentId } = req.params;

        // Students can only view their own results
        if (req.user.role === 'STUDENT' && req.user.id !== studentId) {
            return res.status(403).json({ error: 'You can only view your own results.' });
        }

        // Parents can only view their children's results
        if (req.user.role === 'PARENT') {
            const parent = await User.findById(req.user.id);
            const isMyChild = parent.children.map(id => id.toString()).includes(studentId);
            if (!isMyChild) {
                return res.status(403).json({ error: 'You can only view results for your own children.' });
            }
        }

        // Teachers can only view results for students in their class
        if (req.user.role === 'TEACHER') {
            const teacherClass = await Class.findOne({ teacher: req.user.id, students: studentId });
            const teacher = await User.findById(req.user.id);
            const isMyChild = teacher.children.map(id => id.toString()).includes(studentId);
            if (!teacherClass && !isMyChild) {
                return res.status(403).json({ error: 'You can only view results for students in your class or your own children.' });
            }
            
        }

        // Build query
        const query = { student: studentId };
        if (term) query.term = term;
        if (academicYear) query.academicYear = academicYear;

        const gradeRecord = await Grade.findOne(query)
            .populate('student', 'name email')
            .populate('class', 'name level')
            .populate('gradedBy', 'name');

        if (!gradeRecord) {
            return res.status(404).json({ error: 'No result found for this student.' });
        }

        res.status(200).json({
            student: gradeRecord.student.name,
            class: gradeRecord.class.name,
            level: gradeRecord.class.level,
            term: gradeRecord.term,
            academicYear: gradeRecord.academicYear,
            results: gradeRecord.results,
            average: gradeRecord.average,
            overallGrade: gradeRecord.overallGrade,
            comment: gradeRecord.comment,
            gradedBy: gradeRecord.gradedBy.name
        });

    } catch (err) {
        console.error('Get grades error:', err);
        res.status(500).json({ error: 'Failed to fetch results.' });
    }
});

module.exports = router;