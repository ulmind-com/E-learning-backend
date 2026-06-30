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

// ==================== LANDING PAGE SETTINGS ====================

// Helper to get or create a setting
async function getOrCreate(key, defaultValue) {
  let setting = await Setting.findOne({ key });
  if (!setting) {
    setting = await Setting.create({ key, value: defaultValue });
  }
  return setting;
}

// @desc    Get all landing page settings (public)
// @route   GET /api/settings/landing
// @access  Public
router.get('/landing', async (req, res) => {
  try {
    const [video, stats, impact, comparison] = await Promise.all([
      getOrCreate('landingVideo', { url: '', poster: '' }),
      getOrCreate('landingStats', { stat1Label: 'YouTube Subscribers', stat1Value: '600k', stat2Label: 'Career-Driven Learners', stat2Value: '01 Million' }),
      getOrCreate('landingImpact', []),
      getOrCreate('landingComparison', {
        usPoints: [
          'Highly Affordable, No Quality Cuts',
          'Project-Based, Skill-First Learning',
          'Continuously Updated With Industry Trends',
          'Internal Hackathons, Challenges & Face-Offs',
          'Industry-Relevant, Job-Oriented Curriculum'
        ],
        othersPoints: [
          'High Fees With Compromised Quality',
          'Theory-Centric Learning',
          'Outdated, Static Curriculum',
          'No Competitive Learning Environment',
          'Limited Practical Exposure'
        ]
      })
    ]);

    res.json({
      video: video.value,
      stats: stats.value,
      impact: impact.value,
      comparison: comparison.value
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Update hero video
// @route   PUT /api/settings/landing/video
// @access  Private/Admin
router.put('/landing/video', protect, admin, async (req, res) => {
  try {
    const { url, poster } = req.body;
    const setting = await getOrCreate('landingVideo', { url: '', poster: '' });
    setting.value = { url: url || '', poster: poster || '' };
    await setting.save();
    res.json(setting.value);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Update stats
// @route   PUT /api/settings/landing/stats
// @access  Private/Admin
router.put('/landing/stats', protect, admin, async (req, res) => {
  try {
    const { stat1Label, stat1Value, stat2Label, stat2Value } = req.body;
    const setting = await getOrCreate('landingStats', {});
    setting.value = { stat1Label, stat1Value, stat2Label, stat2Value };
    await setting.save();
    res.json(setting.value);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Add impact memory
// @route   POST /api/settings/landing/impact
// @access  Private/Admin
router.post('/landing/impact', protect, admin, async (req, res) => {
  try {
    const { imageUrl, title, description, tag } = req.body;
    const setting = await getOrCreate('landingImpact', []);
    const items = Array.isArray(setting.value) ? setting.value : [];
    items.push({ imageUrl, title: title || '', description: description || '', tag: tag || '' });
    setting.value = items;
    setting.markModified('value');
    await setting.save();
    res.json(setting.value);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Remove impact memory
// @route   DELETE /api/settings/landing/impact/:index
// @access  Private/Admin
router.delete('/landing/impact/:index', protect, admin, async (req, res) => {
  try {
    const idx = parseInt(req.params.index);
    const setting = await getOrCreate('landingImpact', []);
    const items = Array.isArray(setting.value) ? setting.value : [];
    if (idx < 0 || idx >= items.length) {
      return res.status(400).json({ message: 'Invalid index' });
    }
    items.splice(idx, 1);
    setting.value = items;
    setting.markModified('value');
    await setting.save();
    res.json(setting.value);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Update comparison points
// @route   PUT /api/settings/landing/comparison
// @access  Private/Admin
router.put('/landing/comparison', protect, admin, async (req, res) => {
  try {
    const { usPoints, othersPoints } = req.body;
    const setting = await getOrCreate('landingComparison', { usPoints: [], othersPoints: [] });
    setting.value = { usPoints: usPoints || [], othersPoints: othersPoints || [] };
    setting.markModified('value');
    await setting.save();
    res.json(setting.value);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;

