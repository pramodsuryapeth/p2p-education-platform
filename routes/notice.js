const express = require('express');
const router = express.Router();
const Newtutor = require('../models/Newtutor');
const Notice = require('../models/Notice');
const { isLogged, isTutor, isStudent } = require('../middleware/authMiddleware');

// ✅ GET: Notice creation form
router.post('/notices', isLogged, isTutor, async (req, res) => {
  try {
    const { title, message, priority, deleteDate } = req.body;
    
    const notice = await Notice.create({
      tutorId: req.user.id,
      title,
      message,
      priority,
      deleteDate: new Date(deleteDate)
    });

    res.json({ success: true, notice });
  } catch (error) {
    console.error('Error creating notice:', error);
    res.status(500).json({ success: false, message: 'Error creating notice' });
  }
});

router.delete('/notices/:id', isLogged, isTutor, async (req, res) => {
  try {
    const notice = await Notice.findOneAndDelete({
      _id: req.params.id,
      tutorId: req.user.id
    });

    if (!notice) {
      return res.status(404).json({ success: false, message: 'Notice not found' });
    }

    res.json({ success: true, message: 'Notice deleted successfully' });
  } catch (error) {
    console.error('Error deleting notice:', error);
    res.status(500).json({ success: false, message: 'Error deleting notice' });
  }
});

module.exports = router;