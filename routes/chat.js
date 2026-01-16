const express = require('express');
const router = express.Router();
const { isLogged, isTutor, isStudent } = require('../middleware/authMiddleware');
const Message = require('../models/Message');
const User = require('../models/User');
const Tutor = require('../models/Newtutor');

// Student Inbox (latest message per contact)
// General Messages Route - Fixed version
router.get('/messages', isLogged, isTutor, async (req, res) => {
  const tutorId = req.user.id;

  try {
    const allMessages = await Message.find({
      $or: [{ senderId: tutorId }, { receiverId: tutorId }]
    }).sort({ createdAt: -1 });

    const uniqueMessages = [];
    const seenContacts = new Set();

    for (let msg of allMessages) {
      const otherId = msg.senderId.toString() === tutorId ? 
        msg.receiverId.toString() : 
        msg.senderId.toString();

      if (!seenContacts.has(otherId)) {
        const otherUserModel = msg.senderId.toString() === tutorId ? 
          msg.receiverModel : 
          msg.senderModel;

        let user;
        if (otherUserModel === 'User') {
          user = await User.findById(otherId).select('username name avatar image profilePic');
        } else if (otherUserModel === 'Newtutor') {
          user = await Tutor.findById(otherId).select('username name avatar image profilePic');
        }

        const unseenCount = await Message.countDocuments({
          senderId: otherId,
          receiverId: tutorId,
          seen: false
        });

        // Get image URL from user
        let imageUrl = null;
        if (user) {
          // Check all possible image fields
          const possibleImageFields = [user.profilePic, user.image, user.avatar];
          
          for (const field of possibleImageFields) {
            if (field) {
              if (typeof field === 'string') {
                if (field.startsWith('http')) {
                  imageUrl = field;
                  break;
                } else if (field.startsWith('//')) {
                  imageUrl = 'https:' + field;
                  break;
                } else if (field.includes('cloudinary.com')) {
                  imageUrl = field.startsWith('http') ? field : 'https:' + field;
                  break;
                }
              } else if (typeof field === 'object') {
                if (field.secure_url) {
                  imageUrl = field.secure_url;
                  break;
                } else if (field.url) {
                  imageUrl = field.url.startsWith('//') ? 'https:' + field.url : field.url;
                  break;
                }
              }
            }
          }
        }

        uniqueMessages.push({
          senderId: otherId,
          username: user?.username || user?.name || 'Unknown User',
          text: msg.message,
          timestamp: msg.createdAt,
          imageUrl: imageUrl,
          unseenCount
        });

        seenContacts.add(otherId);
      }
    }

    res.render('tutormessage', { 
      messages: uniqueMessages,
      user: req.user
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
          user = await User.findById(otherId).select('username name image avatar');
        } else if (otherUserModel === 'Newtutor') {
          user = await Tutor.findById(otherId).select('username name image avatar');
        }

        // Helper function to get proper image URL
        const getAvatarUrl = (avatar) => {
          if (!avatar) return '/uploads/default-avatar.jpg';
          
          // If avatar is an object (Cloudinary format)
          if (typeof avatar === 'object') {
            // Cloudinary returns { url, secure_url, public_id, etc }
            if (avatar.url) return avatar.url;
            if (avatar.secure_url) return avatar.secure_url;
            if (avatar.public_id) {
              // Construct Cloudinary URL
              return `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/${avatar.public_id}`;
            }
          }
          
          // If avatar is a string
          if (typeof avatar === 'string') {
            // Already a full URL
            if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
              return avatar;
            }
            
            // Cloudinary URL without protocol
            if (avatar.includes('cloudinary.com') || avatar.includes('res.cloudinary.com')) {
              return avatar.startsWith('//') ? 'https:' + avatar : avatar;
            }
            
            // Local upload - ensure it starts with /
            if (avatar.startsWith('uploads/')) {
              return '/' + avatar;
            }
            
            // Just a filename
            if (!avatar.includes('/')) {
              return '/' + avatar;
            }
            
            // Already has leading slash
            return avatar;
          }
          
          // Default fallback
          return '/uploads/default-avatar.jpg';
        };

        const unseenCount = await Message.countDocuments({
          senderId: otherId,
          receiverId: currentUserId,
          seen: false
        });

        // Use image field first, then avatar field
        const avatarSource = user?.image || user?.avatar;
        const avatarUrl = getAvatarUrl(avatarSource);

        uniqueMessages.push({
          senderId: otherId,
          username: user?.username || user?.name || 'Unknown User',
          text: msg.message,
          timestamp: msg.createdAt,
          avatar: avatarUrl, // Store the processed URL
          unseenCount
        });

        seenContacts.add(otherId);
      }
    }

    // Debug log to see what we're sending
    console.log('Sending messages to template:', uniqueMessages.map(msg => ({
      username: msg.username,
      avatar: msg.avatar,
      senderId: msg.senderId
    })));

    res.render('chatInbox', { 
      messages: uniqueMessages,
      user: req.user
    });

  } catch (err) {
    console.error('❌ Error fetching student inbox:', err);
    res.status(500).send("Internal Server Error");
  }
});

// Tutor Inbox - Simplified version
router.get('/messages/inbox', isLogged, isTutor, async (req, res) => {
  const tutorId = req.user.id;

  try {
    const allMessages = await Message.find({
      $or: [{ senderId: tutorId }, { receiverId: tutorId }]
    }).sort({ timestamp: -1 });

    const uniqueMessages = [];
    const seenContacts = new Set();

    for (let msg of allMessages) {
      const otherUserId = msg.senderId.toString() === tutorId ? 
        msg.receiverId.toString() : 
        msg.senderId.toString();

      if (!seenContacts.has(otherUserId)) {
        // Get the other user (should be a student since tutor is viewing)
        let user = await User.findById(otherUserId).select('username name image avatar profilePic');
        
        // Get the latest message text
        const latestMessage = await Message.findOne({
          $or: [
            { senderId: otherUserId, receiverId: tutorId },
            { senderId: tutorId, receiverId: otherUserId }
          ]
        }).sort({ timestamp: -1 });

        // Count unseen messages
        const unseenCount = await Message.countDocuments({
          senderId: otherUserId,
          receiverId: tutorId,
          seen: false
        });

        // **SIMPLE FIX: Extract image URL properly**
        const getImageUrl = (imageData) => {
          // If no image data
          if (!imageData) return null;
          
          console.log('Image data type:', typeof imageData, 'value:', imageData);
          
          // Case 1: Already a URL string
          if (typeof imageData === 'string') {
            // Check if it's already a full URL
            if (imageData.startsWith('http') || imageData.startsWith('//')) {
              return imageData.startsWith('//') ? 'https:' + imageData : imageData;
            }
            
            // Check if it's a JSON string
            if (imageData.includes('{') && imageData.includes('}')) {
              try {
                const parsed = JSON.parse(imageData);
                // Try to extract URL from parsed object
                if (parsed.secure_url) return parsed.secure_url;
                if (parsed.url) return parsed.url;
                if (parsed.public_id) {
                  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'dr6yjl8ki';
                  return `https://res.cloudinary.com/${cloudName}/image/upload/${parsed.public_id}`;
                }
              } catch (e) {
                console.log('Failed to parse JSON:', e.message);
              }
            }
            
            // If it's just a filename or path
            return imageData;
          }
          
          // Case 2: It's an object (Cloudinary object)
          if (typeof imageData === 'object' && imageData !== null) {
            console.log('Processing Cloudinary object:', imageData);
            
            // Try different Cloudinary properties
            if (imageData.secure_url) {
              console.log('Found secure_url:', imageData.secure_url);
              return imageData.secure_url;
            }
            if (imageData.url) {
              const url = imageData.url.startsWith('//') ? 'https:' + imageData.url : imageData.url;
              console.log('Found url:', url);
              return url;
            }
            if (imageData.public_id) {
              const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'dr6yjl8ki';
              const url = `https://res.cloudinary.com/${cloudName}/image/upload/${imageData.public_id}`;
              console.log('Constructed from public_id:', url);
              return url;
            }
            
            // Try to find any URL in nested properties
            const findUrlInObject = (obj) => {
              for (let key in obj) {
                if (typeof obj[key] === 'string' && 
                    (obj[key].includes('cloudinary.com') || obj[key].startsWith('http'))) {
                  console.log('Found URL in property', key, ':', obj[key]);
                  return obj[key];
                }
                if (typeof obj[key] === 'object') {
                  const found = findUrlInObject(obj[key]);
                  if (found) return found;
                }
              }
              return null;
            };
            
            const foundUrl = findUrlInObject(imageData);
            if (foundUrl) return foundUrl;
          }
          
          return null;
        };

        // Try to get image from different fields
        let imageUrl = null;
        if (user) {
          // Try different field names
          imageUrl = getImageUrl(user.profilePic) || 
                     getImageUrl(user.image) || 
                     getImageUrl(user.avatar) ||
                     null;
          
          console.log('User image fields:', {
            profilePic: user.profilePic,
            image: user.image,
            avatar: user.avatar,
            finalUrl: imageUrl
          });
        }

        uniqueMessages.push({
          username: user?.username || user?.name || 'Unknown Student',
          text: latestMessage?.message || 'No messages',
          senderId: otherUserId,
          // **Pass the extracted URL, not the object**
          imageUrl: imageUrl || null, // This will be a direct URL or null
          timestamp: latestMessage?.timestamp || msg.timestamp,
          unseenCount
        });

        seenContacts.add(otherUserId);
      }
    }

    console.log('=== TUTOR INBOX DATA ===');
    console.log('Total conversations:', uniqueMessages.length);
    uniqueMessages.forEach((msg, idx) => {
      console.log(`Conversation ${idx}:`, {
        username: msg.username,
        imageUrl: msg.imageUrl,
        hasImage: !!msg.imageUrl,
        senderId: msg.senderId
      });
    });

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
      // Select both avatar and image fields
      let user = await User.findById(id).select('username name userclass avatar image');
      if (user) return { user, model: 'User' };
      user = await Tutor.findById(id).select('username name userclass avatar image');
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

    // Determine which user is the tutor and pass it correctly
    let tutor = null;
    if (senderModel === 'Newtutor') {
      tutor = sender;  // sender is the tutor
    } else if (receiverModel === 'Newtutor') {
      tutor = receiver;  // receiver is the tutor
    }

    res.render('chat', {
      senderId,
      receiverId,
      senderModel,
      receiverModel,
      messages,
      sender,
      receiver,
      roomId,
      user: req.user,
      tutor: tutor // ✅ Pass the tutor object, not the Tutor model
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
