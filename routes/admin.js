const express = require('express');
const router = express.Router();
const Newtutor = require('../models/Newtutor');
const User = require('../models/User');
const {isLogged,isAdmin} = require('../middleware/authMiddleware');


// Admin Dashboard
router.get('/admin',isLogged, isAdmin, async (req, res) => {
  try {
    const pendingTutors = await Newtutor.find({ approved: false, rejected: { $ne: true } });
    const approvedTutors = await Newtutor.find({ approved: true });
    const rejectedTutors = await Newtutor.find({ rejected: true });

    const pendingStudents = await User.find({ approved: false });

    const pendingCount = pendingTutors.length;
    const approvedCount = approvedTutors.length;
    const rejectedCount = rejectedTutors.length;

    res.render('admin_dashboard', {
      pendingTutors,
      approvedTutors,
      rejectedTutors,
      pendingStudents,
      pendingCount,
      approvedCount,
      rejectedCount
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

// Approve tutor
router.get('/admin/approve/tutor/:id',isLogged, isAdmin, async (req, res) => {
  await Newtutor.findByIdAndUpdate(req.params.id, { approved: true, rejected: false });
  res.redirect('/admin');
});

// Reject tutor
router.get('/admin/reject/tutor/:id',isLogged, isAdmin, async (req, res) => {
  await Newtutor.findByIdAndUpdate(req.params.id, { approved: false, rejected: true });
  await Newtutor.findByIdAndDelete(req.params.id, { rejected: true});
  res.redirect('/admin');
});



module.exports = router;
