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
const { uploadImageToCloudinary } = require('../config/cloudinary');
const { isLogged, isTutor, isStudent } = require('../middleware/authMiddleware');

// ===== Multer File Upload Config =====
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
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
router.post('/createtutor', upload.single('image'), async (req, res) => {
  try {
    const { username, password, phone, branch, name, skills } = req.body;

    // Check if user exists
    const existing = await Newtutor.findOne({ username });
    if (existing) {
      req.flash('error', 'Username already exists');
      return res.redirect('/profile');
    }

    // ✅ UPLOAD IMAGE TO CLOUDINARY
    let imageUrl = '';
    if (req.file) {
      try {
        const result = await uploadImageToCloudinary(
          req.file.buffer,
          `${username}-${Date.now()}`
        );
        imageUrl = result.secure_url;
        console.log('✅ Tutor image uploaded to Cloudinary');
      } catch (uploadError) {
        console.error('❌ Cloudinary upload failed:', uploadError);
        req.flash('error', 'Failed to upload profile image');
        return res.redirect('/profile');
      }
    } else {
      // Default avatar
      imageUrl = 'https://res.cloudinary.com/dr6yjl8ki/image/upload/v1661234567/default-avatar.png';
    }

    // Hash password
    const hash = await bcrypt.hash(password, 10);

    // Create tutor in database
    const user = await Newtutor.create({
      username,
      password: hash,
      phone,
      branch,
      name,
      skills,
      userclass: 'tutor',
      image: imageUrl, // Cloudinary URL
      approved: false
    });

    // Create JWT token
    const token = jwt.sign(
      { 
        id: user._id,
        username: user.username,
        name: user.name,
        role: 'tutor'
      },
      process.env.JWT_SECRET || 'yourSecretKey',
      { expiresIn: '1d' }
    );

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000
    });

    req.flash('success', 'Tutor profile created successfully!');
    res.redirect('/dashboard');

  } catch (error) {
    console.error('❌ Create tutor error:', error);
    
    if (error.code === 11000) {
      req.flash('error', 'Username already exists');
    } else {
      req.flash('error', 'Error creating profile');
    }
    
    res.redirect('/profile');
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

    // Helper function to get image URL
    const getTutorImageUrl = (tutor) => {
      if (tutor.image && tutor.image.url) {
        // New format: Cloudinary object
        return tutor.image.url;
      } else if (tutor.image && typeof tutor.image === 'string') {
        // Old format: local path string
        return tutor.image.startsWith('http') ? tutor.image : `/${tutor.image}`;
      }
      return '/default-avatar.png';
    };

    res.render('dashboard', {
      tutor,
      tutorImageUrl: getTutorImageUrl(tutor), // Pass the URL separately
      notices,
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
router.get('/dash', async (req, res) => {
  try {
    // Get token from cookie
    const token = req.cookies.token;
    
    if (!token) {
      req.flash('error', 'Please login first');
      return res.redirect('/login');
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'yourSecretKey');
    
    // Check if user is a student
    if (decoded.role !== 'student') {
      req.flash('error', 'Access denied. Student area only.');
      return res.redirect('/login');
    }

    // Find student in database
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      res.clearCookie('token');
      req.flash('error', 'Student not found');
      return res.redirect('/login');
    }

    // Fetch courses - handle case if Course model doesn't exist
    let courses = [];
    try {
      courses = await Course.find({}).populate('tutorId', 'name image');
    } catch (courseError) {
      console.log('No courses found or Course model not available');
    }
    
    // Fetch notices - handle case if Notice model doesn't exist
    let notices = [];
    try {
      notices = await Notice.find({})
        .populate('tutorId', 'name')
        .sort({ createdAt: -1 })
        .limit(10);
    } catch (noticeError) {
      console.log('No notices found or Notice model not available');
    }

    // Render dashboard with user data
    res.render('dash', {
      title: 'Student Dashboard',
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        email: user.email,
        image: user.image,
        userclass: user.userclass
      },
      courses: courses || [],
      notices: notices || [],
      successMessage: req.flash('success'),
      errorMessage: req.flash('error')
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      res.clearCookie('token');
      req.flash('error', 'Session expired. Please login again.');
      return res.redirect('/login');
    }
    
    req.flash('error', 'Unable to load dashboard');
    res.redirect('/login');
  }
});
 
// Tutor Profile Update Form
// Student Profile View
// Student Profile Update Page with Debug Logs
router.get('/student-update-profile', isLogged, isStudent, async (req, res) => {
  try {
    console.log('=== GET /student-update-profile START ===');
    console.log('1. Middleware passed - User authenticated');
    console.log('2. req.user object:', req.user);
    console.log('3. req.user.id:', req.user?.id);
    console.log('4. req.userRole:', req.userRole);
    
    const student = await User.findById(req.user.id);
    console.log('5. Database query result:', student ? 'Student found' : 'Student NOT found');
    
    if (!student) {
      console.log('❌ ERROR: Student not found in database');
      req.flash('error', 'Student not found');
      return res.redirect('/dash');
    }
    
    console.log('6. Student details:', {
      id: student._id,
      username: student.username,
      name: student.name,
      image: student.image
    });
    console.log('=== GET /student-update-profile END - Rendering page ===');
    
    res.render('studentprofile', { 
      student,
      successMessage: req.flash('success'),
      errorMessage: req.flash('error')
    });
  } catch (error) {
    console.error('❌ GET /student-update-profile ERROR:', error);
    console.error('Error stack:', error.stack);
    req.flash('error', 'Unable to load profile');
    res.redirect('/dash');
  }
});
// Route for automatic Cloudinary upload
router.post('/upload-to-cloudinary', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'No file uploaded' 
      });
    }
    
    // Upload to Cloudinary
    const result = await uploadImageToCloudinary(
      req.file.buffer,
      `student-${req.body.userId || Date.now()}-${Date.now()}`
    );
    
    res.json({
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      message: 'Image uploaded successfully'
    });
    
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Profile update route (without file upload)
router.post('/student-update-profile', isLogged, isStudent, async (req, res) => {
  try {
    const { name, email, cloudinaryImageUrl, password } = req.body;
    const update = { name, email };

    // Use the pre-uploaded Cloudinary URL if provided
    if (cloudinaryImageUrl && cloudinaryImageUrl.trim() !== '') {
      update.image = cloudinaryImageUrl;
    }

    // Handle password update if provided
    if (password && password.trim() !== '') {
      const hashedPassword = await bcrypt.hash(password, 10);
      update.password = hashedPassword;
    }

    // Update student in database
    await User.findByIdAndUpdate(req.user.id, update);

    req.flash('success', 'Profile updated successfully!');
    res.redirect('/dash');

  } catch (err) {
    console.error('Update error:', err);
    
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(error => error.message);
      req.flash('error', messages.join(', '));
    } else if (err.code === 11000) {
      req.flash('error', 'Email already in use by another account');
    } else {
      req.flash('error', 'Error updating profile');
    }
    
    res.redirect('/student-update-profile');
  }
});
// Also add a test route to check if the page loads at all
router.get('/test-student-profile', (req, res) => {
  console.log('=== TEST ROUTE /test-student-profile ===');
  console.log('Cookies:', req.cookies);
  console.log('Token present:', !!req.cookies.token);
  
  if (!req.cookies.token) {
    return res.send('No token found in cookies');
  }
  
  try {
    const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET || 'yourSecretKey');
    console.log('Token decoded:', decoded);
    res.json({
      tokenValid: true,
      userData: decoded,
      message: 'Token is valid'
    });
  } catch (error) {
    console.error('Token verification failed:', error);
    res.json({
      tokenValid: false,
      error: error.message
    });
  }
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

// My Courses Page
router.get('/mycource', isLogged, isTutor, async (req, res) => {
  try {
    const courses = await Course.find({ tutorId: req.user.id }).sort({ uploadedAt: -1 });
    res.render('mycource', { 
      courses,
      successMessage: req.flash('success'),
      errorMessage: req.flash('error')
    });
  } catch (err) {
    console.error('Error fetching courses:', err);
    req.flash('error', 'Server Error');
    res.redirect('/dashboard');
  }
});

// Edit Course Page
router.get('/edit-course/:id', isLogged, isTutor, async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) {
      req.flash('error', 'Course not found');
      return res.redirect('/mycource');
    }
    
    if (course.tutorId.toString() !== req.user.id) {
      req.flash('error', 'You are not authorized to edit this course');
      return res.redirect('/mycource');
    }
    
    res.render('edit-course', { 
      course,
      successMessage: req.flash('success'),
      errorMessage: req.flash('error')
    });
  } catch (err) {
    console.error('Error fetching course for edit:', err);
    req.flash('error', 'Server Error');
    res.redirect('/mycource');
  }
});

// Update Course
router.post('/update-course/:id', isLogged, isTutor, upload.fields([
  { name: 'thumbnail', maxCount: 1 },
  { name: 'video', maxCount: 1 }
]), async (req, res) => {
  try {
    const { courseTitle, shortDescription } = req.body;
    const courseId = req.params.id;
    
    const course = await Course.findById(courseId);
    if (!course) {
      req.flash('error', 'Course not found');
      return res.redirect('/mycource');
    }
    
    if (course.tutorId.toString() !== req.user.id) {
      req.flash('error', 'Unauthorized');
      return res.redirect('/mycource');
    }
    
    const updateData = {
      courseTitle,
      shortDescription,
      updatedAt: new Date(),
      approved: false // Reset approval when edited
    };
    
    if (req.files.thumbnail && req.files.thumbnail[0]) {
      const thumbnailFile = req.files.thumbnail[0];
      const cloudinaryResult = await cloudinary.uploadImageToCloudinary(
        thumbnailFile.buffer,
        thumbnailFile.originalname
      );
      
      if (course.thumbnail && course.thumbnail.publicId) {
        try {
          await cloudinary.uploader.destroy(course.thumbnail.publicId);
        } catch (deleteError) {
          console.error('Error deleting old thumbnail:', deleteError);
        }
      }
      
      updateData.thumbnail = {
        url: cloudinaryResult.secure_url,
        publicId: cloudinaryResult.public_id
      };
    }
    
    if (req.files.video && req.files.video[0]) {
      const videoFile = req.files.video[0];
      const cloudinaryResult = await cloudinary.uploadVideoToCloudinary(
        videoFile.buffer,
        videoFile.originalname
      );
      
      if (course.videoUrl && course.videoUrl.publicId) {
        try {
          await cloudinary.uploader.destroy(course.videoUrl.publicId, { resource_type: 'video' });
        } catch (deleteError) {
          console.error('Error deleting old video:', deleteError);
        }
      }
      
      updateData.videoUrl = {
        url: cloudinaryResult.secure_url,
        publicId: cloudinaryResult.public_id
      };
    }
    
    await Course.findByIdAndUpdate(courseId, updateData, { new: true });
    
    req.flash('success', 'Course updated successfully! It will need to be re-approved.');
    res.redirect(`/edit-course/${courseId}`);
  } catch (error) {
    console.error('Course update error:', error);
    req.flash('error', 'Failed to update course');
    res.redirect(`/edit-course/${req.params.id}`);
  }
});

// Delete Course
router.post('/delete-course/:id', isLogged, isTutor, async (req, res) => {
  try {
    const courseId = req.params.id;
    
    const course = await Course.findById(courseId);
    if (!course) {
      req.flash('error', 'Course not found');
      return res.redirect('/my-course');
    }
    
    if (course.tutorId.toString() !== req.user.id) {
      req.flash('error', 'Unauthorized');
      return res.redirect('/mycourse');
    }
    
    if (course.thumbnail && course.thumbnail.publicId) {
      try {
        await cloudinary.uploader.destroy(course.thumbnail.publicId);
      } catch (deleteError) {
        console.error('Error deleting thumbnail:', deleteError);
      }
    }
    
    if (course.videoUrl && course.videoUrl.publicId) {
      try {
        await cloudinary.uploader.destroy(course.videoUrl.publicId, { resource_type: 'video' });
      } catch (deleteError) {
        console.error('Error deleting video:', deleteError);
      }
    }
    
    await Course.findByIdAndDelete(courseId);
    
    req.flash('success', 'Course deleted successfully!');
    res.redirect('/my-course');
  } catch (error) {
    console.error('Course delete error:', error);
    req.flash('error', 'Failed to delete course');
    res.redirect('/mycource');
  }
});

//student profile update form

router.get('/update-student', isLogged, isStudent, async (req, res) => {

  const student = await User.findById(req.user.id);
  if (!student){
    req.flash('error', 'Student not found');

  }
   res.render('student-update', { student});
});

router.post('/update-student', isLogged, isStudent, upload.single('file'), async (req, res) => {
  try {
    const {name, password, age, username} = req.body;
    const update = { name, age, username };
    if (password && password.trim() !== '') {
      const hashedPassword = await bcrypt.hash(password, 10);
      update.password = hashedPassword;
    }
    await User.findByIdAndUpdate(req.user.id, update);
    req.flash('success', 'Profile updated successfully');
    res.redirect('/dash');
  }
    catch (err) {
    console.error('Update error:', err);
    req.flash('error', 'Error updating profile');
    res.redirect('/update-student');
  }

});
router.get('/update', isLogged, isTutor, async (req, res) => {
  try {
    const tutor = await Newtutor.findById(req.user.id);
    
    if (!tutor) {
      return res.status(404).send('Tutor not found');
    }
    
    res.render('tutorprofile', { 
      tutor,
      successMessage: req.flash('success'),
      errorMessage: req.flash('error')
    });
    
  } catch (err) {
    console.error('❌ Error fetching tutor for update:', err);
    res.status(500).send('Server error');
  }
});

// POST route to handle profile update
router.post('/update', isLogged, isTutor, async (req, res) => {
  try {
    const { name, phone, skill, currentImagePublicId } = req.body;
    const file = req.file;
    
    // Validate required fields
    if (!name || !phone || !skill) {
      req.flash('error', 'Name, phone, and skill are required');
      return res.redirect('/update');
    }
    
    const updateData = {
      name,
      phone,
      skills: skill
    };
    
    // Handle image upload if a new file is provided
    if (file) {
      // Delete old image from Cloudinary if exists
      if (currentImagePublicId) {
        try {
          await cloudinary.uploader.destroy(currentImagePublicId);
          console.log('✅ Old image deleted from Cloudinary');
        } catch (cloudErr) {
          console.log('⚠️ Could not delete old image from Cloudinary:', cloudErr.message);
        }
      }
      
      // Upload new image to Cloudinary
      const uploadOptions = {
        folder: 'tutor-profiles',
        transformation: [
          { width: 400, height: 400, crop: 'fill', gravity: 'face' }
        ]
      };
      
      try {
        const uploadResult = await cloudinary.uploader.upload(file.path, uploadOptions);
        
        // Store Cloudinary data
        updateData.image = {
          url: uploadResult.secure_url,
          publicId: uploadResult.public_id,
          format: uploadResult.format,
          width: uploadResult.width,
          height: uploadResult.height,
          resourceType: uploadResult.resource_type,
          createdAt: uploadResult.created_at
        };
        
        console.log('✅ New image uploaded to Cloudinary:', uploadResult.secure_url);
        
      } catch (uploadErr) {
        console.error('❌ Cloudinary upload error:', uploadErr);
        req.flash('error', 'Failed to upload image. Please try again.');
        return res.redirect('/update');
      }
    }
    
    // Update tutor in database
    const updatedTutor = await Newtutor.findByIdAndUpdate(
      req.user.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );
    
    if (!updatedTutor) {
      req.flash('error', 'Failed to update profile');
      return res.redirect('/update');
    }
    
    req.flash('success', 'Profile updated successfully!');
    res.redirect('/update');
    
  } catch (err) {
    console.error('❌ Error updating tutor profile:', err);
    req.flash('error', 'Server error occurred');
    res.redirect('/update');
  }
});

module.exports = router;

   
