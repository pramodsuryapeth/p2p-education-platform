// app.js
const express = require('express');
const app = express();
const mongoose = require('mongoose');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const { isLogged, isTutor, isStudent } = require('./middleware/authMiddleware');
require('dotenv').config(); 

// ⬇️ Load Models
const Message = require('./models/Message');
const User = require('./models/User');
const Newtutor = require('./models/Newtutor'); // ✅ Correct import
const Course = require('./models/video');
const Rating = require('./models/Rating');

// ✅ MongoDB connection

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("✅ MongoDB Connected"))
.catch(err => console.error("❌ MongoDB Error:", err));
// ✅ Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// ✅ Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/videos', express.static(path.join(__dirname, 'public/videos')));

// ✅ Ensure directories exist
const uploadDir = path.join(__dirname, 'public/uploads');
const videoDir = path.join(__dirname, 'public/videos');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });

// ✅ Session & Flash
app.use(session({
  secret: 'yourSecretKey',
  resave: false,
  saveUninitialized: true
}));
app.use(flash());

// ✅ Flash messages middleware
app.use((req, res, next) => {
  res.locals.successMessage = req.flash('success');
  res.locals.errorMessage = req.flash('error');
  next();
});

// ✅ Make socket.io accessible in routes
app.set('socketio', io);

// ✅ Routes
app.get('/', (req, res) => res.render('index'));
app.get('/login', (req, res) => res.render('login'));
app.get('/signup', (req, res) => res.render('signup'));
app.get('/profile', (req, res) => res.render('profile'));

// Import other routes
const authRoutes = require('./routes/auth');
const tutorRoutes = require('./routes/tutor');
const videoRoutes = require('./routes/video');
const chatRoutes = require('./routes/chat');
const noticeRoutes = require('./routes/notice');
const adminRoutes = require('./routes/admin');


app.use('/', authRoutes);
app.use('/', tutorRoutes);
app.use('/', videoRoutes);
app.use('/', chatRoutes);
app.use('/', adminRoutes);
app.use('/', noticeRoutes);


// ❌ 404 fallback
app.use((req, res) => {
  res.status(404).send('404 Page Not Found');
});

// Socket.IO
let liveTutors = {}; // { tutorId: { viewers: Set(), viewerData: Map() } }

io.on("connection", (socket) => {
  console.log("✅ User connected:", socket.id);

  // ---------------- Tutor WebRTC & Live Streaming ----------------
  socket.on("tutor-start", async ({ tutorId }) => {
    try {
      // Update database first
      await Newtutor.findByIdAndUpdate(tutorId, { isLive: true });
      
      liveTutors[tutorId] = { viewers: new Set(), viewerData: new Map() };
      socket.join(`tutor-${tutorId}`);
      
      // Get updated list of live tutors and notify all students
      const liveTutorDocs = await Newtutor.find({ 
        isLive: true,
        approved: true 
      }).select("name image _id skills");
      
      io.to("students").emit("liveTutorsData", liveTutorDocs);
      console.log(`Tutor ${tutorId} started live session. ${liveTutorDocs.length} tutors now live.`);
    } catch (err) {
      console.error('Error starting tutor session:', err);
    }
  });

  // Enhanced tutor stop event
  socket.on("tutor-stop", async ({ tutorId }) => {
    try {
      // Update database first
      await Newtutor.findByIdAndUpdate(tutorId, { isLive: false });
      
      if (liveTutors[tutorId]) {
        delete liveTutors[tutorId];
        
        // Get updated list of live tutors
        const liveTutorDocs = await Newtutor.find({ 
          isLive: true,
          approved: true 
        }).select("name image _id skills");
        
        io.to("students").emit("liveTutorsData", liveTutorDocs);
        io.to(`tutor-${tutorId}`).emit("tutorStoppedLive");
        console.log(`Tutor ${tutorId} stopped live session. ${liveTutorDocs.length} tutors remaining live.`);
      }
    } catch (err) {
      console.error('Error stopping tutor session:', err);
    }
  });

  // FIXED: Handle student-join with proper ID mapping
  socket.on("student-join", async ({ tutorId, studentId, socketId, studentName }) => {
    console.log(`Student ${studentId} (${studentName || 'Unknown'}) joining tutor ${tutorId}`);
    
    // Initialize if not exists
    if (!liveTutors[tutorId]) {
      liveTutors[tutorId] = { 
        viewers: new Set(),
        viewerData: new Map()
      };
    }
    
    // Add student to viewers Set
    liveTutors[tutorId].viewers.add(studentId);
    
    // Store detailed data with student name
    liveTutors[tutorId].viewerData.set(studentId, {
      socketId: socketId || socket.id,
      studentName: studentName || `Student ${liveTutors[tutorId].viewers.size}`,
      joinedAt: new Date()
    });
    
    socket.join(`tutor-${tutorId}`);
    
    // Emit to tutor with correct student ID
    io.to(`tutor-${tutorId}`).emit("student-join", { 
      studentId: studentId,
      socketId: socketId || socket.id,
      studentName: studentName || `Student ${liveTutors[tutorId].viewers.size}`
    });

    // Update viewer count
    io.to(`tutor-${tutorId}`).emit("viewerCountUpdate", liveTutors[tutorId].viewers.size);
  });

  // FIXED: Handle student-answer with proper ID
  socket.on("student-answer", ({ studentId, tutorId, answer, socketId }) => {
    console.log(`Received answer from student ${studentId} for tutor ${tutorId}`);
    
    // Forward to tutor with the correct student ID
    io.to(`tutor-${tutorId}`).emit("student-answer", {
      studentId: studentId,
      answer: answer,
      socketId: socketId || socket.id
    });
  });

  // FIXED: Handle ICE candidates with proper ID
  socket.on("ice-candidate", ({ candidate, tutorId, role, studentId, socketId }) => {
    console.log(`ICE candidate from ${role} ${studentId} for tutor ${tutorId}`);
    
    if (role === "student") {
      io.to(`tutor-${tutorId}`).emit("ice-candidate", {
        candidate: candidate,
        studentId: studentId,
        role: role,
        socketId: socketId || socket.id
      });
    } else if (role === "tutor") {
      // Forward to specific student
      if (studentId && liveTutors[tutorId] && liveTutors[tutorId].viewerData.has(studentId)) {
        const studentData = liveTutors[tutorId].viewerData.get(studentId);
        io.to(studentData.socketId).emit("ice-candidate", {
          candidate: candidate,
          role: role
        });
      }
    }
  });

  // Tutor -> Student Offer
  socket.on("tutor-offer", ({ offer, studentId, tutorId }) => {
    console.log(`Sending offer to student ${studentId}`);
    if (liveTutors[tutorId] && liveTutors[tutorId].viewerData.has(studentId)) {
      const studentData = liveTutors[tutorId].viewerData.get(studentId);
      io.to(studentData.socketId).emit("tutor-offer", { offer });
    }
  });

  // Add verification endpoint
  socket.on("student-verify", ({ studentId, tutorId, timestamp }) => {
    console.log(`✅ Verification: Student ${studentId} connected to tutor ${tutorId}`);
    socket.emit("verification-response", {
      status: "verified",
      studentId: studentId,
      tutorId: tutorId,
      serverTime: Date.now()
    });
  });

  // SINGLE joinStudentDashboard handler
  socket.on("joinStudentDashboard", async () => {
    socket.join("students");
    try {
      const liveTutorDocs = await Newtutor.find({ 
        isLive: true,
        approved: true 
      }).select("name image _id skills");
      
      console.log(`Sending ${liveTutorDocs.length} live tutors to student dashboard`);
      socket.emit("liveTutorsData", liveTutorDocs);
    } catch (err) {
      console.error('Error sending live tutors to dashboard:', err);
    }
  });

  // ---------------- REAL-TIME MESSAGE COUNTING SYSTEM ----------------
  
  // Join user's personal message room for real-time updates
  socket.on('joinMessageRoom', async (userId) => {
    try {
      socket.join(`user-messages-${userId}`);
      console.log(`📨 User ${userId} joined message room`);

      // Send initial unseen count
      const unseenCount = await Message.countDocuments({
        receiverId: userId,
        seen: false
      });
      
      socket.emit('unseenCountUpdate', { count: unseenCount });
      
      console.log(`📊 Initial unseen count for ${userId}: ${unseenCount}`);
    } catch (err) {
      console.error('Error joining message room:', err);
    }
  });

  // Request current unseen count
  socket.on('requestUnseenCount', async (userId) => {
    try {
      const unseenCount = await Message.countDocuments({
        receiverId: userId,
        seen: false
      });
      
      socket.emit('unseenCountUpdate', { count: unseenCount });
      console.log(`📊 Unseen count requested for ${userId}: ${unseenCount}`);
    } catch (err) {
      console.error('Error getting unseen count:', err);
    }
  });

  // Request conversation-specific unseen count
  socket.on('requestConversationUnseen', async ({ userId, contactId }) => {
    try {
      const unseenCount = await Message.countDocuments({
        senderId: contactId,
        receiverId: userId,
        seen: false
      });
      
      socket.emit('conversationUnseenUpdate', { 
        contactId, 
        count: unseenCount 
      });
      console.log(`📊 Conversation unseen count for ${userId} with ${contactId}: ${unseenCount}`);
    } catch (err) {
      console.error('Error getting conversation unseen count:', err);
    }
  });

  // Mark messages as seen in real-time
  socket.on('markMessagesAsSeen', async ({ userId, contactId }) => {
    try {
      await Message.updateMany(
        { 
          senderId: contactId, 
          receiverId: userId, 
          seen: false 
        },
        { $set: { seen: true } }
      );

      // Update total unseen count
      const totalUnseenCount = await Message.countDocuments({
        receiverId: userId,
        seen: false
      });

      // Notify user about updated count
      io.to(`user-messages-${userId}`).emit('unseenCountUpdate', { 
        count: totalUnseenCount 
      });

      // Also update the specific conversation count
      io.to(`user-messages-${userId}`).emit('conversationUnseenUpdate', {
        contactId,
        count: 0 // All messages from this contact are now seen
      });

      console.log(`✅ Messages from ${contactId} marked as seen by ${userId}. Total unseen: ${totalUnseenCount}`);
    } catch (err) {
      console.error('Error marking messages as seen:', err);
    }
  });

  // ---------------- Chat System (Dual Purpose) ----------------
  // Purpose 1: Live Session Chat (tutor-student during live streams)
  // Purpose 2: General Messaging (student-tutor outside live sessions)

  // Join specific chat room - for both live sessions and general messaging
  socket.on('joinRoom', (roomId) => {
    socket.join(roomId);
    console.log(`🔗 User joined room: ${roomId}`);
  });

  // Join personal room for notifications - for both systems
  socket.on('joinUser', (userId) => {
    socket.join(userId);
    console.log(`👤 User joined personal room: ${userId}`);
  });

  // 📩 Unified Chat Message Handler - Handles both:
  // 1. Live session chat messages (roomId = tutor-{tutorId})
  // 2. General private messages (roomId = student-{studentId}-tutor-{tutorId})
  socket.on('chatMessage', async (msg) => {
    try {
      console.log(`📨 Chat message received in ${msg.roomId} from ${msg.senderName}: ${msg.message}`);
      
      // Determine if this is a live session chat or general message
      const isLiveSessionChat = msg.roomId && msg.roomId.startsWith('tutor-');
      
      // Save message to database
      const newMsg = await Message.create({
        roomId: msg.roomId,
        senderId: msg.senderId,
        senderName: msg.senderName,
        senderModel: msg.senderModel || 'User', // Default if not provided
        receiverId: msg.receiverId,
        receiverModel: msg.receiverModel || 'User', // Default if not provided
        message: msg.message,
        isLiveSession: isLiveSessionChat, // Mark if it's from live session
        timestamp: new Date(),
        seen: false
      });

      // Create payload for broadcasting
      const payload = {
        _id: newMsg._id,
        roomId: msg.roomId,
        senderId: msg.senderId,
        senderName: msg.senderName,
        senderModel: msg.senderModel || 'User',
        receiverId: msg.receiverId,
        receiverModel: msg.receiverModel || 'User',
        message: msg.message,
        isLiveSession: isLiveSessionChat,
        timestamp: newMsg.timestamp,
        seen: false
      };

      // Broadcast to everyone in the room (for both live sessions and general chat)
      io.to(msg.roomId).emit('chatMessage', payload);
      
      // ✅ REAL-TIME COUNTING: Update unseen counts for receiver
      if (msg.receiverId && msg.receiverId !== 'all') {
        // Get updated counts
        const receiverUnseenCount = await Message.countDocuments({
          receiverId: msg.receiverId,
          seen: false
        });

        const conversationUnseenCount = await Message.countDocuments({
          senderId: msg.senderId,
          receiverId: msg.receiverId,
          seen: false
        });

        // Notify receiver about new message and updated counts
        io.to(`user-messages-${msg.receiverId}`).emit('unseenCountUpdate', {
          count: receiverUnseenCount
        });

        io.to(`user-messages-${msg.receiverId}`).emit('conversationUnseenUpdate', {
          contactId: msg.senderId,
          count: conversationUnseenCount
        });

        // Also send new message notification
        io.to(msg.receiverId.toString()).emit('newMessageNotification', payload);

        console.log(`📊 Updated counts for ${msg.receiverId}: Total=${receiverUnseenCount}, Conversation=${conversationUnseenCount}`);
      }
      
      console.log(`✅ Chat message broadcasted to room ${msg.roomId} (Live Session: ${isLiveSessionChat})`);

    } catch (err) {
      console.error("❌ Error saving/processing chat message:", err);
      
      // Send error back to sender
      socket.emit('chatError', {
        error: 'Failed to send message',
        message: msg.message
      });
    }
  });

  // ✍️ Unified Typing Indicator - Works for both systems
  socket.on('typing', (data) => {
    console.log(`⌨️ Typing event in ${data.roomId} from ${data.senderId}`);
    
    // Broadcast typing indicator to everyone except the sender
    socket.to(data.roomId).emit('typing', {
      senderId: data.senderId,
      senderName: data.senderName || 'User',
      typing: data.typing !== false // Default to true if not specified
    });
  });

  // ---------------- Disconnect Handler ----------------
  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);
    
    // Remove student from liveTutors if needed (Live Streaming System)
    for (const tutorId in liveTutors) {
      for (const [studentId, data] of liveTutors[tutorId].viewerData) {
        if (data.socketId === socket.id) {
          // Notify tutor about student disconnect from live session
          io.to(`tutor-${tutorId}`).emit("student-disconnect", {
            studentId: studentId,
            studentName: data.studentName
          });
          
          // Remove from tracking
          liveTutors[tutorId].viewers.delete(studentId);
          liveTutors[tutorId].viewerData.delete(studentId);
          
          // Update viewer count
          io.to(`tutor-${tutorId}`).emit("viewerCountUpdate", liveTutors[tutorId].viewers.size);
          break;
        }
      }
    }
    
    // Note: Chat system doesn't need special cleanup on disconnect
    // Users will automatically leave rooms when socket disconnects
  });
});
app.use(express.static("public"));
const PORT = process.env.PORT || 3000;
// ✅ Start Server
http.listen(PORT, () => {
  console.log("🚀 Server running at http://localhost:3000");
});