const jwt = require('jsonwebtoken');

function isLogged(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.redirect('/login');

  try {
    const decoded = jwt.verify(token, 'yourSecretKey');
    req.user = decoded; // Save decoded token to req.user
    next();
  } catch (err) {
    return res.redirect('/login');
  }
}

function isTutor(req, res, next) {
  if (req.user?.role === 'tutor') return next();
  return res.status(403).send('Access Denied: Tutors only');
}

function isStudent(req, res, next) {
  if (req.user?.role === 'student') return next();
  return res.status(403).send('Access Denied: Students only');
}

function isAdmin(req, res, next) {
  if (req.user?.role === 'admin') return next();
  return res.status(403).send('Access Denied: Admins only');
}

module.exports = { isLogged, isTutor, isStudent, isAdmin };
