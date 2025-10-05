const mongoose = require('mongoose');

const noticeSchema = new mongoose.Schema({
  tutorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Newtutor',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'low'
  },
  deleteDate: {
    type: Date,
    required: true
  }
}, { timestamps: true });

// TTL index for auto-deletion
noticeSchema.index({ deleteDate: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Notice', noticeSchema);