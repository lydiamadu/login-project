const request = require('supertest');
const db = require('../jest.setup');
const app = require('../app');
const User = require('../models/User');

beforeAll(async () => { await db.connect(); });
afterAll(async () => { await db.disconnect(); });
afterEach(async () => { await db.clear(); });

describe('POST /api/register', () => {
    it('registers a new user', async () => {
        const res = await request(app)
            .post('/api/register')
            .send({ email: 'test@example.com', password: 'Pass123!' });

        expect(res.status).toBe(201);
        expect(res.body.message).toBe('User registered successfully!');
    });

    it('defaults role to student', async () => {
        await request(app)
            .post('/api/register')
            .send({ email: 'student@example.com', password: 'Pass123!' });

        const user = await User.findOne({ email: 'student@example.com' });
        expect(user.role).toBe('student');
    });

    it('blocks admin self-assignment', async () => {
        await request(app)
            .post('/api/register')
            .send({ email: 'hacker@example.com', password: 'Pass123!', role: 'admin' });

        const user = await User.findOne({ email: 'hacker@example.com' });
        expect(user.role).toBe('student');
    });

    it('rejects duplicate email', async () => {
        await request(app)
            .post('/api/register')
            .send({ email: 'dup@example.com', password: 'Pass123!' });

        const res = await request(app)
            .post('/api/register')
            .send({ email: 'dup@example.com', password: 'Pass123!' });

        expect(res.status).toBe(409);
    });

    it('rejects missing email', async () => {
        const res = await request(app)
            .post('/api/register')
            .send({ password: 'Pass123!' });

        expect(res.status).toBe(400);
    });

    it('rejects missing password', async () => {
        const res = await request(app)
            .post('/api/register')
            .send({ email: 'no-pass@example.com' });

        expect(res.status).toBe(400);
    });
});

describe('POST /api/login', () => {
    beforeEach(async () => {
        await request(app)
            .post('/api/register')
            .send({ email: 'login@example.com', password: 'Pass123!' });
    });

    it('logs in with correct credentials', async () => {
        const res = await request(app)
            .post('/api/login')
            .send({ email: 'login@example.com', password: 'Pass123!' });

        expect(res.status).toBe(200);
        expect(res.body.token).toBeDefined();
        expect(res.body.role).toBe('student');
    });

    it('rejects wrong password', async () => {
        const res = await request(app)
            .post('/api/login')
            .send({ email: 'login@example.com', password: 'wrong' });

        expect(res.status).toBe(400);
    });

    it('rejects non-existent email', async () => {
        const res = await request(app)
            .post('/api/login')
            .send({ email: 'ghost@example.com', password: 'Pass123!' });

        expect(res.status).toBe(400);
    });

    it('rejects missing fields', async () => {
        const res = await request(app)
            .post('/api/login')
            .send({});

        expect(res.status).toBe(400);
    });
});

describe('Protected routes', () => {
    it('rejects requests without token', async () => {
        const res = await request(app).get('/api/get-name');
        expect(res.status).toBe(401);
    });

    it('rejects invalid token', async () => {
        const res = await request(app)
            .get('/api/get-name')
            .set('Authorization', 'Bearer invalidtoken');

        expect(res.status).toBe(403);
    });
});

describe('POST /api/save-name + GET /api/get-name', () => {
    let token;

    beforeEach(async () => {
        await request(app)
            .post('/api/register')
            .send({ email: 'named@example.com', password: 'Pass123!' });

        const login = await request(app)
            .post('/api/login')
            .send({ email: 'named@example.com', password: 'Pass123!' });

        token = login.body.token;
    });

    it('saves and retrieves a name', async () => {
        await request(app)
            .post('/api/save-name')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Lydia' })
            .expect(200);

        const res = await request(app)
            .get('/api/get-name')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.name).toBe('Lydia');
    });

    it('rejects empty name', async () => {
        const res = await request(app)
            .post('/api/save-name')
            .set('Authorization', `Bearer ${token}`)
            .send({});

        expect(res.status).toBe(400);
    });

    it('returns 404 when no name saved yet', async () => {
        const res = await request(app)
            .get('/api/get-name')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(404);
    });
});
