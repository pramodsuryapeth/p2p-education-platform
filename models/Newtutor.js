const mongoose = require('mongoose');

const tutorSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  image: { type: String, required: true },
  name: { type: String, required: true },
  phone: { type: Number, required: true },
  branch: { type: String, required: true },
  skills: { type: String, required: true },
  userclass: { type: String, default: 'tutor' },
  approved: { type: Boolean, default: false },
  rejected: { type: Boolean, default: false }, // Optional field
  isLive: { type: Boolean, default: false }     // New field for live status
});

const Newtutor = mongoose.models.Newtutor || mongoose.model('Newtutor', tutorSchema);
module.exports = Newtutor;
