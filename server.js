const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json()); // Allows the server to read JSON data

const USERS_DB = []; // Temporary database for testing
const JWT_SECRET = 'your_super_secret_key'; // Used to sign login tokens

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


app.post('/api/save-name', (req, res) => {
    const { name, email } = req.body;
    
    // 1. Validation check
    if (!name || !email) {
        return res.status(400).json({ error: "Please provide both a name and an email." });
    }

    // 2. Find the user in your USERS_DB array by their email
    const userIndex = USERS_DB.findIndex(u => u.email === email);

    // 3. If the user doesn't exist in the array, stop and send an error
    if (userIndex === -1) {
        return res.status(404).json({ error: "User not found. Please register first." });
    }

  

        USERS_DB[userIndex].name = name;

    // 5. Send back the success response with the updated user data
    res.status(200).json({ 
        message: "Name saved successfully to user profile!", 
        updatedUser: USERS_DB[userIndex]
    });
})

// 4. RETRIEVE PROFILE ENDPOINT (NEW)
// This uses 'authenticateToken' to safely read who is asking for their name
// 4. RETRIEVE NAME ENDPOINT (CORRECTED GET METHOD)
app.get('/api/get-name', (req, res) => {
    // GET requests read from req.query instead of req.body
    const { email } = req.body; 

    // 1. Validation check
    if (!email) {
        return res.status(400).json({ error: "Please provide an email query parameter." });
    }

    // 2. Find the user in your USERS_DB array
    const user = USERS_DB.find(u => u.email === email);

    // 3. If user doesn't exist, return error
    if (!user) {
        return res.status(404).json({ error: "User not found." });
    }

    // 4. Check if they have a name saved
    if (!user.name) {
        return res.status(404).json({ error: "No name has been saved for this user yet." });
    }

    // 5. Return the saved name
    res.status(200).json({
        message: "Name retrieved successfully!",
        name: user.name
    });
});


app.listen(3000, () => console.log('Server running on port 3000'));

