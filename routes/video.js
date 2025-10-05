const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Course = require('../models/video');
const Rating = require('../models/Rating');
const { isLogged, isTutor, isStudent } = require('../middleware/authMiddleware');

// ✅ Multer config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (file.fieldname === 'thumbnail') {
      cb(null, 'public/thumbnails/');
    } else if (file.fieldname === 'videos') {
      cb(null, 'public/videos/');
    }
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

// ✅ GET: Upload Form
router.get('/upload-course', isLogged, isTutor, (req, res) => {
  res.render('uploadvideo', { messages: req.flash() });
});

// ✅ POST: Upload handler
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

      // ✅ Handle both array and single string cases
      let videoTitles = req.body.videoTitles;
      if (!Array.isArray(videoTitles)) {
        videoTitles = [videoTitles]; // convert single input into array
      }
      videoTitles = videoTitles.map(t => t.trim());

      const videos = videoFiles.map((file, index) => ({
        title: videoTitles[index] || `Untitled Video ${index + 1}`,
        videoPath: 'videos/' + file.filename
      }));

      const newCourse = new Course({
        tutorId,
        courseTitle,
        shortDescription,
        detailedDescription,
        thumbnail: 'thumbnails/' + thumbnailFile.filename,
        videos
      });

      await newCourse.save();
      req.flash('success', 'Course uploaded successfully!');
      res.redirect('/upload-course');
    } catch (error) {
      console.error('Upload failed:', error);
      req.flash('error', 'Upload failed. Please try again.');
      res.redirect('/upload-course');
    }
  }
);

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
