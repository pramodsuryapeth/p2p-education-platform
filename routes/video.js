const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Course = require('../models/video');
const Rating = require('../models/Rating');
const { isLogged, isTutor, isStudent } = require('../middleware/authMiddleware');

// ✅ POST: Upload handler
const FirebaseStorage = require('../utils/firebaseStorage'); // Import Firebase Storage

// ===== Multer Memory Storage Config =====
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for videos
  }
});

// ✅ GET: Upload Form
router.get('/upload-course', isLogged, isTutor, (req, res) => {
  res.render('uploadvideo', { messages: req.flash() });
});


// ✅ POST: Upload course with Firebase Storage
router.post(
  '/upload-course',
  isLogged,
  isTutor,
  upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'videos', maxCount: 10 }
  ]),
  async (req, res) => {
    try {
      const { courseTitle, shortDescription, detailedDescription } = req.body;
      const tutorId = req.user.id;

      const thumbnailFile = req.files['thumbnail']?.[0];
      const videoFiles = req.files['videos'] || [];

      // Handle video titles
      let videoTitles = req.body.videoTitles;
      if (!Array.isArray(videoTitles)) {
        videoTitles = [videoTitles];
      }
      videoTitles = videoTitles.map(t => t.trim());

      // Upload thumbnail to Firebase
      let thumbnailUrl = '';
      if (thumbnailFile) {
        thumbnailUrl = await FirebaseStorage.uploadFile(thumbnailFile, 'course-thumbnails');
      }

      // Upload videos to Firebase
      const videos = [];
      for (let i = 0; i < videoFiles.length; i++) {
        const videoUrl = await FirebaseStorage.uploadFile(videoFiles[i], 'course-videos');
        videos.push({
          title: videoTitles[i] || `Untitled Video ${i + 1}`,
          videoPath: videoUrl, // Store Firebase URL
          duration: '0:00' // You might want to calculate this
        });
      }

      const newCourse = new Course({
        tutorId,
        courseTitle,
        shortDescription,
        detailedDescription,
        thumbnail: thumbnailUrl, // Store Firebase URL
        videos
      });

      await newCourse.save();
      req.flash('success', 'Course uploaded successfully to Firebase!');
      res.redirect('/upload-course');
    } catch (error) {
      console.error('Upload failed:', error);
      req.flash('error', 'Upload failed. Please try again.');
      res.redirect('/upload-course');
    }
  }
);

// Add route to delete course (with Firebase cleanup)
router.delete('/course/:id', isLogged, isTutor, async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    // Delete thumbnail from Firebase
    if (course.thumbnail) {
      await FirebaseStorage.deleteFile(course.thumbnail);
    }

    // Delete videos from Firebase
    for (const video of course.videos) {
      if (video.videoPath) {
        await FirebaseStorage.deleteFile(video.videoPath);
      }
    }

    await Course.findByIdAndDelete(req.params.id);
    
    res.json({ success: true, message: 'Course deleted successfully' });
  } catch (error) {
    console.error('Delete failed:', error);
    res.status(500).json({ success: false, message: 'Delete failed' });
  }
});

// View uploaded courses by tutor
router.get('/my-course', isLogged, isTutor, async (req, res) => {
  try {
    const tutorId = req.user.id;
    const courses = await Course.find({ tutorId });
    res.render('mycourse', { courses });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});
router.get('/viewcourse/:id', isLogged, isTutor, async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).send('Course not found');
    
    // Get all ratings for this course
    const ratings = await Rating.find({ courseId: req.params.id })
      .populate('userId', 'username name avatar')
      .sort({ createdAt: -1 });
    
    const totalRatings = ratings.length;
    
    res.render('viewcource', { 
      course, 
      ratings,
      totalRatings
    });
  } catch (err) {
    console.error('Error fetching course:', err);
    res.status(500).send('Server Error');
  }
});


module.exports = router;
