import express from 'express';
import { protect, admin } from '../middleware/auth.js';
import InternshipTask from '../models/InternshipTask.js';
import InternshipApplication from '../models/InternshipApplication.js';

const router = express.Router();

// ==========================================
// STUDENT ROUTES
// ==========================================

// @route   POST /api/internship/apply
// @desc    Apply for an internship
// @access  Private
router.post('/apply', protect, async (req, res) => {
  try {
    const existingApplication = await InternshipApplication.findOne({ user: req.user._id });
    if (existingApplication) {
      return res.status(400).json({ message: 'You have already applied for an internship.' });
    }

    const application = new InternshipApplication({
      user: req.user._id,
      resume: req.body,
    });

    const createdApplication = await application.save();
    res.status(201).json(createdApplication);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/internship/my-application
// @desc    Get user's application and assigned tasks
// @access  Private
router.get('/my-application', protect, async (req, res) => {
  try {
    const application = await InternshipApplication.findOne({ user: req.user._id }).populate('assignedTasks.task');
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }
    res.json(application);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/internship/submit-task
// @desc    Submit links/documents for an assigned task
// @access  Private
router.post('/submit-task', protect, async (req, res) => {
  try {
    const { taskId, gitRepo, liveLink, documentUrl } = req.body;
    
    const application = await InternshipApplication.findOne({ user: req.user._id });
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    const assignedTask = application.assignedTasks.find(t => t.task.toString() === taskId);
    if (!assignedTask) {
      return res.status(404).json({ message: 'Task not assigned to you' });
    }

    assignedTask.submission = { gitRepo, liveLink, documentUrl };
    assignedTask.status = 'Submitted';
    assignedTask.submittedAt = Date.now();

    await application.save();
    res.json({ message: 'Task submitted successfully', application });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// ==========================================
// ADMIN ROUTES
// ==========================================

// @route   POST /api/internship/tasks
// @desc    Create a new internship task template
// @access  Private/Admin
router.post('/tasks', protect, admin, async (req, res) => {
  try {
    const { title, details, referalLink } = req.body;
    const task = new InternshipTask({ title, details, referalLink });
    const createdTask = await task.save();
    res.status(201).json(createdTask);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/internship/tasks
// @desc    Get all internship task templates
// @access  Private/Admin
router.get('/tasks', protect, admin, async (req, res) => {
  try {
    const tasks = await InternshipTask.find({});
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/internship/applications
// @desc    Get all internship applications
// @access  Private/Admin
router.get('/applications', protect, admin, async (req, res) => {
  try {
    const applications = await InternshipApplication.find({}).populate('user', 'name email').populate('assignedTasks.task');
    res.json(applications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/internship/applications/:id/verify
// @desc    Verify application and assign tasks
// @access  Private/Admin
router.put('/applications/:id/verify', protect, admin, async (req, res) => {
  try {
    const { taskIds } = req.body; // Array of task IDs to assign
    
    const application = await InternshipApplication.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    application.status = 'Approved';
    application.assignedTasks = taskIds.map(taskId => ({ task: taskId, status: 'Pending' }));
    
    await application.save();
    
    // Repopulate for response
    const updatedApplication = await InternshipApplication.findById(req.params.id).populate('user', 'name email').populate('assignedTasks.task');
    res.json(updatedApplication);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/internship/applications/:id/verify-task
// @desc    Admin verifies a submitted task
// @access  Private/Admin
router.put('/applications/:id/verify-task', protect, admin, async (req, res) => {
  try {
    const { taskId } = req.body;
    
    const application = await InternshipApplication.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    const assignedTask = application.assignedTasks.find(t => t.task.toString() === taskId);
    if (!assignedTask) {
      return res.status(404).json({ message: 'Task not found in application' });
    }

    assignedTask.status = 'Verified';
    assignedTask.verifiedAt = Date.now();

    await application.save();
    res.json({ message: 'Task verified successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/internship/applications/:id/issue-certificate
// @desc    Issue completion certificate
// @access  Private/Admin
router.put('/applications/:id/issue-certificate', protect, admin, async (req, res) => {
  try {
    const application = await InternshipApplication.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Check if all tasks are verified
    const allVerified = application.assignedTasks.every(t => t.status === 'Verified');
    if (!allVerified) {
      return res.status(400).json({ message: 'Cannot issue certificate until all tasks are verified' });
    }

    application.status = 'Completed';
    application.certificateIssued = true;
    
    await application.save();
    res.json({ message: 'Certificate issued successfully', application });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
