import express from 'express';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
router.put('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      user.name = req.body.name || user.name;
      // Email is NOT updated
      user.mobile = req.body.mobile !== undefined ? req.body.mobile : user.mobile;
      user.college = req.body.college !== undefined ? req.body.college : user.college;
      user.state = req.body.state !== undefined ? req.body.state : user.state;
      user.profileImage = req.body.profileImage !== undefined ? req.body.profileImage : user.profileImage;

      const updatedUser = await user.save();

      res.json({
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        mobile: updatedUser.mobile,
        college: updatedUser.college,
        state: updatedUser.state,
        profileImage: updatedUser.profileImage,
        token: req.headers.authorization.split(' ')[1] // keep same token
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
