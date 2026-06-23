import express from 'express';
import Doubt from '../models/Doubt.js';
import { protect, admin } from '../middleware/auth.js';

const router = express.Router();

// @desc    Submit a new doubt
// @route   POST /api/doubts
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    const { courseId, videoUrl, questionText, questionMedia } = req.body;

    if (!courseId || !videoUrl || !questionText) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const doubt = new Doubt({
      student: req.user._id,
      course: courseId,
      videoUrl,
      questionText,
      questionMedia,
    });

    const createdDoubt = await doubt.save();
    res.status(201).json(createdDoubt);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while creating doubt' });
  }
});

// @desc    Get all doubts for a specific video
// @route   GET /api/doubts/video
// @access  Private
router.get('/video', protect, async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ message: 'Video URL is required' });
    }

    const doubts = await Doubt.find({ videoUrl: url })
      .populate('student', 'name email profileImage')
      .sort({ createdAt: -1 });
    
    res.json(doubts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while fetching doubts' });
  }
});

// @desc    Get all pending doubts for admin
// @route   GET /api/doubts/admin/pending
// @access  Private/Admin
router.get('/admin/pending', protect, admin, async (req, res) => {
  try {
    const doubts = await Doubt.find({ status: 'pending' })
      .populate('student', 'name email profileImage')
      .populate('course', 'title')
      .sort({ createdAt: 1 });
    
    res.json(doubts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while fetching pending doubts' });
  }
});

// @desc    Solve a doubt
// @route   POST /api/doubts/admin/solve/:id
// @access  Private/Admin
router.post('/admin/solve/:id', protect, admin, async (req, res) => {
  try {
    const { adminReplyText, adminReplyMedia } = req.body;
    
    const doubt = await Doubt.findById(req.params.id);
    if (!doubt) {
      return res.status(404).json({ message: 'Doubt not found' });
    }

    doubt.adminReplyText = adminReplyText;
    doubt.adminReplyMedia = adminReplyMedia;
    doubt.status = 'solved';
    doubt.solvedAt = new Date();

    const updatedDoubt = await doubt.save();
    res.json(updatedDoubt);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while solving doubt' });
  }
});

// @desc    Get recently solved doubts for student dashboard
// @route   GET /api/doubts/student/recent
// @access  Private
router.get('/student/recent', protect, async (req, res) => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const doubts = await Doubt.find({
      student: req.user._id,
      status: 'solved',
      solvedAt: { $gte: twentyFourHoursAgo }
    })
    .populate('course', 'title')
    .sort({ solvedAt: -1 });

    res.json(doubts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while fetching recent doubts' });
  }
});

export default router;
