const express = require('express');
const router = express.Router();
const { isLogged, isTutor, isStudent } = require('../middleware/authMiddleware');
const Message = require('../models/Message');
const User = require('../models/User');
const Tutor = require('../models/Newtutor');

// Student Inbox (latest message per contact)
// General Messages Route - Fixed version
router.get('/messages', isLogged, isTutor, async (req, res) => {
  const currentUserId = req.user.id;

  try {
    const allMessages = await Message.find({
      $or: [{ senderId: currentUserId }, { receiverId: currentUserId }]
    }).sort({ createdAt: -1 });

    const uniqueMessages = [];
    const seenContacts = new Set();

    for (let msg of allMessages) {
      const otherId = msg.senderId.toString() === currentUserId ? 
        msg.receiverId.toString() : 
        msg.senderId.toString();

      if (!seenContacts.has(otherId)) {
        const otherUserModel = msg.senderId.toString() === currentUserId ? 
          msg.receiverModel : 
          msg.senderModel;

        let user;
        if (otherUserModel === 'User') {
          user = await User.findById(otherId).select('username name avatar');
        } else if (otherUserModel === 'Newtutor') {
          user = await Tutor.findById(otherId).select('username name avatar');
        }

        const unseenCount = await Message.countDocuments({
          senderId: otherId,
          receiverId: currentUserId,
          seen: false
        });

        uniqueMessages.push({
          senderId: otherId,
          username: user?.username || user?.name || 'Unknown User',
          text: msg.message,
          timestamp: msg.createdAt,
          avatar: user?.avatar || 'uploads/default-avatar.jpg',
          unseenCount
        });

        seenContacts.add(otherId);
      }
    }

    // ✅ FIX: Pass user data for tutor
    res.render('tutormessage', { 
      messages: uniqueMessages,
      user: req.user // This is crucial
    });

  } catch (err) {
    console.error('❌ Error fetching tutor messages:', err);
    res.status(500).send("Internal Server Error");
  }
});
// Student Inbox Page - list of latest messages per contact
// Student Inbox Page - Fixed version
// In your chat.js route file - update both routes
router.get('/messages/student/inbox', isLogged, isStudent, async (req, res) => {
  const currentUserId = req.user.id;

  try {
    const allMessages = await Message.find({
      $or: [{ senderId: currentUserId }, { receiverId: currentUserId }]
    }).sort({ createdAt: -1 });

    const uniqueMessages = [];
    const seenContacts = new Set();

    for (let msg of allMessages) {
      const otherId = msg.senderId.toString() === currentUserId ? 
        msg.receiverId.toString() : 
        msg.senderId.toString();

      if (!seenContacts.has(otherId)) {
        const otherUserModel = msg.senderId.toString() === currentUserId ? 
          msg.receiverModel : 
          msg.senderModel;

        let user;
        if (otherUserModel === 'User') {
          user = await User.findById(otherId).select('username name avatar');
        } else if (otherUserModel === 'Newtutor') {
          user = await Tutor.findById(otherId).select('username name avatar');
        }

        const unseenCount = await Message.countDocuments({
          senderId: otherId,
          receiverId: currentUserId,
          seen: false
        });

        uniqueMessages.push({
          senderId: otherId,
          username: user?.username || user?.name || 'Unknown User',
          text: msg.message,
          timestamp: msg.createdAt,
          avatar: user?.avatar || 'uploads/default-avatar.jpg',
          unseenCount
        });

        seenContacts.add(otherId);
      }
    }

    // ✅ FIX: Pass user data for student
    res.render('chatInbox', { 
      messages: uniqueMessages,
      user: req.user // This is crucial
    });

  } catch (err) {
    console.error('❌ Error fetching student inbox:', err);
    res.status(500).send("Internal Server Error");
  }
});

router.get('/messages', isLogged, async (req, res) => {
  const currentUserId = req.user.id;

  try {
    // ... your existing message fetching logic ...

    res.render('tutormessage', { 
      messages: uniqueMessages,
      user: req.user // Make sure to pass user data
    });

  } catch (err) {
    console.error('❌ Error fetching messages:', err);
    res.status(500).send("Internal Server Error");
  }
});


// Tutor Inbox
router.get('/messages/inbox', isLogged, isTutor, async (req, res) => {
  const tutorId = req.user.id;

  try {
    const allMessages = await Message.find({
      $or: [{ senderId: tutorId }, { receiverId: tutorId }]
    }).sort({ timestamp: -1 });

    const uniqueMessages = [];
    const seenContacts = new Set();

    for (let msg of allMessages) {
      const otherUserId = msg.senderId.toString() === tutorId ? msg.receiverId.toString() : msg.senderId.toString();

      if (!seenContacts.has(otherUserId)) {
        let user = await User.findById(otherUserId).select('username name avatar');
        if (!user) {
          user = await Tutor.findById(otherUserId).select('username name avatar');
        }

        const unseenCount = await Message.countDocuments({
          senderId: otherUserId,
          receiverId: tutorId,
          seen: false
        });

        uniqueMessages.push({
          username: user?.username || user?.name || 'Unknown',
          text: msg.message,
          senderId: otherUserId,
          avatar: user?.avatar || 'uploads/default-avatar.jpg',
          timestamp: msg.createdAt,
          unseenCount
        });

        seenContacts.add(otherUserId);
      }
    }

    // ✅ FIX: Pass user data
    res.render('tutormessage', { 
      messages: uniqueMessages,
      user: req.user
    });
  } catch (err) {
    console.error('❌ Error fetching tutor messages:', err);
    res.status(500).send("Internal Server Error");
  }
});

// Full chat between two users
// Full chat between two users
router.get('/messages/:userId', isLogged, async (req, res) => {
  const senderId = req.user.id;
  const receiverId = req.params.userId;

  try {
    async function findUserById(id) {
      let user = await User.findById(id).select('username name userclass avatar');
      if (user) return { user, model: 'User' };
      user = await Tutor.findById(id).select('username name userclass avatar');
      if (user) return { user, model: 'Newtutor' };
      return { user: null, model: null };
    }

    const { user: sender, model: senderModel } = await findUserById(senderId);
    const { user: receiver, model: receiverModel } = await findUserById(receiverId);

    if (!sender || !receiver) {
      return res.status(404).send("User not found");
    }

    await Message.updateMany(
      { senderId: receiverId, receiverId: senderId, seen: false },
      { $set: { seen: true } }
    );

    const messages = await Message.find({
      $or: [
        { senderId, receiverId },
        { senderId: receiverId, receiverId: senderId }
      ]
    }).sort({ timestamp: 1 });

    const roomId = senderId < receiverId
      ? `${senderId}_${receiverId}`
      : `${receiverId}_${senderId}`;

    res.render('chat', {
      senderId,
      receiverId,
      senderModel,
      receiverModel,
      messages,
      sender,
      receiver,
      roomId,
      user: req.user // ✅ Add user data
    });
  } catch (err) {
    console.error('❌ Error loading messages:', err);
    res.status(500).send('Error loading chat');
  }
});

// Debug route
router.get('/messages/debug', isLogged, async (req, res) => {
  const currentUserId = req.user.id;
  
  try {
    const messages = await Message.find({
      $or: [{ senderId: currentUserId }, { receiverId: currentUserId }]
    });
    
    console.log('All messages for user:', currentUserId);
    console.log('Message count:', messages.length);
    messages.forEach(msg => {
      console.log('Message:', {
        id: msg._id,
        senderId: msg.senderId,
        receiverId: msg.receiverId,
        senderModel: msg.senderModel,
        receiverModel: msg.receiverModel,
        message: msg.message,
        seen: msg.seen
      });
    });
    
    res.json({ messages, currentUserId });
  } catch (err) {
    console.error('Debug error:', err);
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;
