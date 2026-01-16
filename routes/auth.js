const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');         // Student model
const Newtutor = require('../models/Newtutor'); // Tutor model
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
  // Course model
const Notice = require('../models/Notice');   // Notice model - You need to create this

// Admin credentials (store securely in production)
const USERNAME = 'admin123';
const PASSWORD = 'admin@123';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Create memory storage
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Function to upload buffer to Cloudinary
const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'p2p-learning/students',
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif'],
        transformation: [
          { width: 500, height: 500, crop: 'fill', gravity: 'face' }
        ]
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

// ==================== STUDENT REGISTRATION ====================
router.post('/register', upload.single('profileImage'), async (req, res) => {
  try {
    const { username, password, email, name } = req.body;
    
    // Validate required fields
    if (!username || !password || !email || !name) {
      req.flash('error', 'Username, password, email, and name are required');
      return res.redirect('/signup');
    }

    // Check if username already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      req.flash('error', 'Username already exists');
      return res.redirect('/signup');
    }

    // Check if email already exists
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      req.flash('error', 'Email already registered');
      return res.redirect('/signup');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    // Initialize user data
    let imageUrl = '';

    // Handle profile image upload to Cloudinary
    if (req.file) {
      try {
        const result = await uploadToCloudinary(req.file.buffer);
        imageUrl = result.secure_url;
      } catch (uploadError) {
        console.error('Cloudinary upload error:', uploadError);
        req.flash('error', 'Failed to upload profile image. Please try again.');
        return res.redirect('/signup');
      }
    } else {
      // Set default profile image URL
      imageUrl = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=500&q=80';
    }

    // Prepare user data
    const userData = {
      username,
      password: hashed,
      email,
      name,
      userclass: 'student',
      image: imageUrl
    };

    // Create user
    const user = await User.create(userData);

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user._id,
        username: user.username, 
        name: user.name,
        email: user.email,
        userclass: user.userclass,
        image: user.image
      },
      process.env.JWT_SECRET || 'yourSecretKey',
      { expiresIn: '1d' }
    );

    // Set cookie and redirect
    res.cookie('token', token, { 
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000
    });

    req.flash('success', 'Account created successfully! Welcome to P2P Learning!');
    res.redirect('/signup');
    
  } catch (error) {
    console.error('Registration error:', error);
    
    // Handle specific errors
    if (error.code === 'LIMIT_FILE_SIZE') {
      req.flash('error', 'Image size should be less than 2MB');
    } else if (error.message && error.message.includes('Only image files')) {
      req.flash('error', 'Please upload only image files (JPG, PNG, GIF)');
    } else if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      req.flash('error', messages.join(', '));
    } else if (error.code === 11000) {
      if (error.keyPattern && error.keyPattern.username) {
        req.flash('error', 'Username already exists');
      } else if (error.keyPattern && error.keyPattern.email) {
        req.flash('error', 'Email already registered');
      } else {
        req.flash('error', 'Duplicate field value');
      }
    } else {
      req.flash('error', 'Registration failed. Please try again.');
    }
    
    res.redirect('/signup');
  }
});

// ==================== LOGIN ROUTE ====================
router.post('/log', async (req, res) => {
  const { username, password, userclass } = req.body;

  // ✅ Admin Login
  if (userclass === 'admin') {
    if (username === USERNAME && password === PASSWORD) {
      const token = jwt.sign(
        { username: USERNAME, role: 'admin' },
        process.env.JWT_SECRET || 'yourSecretKey',
        { expiresIn: '1h' }
      );

      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 1000 * 60 * 60
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

  // Store user image in token if available
  const tokenPayload = {
    username: user.username, 
    id: user._id, 
    role: userclass,
    name: user.name || user.username,
    email: user.email || ''
  };

  // Add image to token if it exists
  if (user.image) {
    tokenPayload.image = user.image;
  }

  const token = jwt.sign(
    tokenPayload,
    process.env.JWT_SECRET || 'yourSecretKey',
    { expiresIn: '1d' }
  );

  res.cookie('token', token, { 
    httpOnly: true, 
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 
  });

  req.flash('success', 'Login successful');
  
  // Redirect based on user class
  if (userclass === 'student') {
    return res.redirect('/dash');
  } else if (userclass === 'tutor') {
    return res.redirect('/dashboard');
  }
});

// ==================== STUDENT DASHBOARD ====================


// ==================== TUTOR DASHBOARD ====================
router.get('/dashboard', async (req, res) => {
  try {
    // Get token from cookie
    const token = req.cookies.token;
    
    if (!token) {
      req.flash('error', 'Please login first');
      return res.redirect('/login');
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'yourSecretKey');
    
    // Check if user is a tutor
    if (decoded.role !== 'tutor') {
      req.flash('error', 'Access denied. Tutor area only.');
      return res.redirect('/login');
    }

    // Find tutor in database
    const user = await Newtutor.findById(decoded.id).select('-password');
    const notices = [];
    
    if (!user) {
      res.clearCookie('token');
      req.flash('error', 'Tutor not found');
      return res.redirect('/login');
    }

    // Fetch tutor's courses
    let courses = [];
    try {
      courses = await Course.find({ tutorId: user._id });
    } catch (courseError) {
      console.log('No courses found');
    }

    // Render tutor dashboard
    res.render('dashboard', {
      title: 'Tutor Dashboard',
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        email: user.email || '',
        phone: user.phone || '',
        skills: user.skills || '',
        branch: user.branch || '',
        image: user.image || '',
        userclass: user.userclass,
        approved: user.approved
       
      },
       tutor: user,
      courses: courses || [],
        notices: notices,
      successMessage: req.flash('success'),
      errorMessage: req.flash('error')
    });

  } catch (error) {
    console.error('Tutor dashboard error:', error);
    
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      res.clearCookie('token');
      req.flash('error', 'Session expired. Please login again.');
      return res.redirect('/login');
    }
    
    req.flash('error', 'Unable to load dashboard');
    res.redirect('/login');
  }
});

// ==================== SIMPLE LOGIN (Alternative) ====================
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      req.flash('error', 'Username and password are required');
      return res.redirect('/login');
    }
    
    // Try to find user as student
    let user = await User.findOne({ username });
    let userRole = 'student';
    
    // If not found as student, try as tutor
    if (!user) {
      user = await Newtutor.findOne({ username });
      userRole = 'tutor';
    }
    
    // If still not found
    if (!user) {
      req.flash('error', 'Invalid username or password');
      return res.redirect('/login');
    }
    
    // Check if tutor is approved
    if (userRole === 'tutor' && !user.approved) {
      req.flash('error', 'Your account is pending admin approval');
      return res.redirect('/login');
    }
    
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      req.flash('error', 'Invalid username or password');
      return res.redirect('/login');
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user._id,
        username: user.username, 
        name: user.name,
        email: user.email,
        userclass: userRole,
        image: user.image
      },
      process.env.JWT_SECRET || 'yourSecretKey',
      { expiresIn: '1d' }
    );
    
    // Set cookie
    res.cookie('token', token, { 
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000
    });
    
    req.flash('success', 'Login successful!');
    
    // Redirect based on role
    if (userRole === 'student') {
      res.redirect('/dash');
    } else {
      res.redirect('/dashboard');
    }
    
  } catch (error) {
    console.error('Login error:', error);
    req.flash('error', 'Login failed. Please try again.');
    res.redirect('/login');
  }
});

// ==================== LOGOUT ====================
router.get('/logout', (req, res) => {
  res.clearCookie('token');
  req.flash('success', 'Logged out successfully');
  res.redirect('/login');
});



module.exports = router;