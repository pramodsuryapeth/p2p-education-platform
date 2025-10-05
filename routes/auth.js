const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');         // Student model
const Newtutor = require('../models/Newtutor'); // Tutor model
// Replace with secure storage in production
const USERNAME = 'admin123';
const PASSWORD = 'admin@123';

// Student Registration
router.post('/register', async (req, res) => {
    const { username, password, email, age, name } = req.body;

    const existingUser = await User.findOne({ username });
    if (existingUser) {
        req.flash('error', 'User already exists');
        return res.redirect('/signup');
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    const user = await User.create({
        username,
        password: hashed,
        email,
        age,
        name,
        userclass: 'student'
    });

    const token = jwt.sign(
        { username: user.username, id: user._id, role: 'student' },
        'yourSecretKey',
        { expiresIn: '1d' }
    );

    res.cookie('token', token, { httpOnly: true });
    req.flash('success', 'User created successfully');
    res.redirect('/signup');
});

// Tutor Registration
router.post('/tutor/register', async (req, res) => {
    const { username, password, name, phone, skills, branch } = req.body;

    const existingTutor = await Newtutor.findOne({ username });
    if (existingTutor) {
        req.flash('error', 'Tutor already exists');
        return res.redirect('/tutorregister');
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    const tutor = await Newtutor.create({
        username,
        password: hashed,
        name,
        phone,
        skills,
        branch,
        userclass: 'tutor',
        approved: false // pending admin approval
    });

    req.flash('success', 'Tutor registered. Awaiting admin approval.');
    res.redirect('/login');
});

// Login (Student or Tutor)
router.post('/log', async (req, res) => {
    const { username, password, userclass } = req.body;

    // ✅ Admin Login Handling
 if (userclass === 'admin') {
        const USERNAME = 'admin123';
        const PASSWORD = 'admin@123';

        if (username === USERNAME && password === PASSWORD) {
            const token = jwt.sign(
                { username: USERNAME, role: 'admin' },
                'yourSecretKey',
                { expiresIn: '1h' }
            );

            res.cookie('token', token, {
                httpOnly: true,
                secure: false,
                maxAge: 1000 * 60 * 60 // 1 hour
            });

            req.flash('success', 'Admin login successful');
            return res.redirect('/admin');
        } else {
            req.flash('error', 'Invalid admin credentials');
            return res.redirect('/login');
        }
    }


    // ✅ Student or Tutor Login
    const user =
        userclass === 'student'
            ? await User.findOne({ username, userclass })
            : await Newtutor.findOne({ username, userclass });

    if (!user) {
        req.flash('error', 'User not found');
        return res.redirect('/login');
    }

    if (userclass === 'tutor' && !user.approved) {
        req.flash('error', 'Your account is pending admin approval');
        return res.redirect('/login');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        req.flash('error', 'Invalid password');
        return res.redirect('/login');
    }

    const token = jwt.sign(
        { username: user.username, id: user._id, role: userclass },
        'yourSecretKey',
        { expiresIn: '1d' }
    );

    res.cookie('token', token, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });

    req.flash('success', 'Login successful');
    return res.redirect(userclass === 'student' ? '/dash' : '/dashboard');
});


// Logout
router.get('/logout', (req, res) => {
    res.clearCookie('token');
    req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;
