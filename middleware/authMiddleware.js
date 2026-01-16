const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Newtutor = require('../models/Newtutor');

function isLogged(req, res, next) {
  const token = req.cookies.token;
  if (!token) {
    req.flash('error', 'Please login first');
    return res.redirect('/login');
  }

  jwt.verify(token, process.env.JWT_SECRET || 'yourSecretKey', async (err, decoded) => {
    if (err) {
      console.error('JWT verify error:', err);
      res.clearCookie('token');
      req.flash('error', 'Session expired. Please login again.');
      return res.redirect('/login');
    }

    try {
      let user;
      if (decoded.role === 'student') {
        user = await User.findById(decoded.id).select('-password');
      } else if (decoded.role === 'tutor') {
        user = await Newtutor.findById(decoded.id).select('-password');
      } else if (decoded.role === 'admin') {
        user = { 
          id: 'admin',
          username: decoded.username, 
          role: 'admin',
          name: 'Admin'
        };
      }
      
      if (!user) {
        res.clearCookie('token');
        req.flash('error', 'User not found');
        return res.redirect('/login');
      }

      req.user = user;
      req.userRole = decoded.role;
      next();
    } catch (dbError) {
      console.error('Database error in middleware:', dbError);
      res.clearCookie('token');
      req.flash('error', 'Authentication failed');
      res.redirect('/login');
    }
  });
}

// Rest of the functions remain the same
function isTutor(req, res, next) {
  if (req.userRole === 'tutor' || req.user?.role === 'tutor') {
    return next();
  }
  req.flash('error', 'Access Denied: Tutors only');
  return res.redirect('/login');
}

function isStudent(req, res, next) {
  if (req.userRole === 'student' || req.user?.role === 'student') {
    return next();
  }
  req.flash('error', 'Access Denied: Students only');
  return res.redirect('/login');
}

function isAdmin(req, res, next) {
  if (req.userRole === 'admin' || req.user?.role === 'admin') {
    return next();
  }
  req.flash('error', 'Access Denied: Admins only');
  return res.redirect('/login');
}

module.exports = { isLogged, isTutor, isStudent, isAdmin };