const mongoose = require("mongoose");

const ratingSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // ✅ Reference to student
      required: true,
    },
    userName: {
      type: String, // Will be filled automatically from logged-in student
      required: true
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: Number.isInteger,
        message: "Rating must be an integer between 1 and 5",
      },
    },
    review: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Compound index: one rating per student per course
ratingSchema.index({ courseId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("Rating", ratingSchema);
