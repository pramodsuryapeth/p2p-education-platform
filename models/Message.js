// models/Message.js
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'senderModel' },
  receiverId: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'receiverModel' },

  senderModel: { type: String, required: true, enum: ['User', 'Newtutor'] },
  receiverModel: { type: String, required: true, enum: ['User', 'Newtutor'] },

  message: { type: String, required: true },
  seen: { type: Boolean, default: false }
}, { timestamps: true });

// Add TTL index - messages will be automatically deleted after 6 months (180 days)
messageSchema.index({ createdAt: 1 }, { 
  expireAfterSeconds: 180 * 24 * 60 * 60 // 6 months in seconds
});

module.exports = mongoose.model('Message', messageSchema);