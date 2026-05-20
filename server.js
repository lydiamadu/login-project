const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json()); // Allows the server to read JSON data

const USERS_DB = []; // Temporary database for testing
const JWT_SECRET = 'your_super_secret_key'; // Used to sign login tokens

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Extracts token from "Bearer <token>"

    if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
        req.user = user; // Attach decoded token data (email) to the request
        next();
    });
};

// 1. REGISTER ENDPOINT
app.post('/api/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Hash the password before saving
        const hashedPassword = await bcrypt.hash(password, 10);
        
        USERS_DB.push({ email, password: hashedPassword });
        res.status(201).json({ message: 'User registered successfully!' });
    } catch {
        res.status(500).json({ error: 'Registration failed.' });
    }
});

// 2. LOGIN ENDPOINT
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    
    // Find the user
    const user = USERS_DB.find(u => u.email === email);
    if (!user) return res.status(400).json({ error: 'User not found.' });

    // Compare entered password with the hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials.' });

    // Generate a secure login token (JWT)
    const token = jwt.sign({ email: user.email }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ message: 'Login successful!', token });
});

// 3. SAVE NAME ENDPOINT
app.post('/api/save-name', authenticateToken, (req, res) => {
    const { name } = req.body;
    const email = req.user.email; // ✅ Comes from the verified token

    if (!name) {
        return res.status(400).json({ error: "Please provide a name." });
    }

    const userIndex = USERS_DB.findIndex(u => u.email === email);

    if (userIndex === -1) {
        return res.status(404).json({ error: "User not found." });
    }

    USERS_DB[userIndex].name = name;

    res.status(200).json({ 
        message: "Name saved successfully!", 
        updatedUser: USERS_DB[userIndex]
    });
});

// 4. RETRIEVE PROFILE ENDPOINT (NEW)
// This uses 'authenticateToken' to safely read who is asking for their name
// 4. RETRIEVE NAME ENDPOINT (CORRECTED GET METHOD)
app.get('/api/get-name', authenticateToken, (req, res) => {
    const email = req.user.email; // ✅ Comes from the verified token

    const user = USERS_DB.find(u => u.email === email);

    if (!user) {
        return res.status(404).json({ error: "User not found." });
    }

    if (!user.name) {
        return res.status(404).json({ error: "No name saved yet." });
    }

    res.status(200).json({
        message: "Name retrieved successfully!",
        name: user.name
    });
});


app.listen(3000, () => console.log('Server running on port 3000'));

