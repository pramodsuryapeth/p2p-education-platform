// routes/video.js - COMPLETE FIXED VERSION
const express = require('express');
const router = express.Router();
const multer = require('multer');
const Course = require('../models/Video');
const Rating = require('../models/Rating');
const Newtutor = require('../models/Newtutor');
const { isLogged, isTutor } = require('../middleware/authMiddleware');
const { uploadVideoToCloudinary, uploadImageToCloudinary } = require('../config/cloudinary');

// ✅ FIXED: Multer setup
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
    files: 11
  }
});

// ✅ GET: Upload Form
// GET Route - Add more debug info
router.get('/upload-course', isLogged, isTutor, (req, res) => {
  res.render('uploadvideo', { 
    messages: req.flash(),
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_UPLOAD_PRESET: process.env.CLOUDINARY_UPLOAD_PRESET || 'course_uploads'
  });
});

// ✅ POST: Upload Course
router.post(
  '/upload-course',
  isLogged,
  isTutor,
  async (req, res) => {
    try {
      const { 
        courseTitle, 
        shortDescription, 
        detailedDescription, 
        videoTitles,
        thumbnailCloudinaryUrl,
        videoCloudinaryUrls
      } = req.body;
      
      const tutorId = req.user.id;

      // Validation
      if (!thumbnailCloudinaryUrl) {
        req.flash('error', 'Thumbnail is required');
        return res.redirect('/upload-course');
      }

      if (!videoCloudinaryUrls || (Array.isArray(videoCloudinaryUrls) && videoCloudinaryUrls.length === 0)) {
        req.flash('error', 'At least one video is required');
        return res.redirect('/upload-course');
      }

      // Handle video titles
      let videoTitleArray = [];
      if (videoTitles) {
        videoTitleArray = Array.isArray(videoTitles) ? videoTitles : [videoTitles];
        videoTitleArray = videoTitleArray.map(t => t.trim());
      }

      // Handle video URLs
      const videoUrlArray = Array.isArray(videoCloudinaryUrls) ? videoCloudinaryUrls : [videoCloudinaryUrls];
      
      // Create videos array
      const videos = [];
      for (let i = 0; i < videoUrlArray.length; i++) {
        const videoUrl = videoUrlArray[i];
        const title = videoTitleArray[i] || `Video ${i + 1}`;
        
        if (videoUrl) {
          videos.push({
            title: title,
            videoPath: videoUrl,
            duration: 0,
            uploadedAt: new Date()
          });
        }
      }

      if (videos.length === 0) {
        req.flash('error', 'No valid video URLs found');
        return res.redirect('/upload-course');
      }

      // ✅ CREATE COURSE
      const newCourse = new Course({
        tutorId,
        courseTitle,
        shortDescription,
        detailedDescription,
        thumbnail: thumbnailCloudinaryUrl,
        videos,
        uploadDate: new Date(),
        status: 'published'
      });

      await newCourse.save();
      
      req.flash('success', `Course "${courseTitle}" uploaded successfully with ${videos.length} video(s)!`);
      return res.redirect('/upload-course'); // Added return
      
    } catch (error) {
      console.error('Upload failed:', error);
      req.flash('error', 'Upload failed. Please try again.');
      return res.redirect('/upload-course'); // Added return
    }
  }
);
// ✅ VIEW COURSE (WITH FIX FOR EMPTY videoPath)
router.get('/viewcourse/:id', isLogged, isTutor, async (req, res) => {
  try {
    const tutor = await Newtutor.findById(req.user.id);
   const course = await Course.findById(req.params.id); // This defines course
    if (!course || !tutor) {
      req.flash('error', 'Course not found');
      return res.redirect('/my-course');
    }
    
    // Get ratings
    const ratings = await Rating.find({ courseId: req.params.id })
      .populate('userId', 'username name avatar')
      .sort({ createdAt: -1 });
    
    const totalRatings = ratings.length;
    
    // Get tutor info for the course (if it's not the logged-in tutor)
    const courseTutor = await Newtutor.findById(course.tutorId);
    
    res.render('viewcource', { 
      course, 
      tutor, // Add this line - passes the logged-in tutor
      courseTutor: courseTutor || tutor, // Add this - tutor who owns the course
      ratings,
      totalRatings
    });
  } catch (err) {
    console.error('Error fetching course:', err);
    req.flash('error', 'Server Error');
    res.redirect('/my-course');
  }
});

// ✅ MY COURSES
router.get('/my-course', isLogged, isTutor, async (req, res) => {
  try {
    const tutorId = req.user.id;
    const courses = await Course.find({ tutorId }).sort({ uploadedAt: -1 });
    res.render('mycourse', { 
      courses,
      messages: req.flash() 
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Server Error');
    res.redirect('/');
  }
});

// ✅ DELETE COURSE
router.delete('/course/:id', isLogged, isTutor, async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    
    // Check ownership
    if (course.tutorId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    await Course.findByIdAndDelete(req.params.id);
    
    res.json({ success: true, message: 'Course deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
});
// Temporary debug route add करा
router.get('/debug-course/:id', async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    console.log('=== COURSE DEBUG INFO ===');
    console.log('Course ID:', course._id);
    console.log('Course Title:', course.courseTitle);
    console.log('Total Videos in DB:', course.videos.length);
    
    course.videos.forEach((video, index) => {
      console.log(`\nVideo ${index + 1}:`);
      console.log('Title:', video.title);
      console.log('Video Path:', video.videoPath);
      console.log('Video URL:', video.videoUrl);
      console.log('Duration:', video.duration);
      console.log('Has videoPath?', !!video.videoPath);
      console.log('Has videoUrl?', !!video.videoUrl);
    });
    
    res.json(course);
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ error: error.message });
  }
});
router.get('/viewcourse/:id', isLogged, isTutor, async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).send('Course not found');
    
    // DEBUG: Check video data
    console.log('\n=== VIEW COURSE DEBUG ===');
    console.log('Course:', course.courseTitle);
    console.log('Videos count:', course.videos.length);
    
    // Check each video
    course.videos.forEach((video, index) => {
      console.log(`Video ${index + 1}:`, {
        title: video.title,
        path: video.videoPath,
        url: video.videoUrl,
        duration: video.duration
      });
    });
    
    // Get ratings
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