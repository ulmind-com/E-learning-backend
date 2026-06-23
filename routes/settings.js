import express from 'express';
import Setting from '../models/Setting.js';
import { protect, admin } from '../middleware/auth.js';

const router = express.Router();

// @desc    Get certificate template
// @route   GET /api/settings/certificate
// @access  Private/Admin
router.get('/certificate', protect, admin, async (req, res) => {
  try {
    let setting = await Setting.findOne({ key: 'certificateTemplate' });
    if (!setting) {
      setting = await Setting.create({ 
        key: 'certificateTemplate', 
        value: `Create an elegant, professional HTML and inline-CSS certificate of completion.
The student's name is: {{name}}
The course category/title is: {{category}}

Make it look like a real, premium award certificate with borders, a gold seal (using CSS), and beautiful typography. 
Output ONLY valid HTML code. No markdown formatting, no explanations, just the raw HTML code.` 
      });
    }
    res.json(setting);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Update certificate template
// @route   PUT /api/settings/certificate
// @access  Private/Admin
router.put('/certificate', protect, admin, async (req, res) => {
  try {
    const { template } = req.body;
    let setting = await Setting.findOne({ key: 'certificateTemplate' });
    
    if (setting) {
      setting.value = template;
      await setting.save();
    } else {
      setting = await Setting.create({ key: 'certificateTemplate', value: template });
    }
    
    res.json(setting);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
