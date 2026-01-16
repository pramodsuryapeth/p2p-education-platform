const express = require('express');
const router = express.Router();
const Newtutor = require('../models/Newtutor');
const { isLogged, isTutor, isStudent } = require('../middleware/authMiddleware');
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