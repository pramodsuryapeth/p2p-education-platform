const express = require('express');
const router = express.Router();
const Newtutor = require('../models/Newtutor');
const Course = require('../models/Video'); // your Course schema
const Rating = require('../models/Rating'); 
const User = require('../models/User'); // <-- IMPORTANT
const multer = require('multer');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Notice = require('../models/Notice');
const path = require('path');
const { isLogged, isTutor, isStudent } = require('../middleware/authMiddleware');
const FirebaseStorage = require('../utils/firebaseStorage'); // Import Firebase Storage

// ===== Multer File Upload Config =====
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  }
});
// ================== Tutor Routes ==================

// Tutor Dashboard
router.get('/tutordashboard', isLogged, isTutor, (req, res) => {
  res.render('tutordashboard');
});

// Tutor Profile Form
router.get('/profile', (req, res) => res.render('profile'));

// Create Tutor


// ===== Multer Memory Storage Config =====
// Store files in memory temporarily for Firebase upload

// ================== Tutor Routes ==================

// Create Tutor with Firebase Storage
router.post('/createtutor', upload.single('image'), async (req, res) => {
  try {
    const { username, password, phone, branch, name, skills } = req.body;

    const existing = await Newtutor.findOne({ username });
    if (existing) {
      req.flash('error', 'Tutor already exists');
      return res.redirect('/profile');
    }

    // Upload image to Firebase Storage
    let imageUrl = '';
    if (req.file) {
      imageUrl = await FirebaseStorage.uploadFile(req.file, 'tutor-profiles');
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await Newtutor.create({
      username,
      password: hash,
      phone,
      branch,
      name,
      skills,
      userclass: 'tutor',
      image: imageUrl // Store Firebase URL instead of local path
    });

    const token = jwt.sign(
      { username: user.username, id: user._id, role: 'tutor' },
      'yourSecretKey',
      { expiresIn: '1d' }
    );

    res.cookie('token', {
      value: token,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000
    });

    req.flash('success', 'Tutor created successfully');
    res.redirect('/profile');
  } catch (error) {
    console.error('Error creating tutor:', error);
    req.flash('error', 'Error creating tutor');
    res.redirect('/profile');
  }
});

// Update Tutor Profile with Firebase
router.post('/update', upload.single('file'), isLogged, isTutor, async (req, res) => {
  try {
    const { name, phone, skill } = req.body;
    const update = { name, phone, skills: skill };
    
    if (req.file) {
      // Upload new image to Firebase
      const imageUrl = await FirebaseStorage.uploadFile(req.file, 'tutor-profiles');
      update.image = imageUrl;
      
      // Optional: Delete old image from Firebase
      // You might want to implement this based on your requirements
    }

    await Newtutor.findByIdAndUpdate(req.user.id, update);
    req.flash('success', 'Profile updated');
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Error updating profile:', error);
    req.flash('error', 'Error updating profile');
    res.redirect('/dashboard');
  }
});

// Tutor Dashboard (with tutor data)
router.get('/dashboard', isLogged, isTutor, async (req, res) => {
  try {
    const tutor = await Newtutor.findById(req.user.id);
    
    // Get notices for this tutor
    const notices = await Notice.find({ tutorId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(10);

    res.render('dashboard', {
      tutor,
      notices, // ✅ Add this line to pass notices to template
      successMessage: req.flash('success'),
      errorMessage: req.flash('error')
    });
  } catch (err) {
    console.error('❌ Error loading tutor dashboard:', err);
    res.status(500).send('Server Error');
  }
});

// Dummy function — replace with your actual viewer count logic
async function getLiveViewerCount(tutorId) {
  // For now, just return 0
  return 0;
}


// Student Dashboard (shows all courses)
router.get('/dash', isLogged, isStudent, async (req, res) => {
  try {
    const courses = await Course.find().populate('tutorId');
    // Only show tutors who are live
    const tutors = await Newtutor.find({ isLive: true });
    const ratings = await Rating.find();
    
    // Fetch notices for students (add this line)
    const notices = await Notice.find({ 
      deleteDate: { $gt: new Date() } 
    }).populate('tutorId', 'name').sort({ createdAt: -1 });
    
    res.render('dash', { 
      courses, 
      tutors, 
      notices, // Pass notices to the template
      successMessage: req.flash('success'),
      errorMessage: req.flash('error')
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});
 
// Tutor Profile Update Form
router.get('/update', isLogged, isTutor, async (req, res) => {
  const tutor = await Newtutor.findById(req.user.id);
  if (!tutor) {
    req.flash('error', 'Tutor not found');
    return res.redirect('/dashboard');
  }
  res.render('tutorprofile', { tutor });
});

// Update Tutor Profile
router.post('/update', upload.single('file'), isLogged, isTutor, async (req, res) => {
  const { name, phone, skill } = req.body;
  const update = { name, phone, skills: skill };
  if (req.file) update.image = 'uploads/' + req.file.filename;

  await Newtutor.findByIdAndUpdate(req.user.id, update);
  req.flash('success', 'Profile updated');
  res.redirect('/dashboard');
});

// Public Tutor Profile (students view)
router.get('/tutor/:id', isLogged, isStudent, async (req, res) => {
  const tutor = await Newtutor.findById(req.params.id);
  if (!tutor) return res.status(404).send('Tutor not found');

  const query = req.query.q;
  let videos = [];

  if (query) {
    videos = await Course.find({
      tutorId: tutor._id,
      title: { $regex: query, $options: 'i' }
    });
  } else {
    videos = await Course.find({ tutorId: tutor._id });
  }

  res.render('tutorpublicprofile', { tutor, videos, query });
});

// ================== Course Ratings ==================

// Student View Course (with ratings)
router.get('/studentviewcourse/:id', isLogged, isStudent, async (req, res) => {
  try {
    const courseId = req.params.id;
    const course = await Course.findById(courseId).populate('tutorId');
    const tutor = await Newtutor.findById(course.tutorId);

    const ratings = await Rating.find({ courseId }).sort({ createdAt: -1 }).populate('userId', 'name');

    const averageRating = ratings.length
      ? (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1)
      : 0;

    const user = req.user ? { id: req.user.id, name: req.user.name } : null;

    res.render('studentviewcourses', {
      course,
      tutor,
      ratings,
      averageRating,
      user,
      success: req.flash('success'),
      error: req.flash('error')
    });

  } catch (err) {
    console.error('Error in studentviewcourse:', err);
    res.status(500).send('Server Error');
  }
});

// Submit Rating
router.post('/courses/:id/rate', isLogged, isStudent, async (req, res) => {
  try {
    const courseId = req.params.id;
    const { rating, review } = req.body;
    const studentId = req.user.id;

    const student = await User.findById(studentId); // ✅ now User is defined
    if (!student) {
      req.flash('error', 'Student not found');
      return res.redirect(`/studentviewcourse/${courseId}`);
    }
    const studentName = student.name || student.username;

    const ratingValue = parseInt(rating);
    if (ratingValue < 1 || ratingValue > 5) {
      req.flash('error', 'Invalid rating');
      return res.redirect(`/studentviewcourse/${courseId}`);
    }

    let existing = await Rating.findOne({ courseId, userId: studentId });

    if (existing) {
      existing.rating = ratingValue;
      existing.review = review;
      existing.userName = studentName;
      await existing.save();
    } else {
      await Rating.create({
        courseId,
        userId: studentId,
        userName: studentName,
        rating: ratingValue,
        review
      });
    }

    const ratings = await Rating.find({ courseId });
    const avg = (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1);

    await Course.findByIdAndUpdate(courseId, {
      averageRating: avg,
      ratingCount: ratings.length
    });

    req.flash('success', 'Thank you for your review!');
    res.redirect(`/studentviewcourse/${courseId}`);

  } catch (err) {
    console.error("Error submitting rating:", err);
    req.flash('error', 'Error submitting review. Try again.');
    res.redirect(`/studentviewcourse/${req.params.id}`);
  }
});

// ================== Live Session Routes ==================

// Start Live Session - ENHANCED
router.post('/start-live', isLogged, isTutor, async (req, res) => {
  try {
    const tutorId = req.user.id;
    
    // Update database
    await Newtutor.findByIdAndUpdate(tutorId, { isLive: true });
    
    // The socket event will handle the rest
    res.json({ 
      success: true, 
      message: "Live started",
      liveUrl: `/tutor-live/${tutorId}`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Stop Live Session - ENHANCED
router.post('/stop-live', isLogged, isTutor, async (req, res) => {
  try {
    const tutorId = req.user.id;
    
    // Update database
    await Newtutor.findByIdAndUpdate(tutorId, { isLive: false });
    
    // The socket event will handle the rest
    res.json({ success: true, message: "Live stopped" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});
// Get current live tutors
router.get('/live-tutors',isLogged, async (req, res) => {
  try {
    const liveTutors = await Newtutor.find({ 
      isLive: true,
      approved: true // Only show approved tutors
    }).select('name image _id skills branch isLive');
    
    console.log(`Found ${liveTutors.length} live tutors`);
    res.json(liveTutors);
  } catch (err) {
    console.error('Error fetching live tutors:', err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Tutor Live Streaming Page
router.get('/tutor-live/:tutorId', isLogged, isTutor, async (req, res) => {
  const mongoose = require('mongoose');
  const { tutorId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(tutorId)) {
    req.flash('error', 'Invalid tutor ID');
    return res.redirect('/dashboard');
  }
  const tutor = await Newtutor.findById(tutorId);
  if (!tutor) {
    req.flash('error', 'Tutor not found');
    return res.redirect('/dashboard');
  }
  
  if (req.user.id !== req.params.tutorId) {
    req.flash('error', 'Unauthorized access');
    return res.redirect('/dashboard');
  }
  
  res.render('tutor-live', { tutor });
});

// Student Live View Page
// Student Live View Page
// Student Live View Page
router.get('/student-live/:tutorId', isLogged, isStudent, async (req, res) => {
  try {
    const tutor = await Newtutor.findById(req.params.tutorId);
    if (!tutor) {
      req.flash('error', 'Tutor not found');
      return res.redirect('/dash');
    }
    if (!tutor.isLive) {
      req.flash('error', 'This tutor is not currently live');
      return res.redirect('/dash');
    }
    
    // Get student name from user object
    const studentName = req.user.name || req.user.username || 'Student';
    
    res.render('student-live', { 
      tutor, 
      user: {
        id: req.user.id,
        name: studentName  // Make sure this is passed
      }
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Server error');
    return res.redirect('/dash');
  }
});

module.exports = router;
