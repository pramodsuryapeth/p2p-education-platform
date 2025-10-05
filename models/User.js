const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  name: { type: String },
  email: { type: String },
  password: { type: String, required: true },
  userclass: { type: String, default: 'student' }, // student by default
}, { timestamps: true });

// Safe model export to avoid OverwriteModelError
module.exports = mongoose.models.User || mongoose.model('User', userSchema);
