const express = require("express");
const router = express.Router();
const Course = require("../models/Course");
const Rating = require("../models/Rating");

// Course detail page
router.get("/:courseId", async (req, res) => {
  try {
    const { courseId } = req.params;
    const course = await Course.findById(courseId);
    const ratings = await Rating.find({ courseId }).sort({ createdAt: -1 });

    let avgRating = 0;
    if (ratings.length > 0) {
      avgRating =
        ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
    }

    res.render("courseDetail", {
      course,
      ratings,
      averageRating: avgRating,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading course details");
  }
});

// Submit rating
router.post("/:courseId/rate", async (req, res) => {
  try {
    const { courseId } = req.params;
    const { rating, review } = req.body;

    if (!rating) return res.status(400).send("Rating is required");

    const userId = req.user._id; // Assume logged in user
    const userName = req.user.name || "Anonymous";

    let existing = await Rating.findOne({ courseId, userId });

    if (existing) {
      existing.rating = rating;
      existing.review = review;
      await existing.save();
    } else {
      await Rating.create({ courseId, userId, userName, rating, review });
    }

    res.redirect(`/courses/${courseId}`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error saving rating");
  }
});

module.exports = router;
