import express from 'express';
import { protect, admin } from '../middleware/auth.js';
import Internship from '../models/Internship.js';
import InternshipTask from '../models/InternshipTask.js';
import InternshipApplication from '../models/InternshipApplication.js';

const router = express.Router();

// ==========================================
// PUBLIC ROUTES
// ==========================================

// @route   GET /api/internship/list
// @desc    Get all active internships
// @access  Public
router.get('/list', async (req, res) => {
  try {
    const internships = await Internship.find({ active: true }).sort({ createdAt: -1 });
    res.json(internships);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/internship/list/:id
// @desc    Get specific internship details
// @access  Public
router.get('/list/:id', async (req, res) => {
  try {
    const internship = await Internship.findById(req.params.id);
    if (!internship) return res.status(404).json({ message: 'Internship not found' });
    res.json(internship);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==========================================
// STUDENT ROUTES
// ==========================================

// @route   POST /api/internship/apply
// @desc    Apply for an internship
// @access  Private
router.post('/apply', protect, async (req, res) => {
  try {
    const { internshipId, ...resumeData } = req.body;

    if (!internshipId) {
      return res.status(400).json({ message: 'Internship ID is required' });
    }

    const existingApplication = await InternshipApplication.findOne({ 
      user: req.user._id,
      internship: internshipId 
    });

    if (existingApplication) {
      return res.status(400).json({ message: 'You have already applied for this internship.' });
    }

    const application = new InternshipApplication({
      user: req.user._id,
      internship: internshipId,
      resume: resumeData,
    });

    const createdApplication = await application.save();
    res.status(201).json(createdApplication);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/internship/my-application
// @desc    Get user's applications and assigned tasks
// @access  Private
router.get('/my-application', protect, async (req, res) => {
  try {
    const applications = await InternshipApplication.find({ user: req.user._id })
      .populate('assignedTasks.task')
      .populate('internship', 'title thumbnail');
    
    // We will return the first application for compatibility with existing UI, 
    // or we could return all if the frontend is updated.
    // Let's return the latest one for now, or all if we modify the frontend.
    // I'll return the array and we'll handle it on frontend.
    res.json(applications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/internship/submit-task
// @desc    Submit links/documents for an assigned task
// @access  Private
router.post('/submit-task', protect, async (req, res) => {
  try {
    const { applicationId, taskId, gitRepo, liveLink, documentUrl } = req.body;
    
    // Support legacy request without applicationId
    let application;
    if (applicationId) {
      application = await InternshipApplication.findOne({ _id: applicationId, user: req.user._id });
    } else {
      application = await InternshipApplication.findOne({ user: req.user._id });
    }

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

// @route   POST /api/internship/manage
// @desc    Create a new internship posting
// @access  Private/Admin
router.post('/manage', protect, admin, async (req, res) => {
  try {
    const internship = new Internship(req.body);
    const created = await internship.save();
    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/internship/manage/:id
// @desc    Update an internship posting
// @access  Private/Admin
router.put('/manage/:id', protect, admin, async (req, res) => {
  try {
    const internship = await Internship.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!internship) return res.status(404).json({ message: 'Not found' });
    res.json(internship);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE /api/internship/manage/:id
// @desc    Delete an internship posting
// @access  Private/Admin
router.delete('/manage/:id', protect, admin, async (req, res) => {
  try {
    await Internship.findByIdAndDelete(req.params.id);
    res.json({ message: 'Internship removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


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
    const applications = await InternshipApplication.find({})
      .populate('user', 'name email')
      .populate('internship', 'title')
      .populate('assignedTasks.task');
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
    const updatedApplication = await InternshipApplication.findById(req.params.id)
      .populate('user', 'name email')
      .populate('internship', 'title')
      .populate('assignedTasks.task');
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
