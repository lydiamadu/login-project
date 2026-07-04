const request = require('supertest');
const mongoose = require('mongoose');
const db = require('../jest.setup');
const app = require('../app');
const User = require('../models/User');

beforeAll(async () => { await db.connect(); });
afterAll(async () => { await db.disconnect(); });
afterEach(async () => { await db.clear(); });

const VALID_PASSWORD = 'Pass123!';

async function registerAndLogin(email, password, role) {
    const bcrypt = require('bcryptjs');
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ email, password: hashed, role });
    const login = await request(app)
        .post('/api/login')
        .send({ email, password });
    return { user, token: login.body.token };
}

describe('Class CRUD', () => {
    let adminToken, teacherToken, studentToken;
    let teacher, student;

    beforeEach(async () => {
        const admin = await registerAndLogin('admin@school.com', VALID_PASSWORD, 'ADMIN');
        adminToken = admin.token;

        const t = await registerAndLogin('teacher@school.com', VALID_PASSWORD, 'TEACHER');
        teacherToken = t.token;
        teacher = t.user;

        const s = await registerAndLogin('student@school.com', VALID_PASSWORD, 'STUDENT');
        studentToken = s.token;
        student = s.user;
    });

    const classData = () => ({
        name: 'Physics SS2',
        classType: 'science',
        level: 'SS2',
        term: 'First Term',
        teacher: teacher._id.toString(),
        subjects: ['Physics'],
    });

    describe('POST /api/classes', () => {
        it('admin can create a class', async () => {
            const res = await request(app)
                .post('/api/classes')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(classData());

            expect(res.status).toBe(201);
            expect(res.body.class.name).toBe('Physics SS2');
        });

        it('teacher cannot create a class', async () => {
            const res = await request(app)
                .post('/api/classes')
                .set('Authorization', `Bearer ${teacherToken}`)
                .send(classData());

            expect(res.status).toBe(403);
        });

        it('student cannot create a class', async () => {
            const res = await request(app)
                .post('/api/classes')
                .set('Authorization', `Bearer ${studentToken}`)
                .send(classData());

            expect(res.status).toBe(403);
        });
    });

    describe('GET /api/classes', () => {
        it('admin gets classes grouped by level', async () => {
            await request(app)
                .post('/api/classes')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(classData());

            const res = await request(app)
                .get('/api/classes')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('SS2');
            expect(res.body.SS2).toHaveLength(1);
        });
    });

    describe('GET /api/classes/:id', () => {
        it('returns a single class', async () => {
            const created = await request(app)
                .post('/api/classes')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(classData());

            const res = await request(app)
                .get(`/api/classes/${created.body.class._id}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.name).toBe('Physics SS2');
        });

        it('returns 404 for unknown id', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .get(`/api/classes/${fakeId}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(404);
        });
    });

    describe('PUT /api/classes/:id', () => {
        it('admin can update any class', async () => {
            const created = await request(app)
                .post('/api/classes')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(classData());

            const res = await request(app)
                .put(`/api/classes/${created.body.class._id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'Chemistry SS2' });

            expect(res.status).toBe(200);
            expect(res.body.class.name).toBe('Chemistry SS2');
        });

        it('teacher can update own class', async () => {
            const created = await request(app)
                .post('/api/classes')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(classData());

            const res = await request(app)
                .put(`/api/classes/${created.body.class._id}`)
                .set('Authorization', `Bearer ${teacherToken}`)
                .send({ name: 'Updated Physics' });

            expect(res.status).toBe(200);
        });

        it('teacher cannot update another teacher\'s class', async () => {
            const otherTeacher = await registerAndLogin('other@school.com', VALID_PASSWORD, 'TEACHER');

            const created = await request(app)
                .post('/api/classes')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(classData());

            const res = await request(app)
                .put(`/api/classes/${created.body.class._id}`)
                .set('Authorization', `Bearer ${otherTeacher.token}`)
                .send({ name: 'Hijacked' });

            expect(res.status).toBe(403);
        });
    });

    describe('DELETE /api/classes/:id', () => {
        it('admin can delete a class', async () => {
            const created = await request(app)
                .post('/api/classes')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(classData());

            const res = await request(app)
                .delete(`/api/classes/${created.body.class._id}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
        });

        it('teacher cannot delete a class', async () => {
            const created = await request(app)
                .post('/api/classes')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(classData());

            const res = await request(app)
                .delete(`/api/classes/${created.body.class._id}`)
                .set('Authorization', `Bearer ${teacherToken}`);

            expect(res.status).toBe(403);
        });
    });

    describe('POST /api/classes/:id/enrol', () => {
        it('admin can enrol students', async () => {
            const created = await request(app)
                .post('/api/classes')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(classData());

            const res = await request(app)
                .post(`/api/classes/${created.body.class._id}/enrol`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ studentIds: [student._id.toString()] });

            expect(res.status).toBe(200);
            expect(res.body.class.students).toHaveLength(1);
        });
    });
});
