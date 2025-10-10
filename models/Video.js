const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
  tutorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Newtutor' },
  courseTitle: String,
  shortDescription: String,
  detailedDescription: String,
  thumbnail: String,
  videos: [
    {
      title: String,
      videoPath: String,
      duration: String // Added duration field
    }
  ],
  // Add rating fields
  ratings: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Rating'
  }],
  averageRating: {
    type: Number,
    default: 0
  },
  ratingCount: {
    type: Number,
    default: 0
  },
  uploadedAt: { type: Date, default: Date.now }
});

const Course = mongoose.models.Course || mongoose.model('Course', videoSchema);
module.exports = Course;