import express from 'express';
import Course from '../models/Course.js';
import Order from '../models/Order.js';
import Setting from '../models/Setting.js';
import { protect, admin } from '../middleware/auth.js';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const router = express.Router();

// Helper function to check if a user has purchased a course (optional/soft authentication check)
const hasAccessToVideo = async (courseId, courseType, req) => {
  // Free courses are always accessible
  if (courseType === 'free') return true;

  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);

      if (!user) return false;
      if (user.role === 'admin') return true;

      // Check for completed purchase
      const purchase = await Order.findOne({
        student: user._id,
        course: courseId,
        status: 'completed',
      });
      return !!purchase;
    } catch (error) {
      return false;
    }
  }
  return false;
};

// @desc    Get courses purchased by the logged-in student
// @route   GET /api/courses/my
// @access  Private
router.get('/my', protect, async (req, res) => {
  try {
    // Find all completed orders for this student
    const orders = await Order.find({
      student: req.user._id,
      status: 'completed',
    });

    const courseIds = orders.map((order) => order.course);

    // Fetch the full course objects (include videoUrl since they own them)
    const courses = await Course.find({ _id: { $in: courseIds } }).populate(
      'instructor',
      'name email'
    );

    return res.json(courses);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// @desc    Get all courses
// @route   GET /api/courses
// @access  Public
router.get('/', async (req, res) => {
  try {
    const courses = await Course.find({}).populate('instructor', 'name email');

    // For listing, omit the videoUrl for paid courses to prevent students from inspecting
    const safeCourses = courses.map((course) => {
      const courseObj = course.toObject();
      if (courseObj.courseType === 'paid') {
        if (courseObj.videos) {
          courseObj.videos = courseObj.videos.map(v => ({ title: v.title, duration: v.duration }));
        }
      }
      return courseObj;
    });

    return res.json(safeCourses);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// @desc    Get all courses for admin (includes videoUrls)
// @route   GET /api/courses/admin
// @access  Private/Admin
router.get('/admin', protect, admin, async (req, res) => {
  try {
    const courses = await Course.find({}).populate('instructor', 'name email');
    return res.json(courses);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// @desc    Get a course by ID
// @route   GET /api/courses/:id
// @access  Public (conditional videoUrl access)
router.get('/:id', async (req, res) => {
  try {
    const course = await Course.findById(req.params.id).populate(
      'instructor',
      'name email'
    );
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    const canAccess = await hasAccessToVideo(course._id, course.courseType, req);
    const courseObj = course.toObject();

    if (!canAccess) {
      // Omit videoUrl from response if not purchased and not admin
      if (courseObj.videos) {
        courseObj.videos = courseObj.videos.map(v => ({ title: v.title, duration: v.duration }));
      }
      courseObj.isPurchased = false;
    } else {
      courseObj.isPurchased = true;
    }

    return res.json(courseObj);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// @desc    Create a course
// @route   POST /api/courses
// @access  Private/Admin
router.post('/', protect, admin, async (req, res) => {
  try {
    const {
      title,
      description,
      courseType,
      price,
      category,
      level,
      duration,
      thumbnail,
      videos,
    } = req.body;

    if (!title || !description) {
      return res
        .status(400)
        .json({ message: 'Please provide title and description' });
    }

    const course = await Course.create({
      title,
      description,
      courseType: courseType || 'paid',
      price: courseType === 'free' ? 0 : price,
      category: category || 'General',
      level: level || 'beginner',
      duration: duration || '',
      thumbnail: thumbnail || '',
      videos: videos || [],
      instructor: req.user._id,
    });

    return res.status(201).json(course);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// @desc    Update a course
// @route   PUT /api/courses/:id
// @access  Private/Admin
router.put('/:id', protect, admin, async (req, res) => {
  try {
    const {
      title,
      description,
      courseType,
      price,
      category,
      level,
      duration,
      thumbnail,
      videos,
      chapters,
    } = req.body;

    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    course.title = title || course.title;
    course.description = description || course.description;
    course.courseType = courseType || course.courseType;
    course.price = courseType === 'free' ? 0 : price !== undefined ? price : course.price;
    course.category = category || course.category;
    course.level = level || course.level;
    course.duration = duration !== undefined ? duration : course.duration;
    course.thumbnail = thumbnail !== undefined ? thumbnail : course.thumbnail;
    course.videos = videos !== undefined ? videos : course.videos;
    if (chapters !== undefined) course.chapters = chapters;

    const updatedCourse = await course.save();
    return res.json(updatedCourse);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// @desc    Delete a course
// @route   DELETE /api/courses/:id
// @access  Private/Admin
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    await course.deleteOne();
    return res.json({ message: 'Course removed successfully' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// @desc    Update video progress (mark as completed)
// @route   POST /api/courses/:id/progress
// @access  Private
router.post('/:id/progress', protect, async (req, res) => {
  try {
    const courseId = req.params.id;
    const { videoId, analytics } = req.body;

    if (!videoId) {
      return res.status(400).json({ message: 'Video ID is required' });
    }

    const order = await Order.findOne({
      student: req.user._id,
      course: courseId,
      status: 'completed',
    });

    if (!order) {
      return res.status(403).json({ message: 'Course access not found or pending.' });
    }

    if (!order.completedVideos.includes(videoId)) {
      order.completedVideos.push(videoId);
    }
    
    // Save analytics if provided
    if (analytics) {
      // Perfect Watch Rule: If they already watched it perfectly, don't penalize future rewatches
      const perfectWatchExists = order.videoAnalytics.some(
        a => a.videoId === videoId && a.skipped === false && a.averageSpeed <= 1.05
      );
      
      if (!perfectWatchExists) {
        order.videoAnalytics.push({
          videoId: videoId,
          watchTime: analytics.watchTime,
          averageSpeed: analytics.averageSpeed,
          skipped: analytics.skipped,
          skipCount: analytics.skipCount,
          timestamp: new Date()
        });
      }
    }

    // Track activity
    order.lastAccessed = new Date();
    await order.save();

    return res.json({ success: true, completedVideos: order.completedVideos });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// @desc    Get user progress for a course
// @route   GET /api/courses/:id/progress
// @access  Private
router.get('/:id/progress', protect, async (req, res) => {
  try {
    const courseId = req.params.id;

    const order = await Order.findOne({
      student: req.user._id,
      course: courseId,
      status: 'completed',
    });

    if (!order) {
      return res.json({ completedVideos: [], certificate: null }); // No progress if not enrolled
    }

    // Track activity
    order.lastAccessed = new Date();
    await order.save();
    // Check for pending certificate requests
    const { default: CertificateRequest } = await import('../models/CertificateRequest.js');
    const certRequest = await CertificateRequest.findOne({ student: req.user._id, course: courseId });

    return res.json({ 
      completedVideos: order.completedVideos, 
      certificate: order.certificate,
      certificateRequestStatus: certRequest ? certRequest.status : null,
      mockTestResults: order.mockTestResults || []
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// @desc    Create or update new review
// @route   POST /api/courses/:id/reviews
// @access  Private
router.post('/:id/reviews', protect, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const courseId = req.params.id;

    if (!rating || !comment) {
      return res.status(400).json({ message: 'Rating and comment are required' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Check if user has purchased the course (free or paid)
    // We check the Order collection for a completed status
    const hasPurchased = await Order.findOne({
      student: req.user._id,
      course: courseId,
      status: 'completed'
    });

    if (!hasPurchased && course.courseType !== 'free') {
      return res.status(403).json({ message: 'You must own this course to review it' });
    }

    // Check if user already reviewed
    const alreadyReviewed = course.reviews.find(
      (r) => r.user.toString() === req.user._id.toString()
    );

    if (alreadyReviewed) {
      // Update existing review
      alreadyReviewed.rating = Number(rating);
      alreadyReviewed.comment = comment;
    } else {
      // Create new review
      const review = {
        name: req.user.name,
        rating: Number(rating),
        comment,
        user: req.user._id,
      };
      course.reviews.push(review);
      course.numReviews = course.reviews.length;
    }

    // Calculate new average rating
    course.rating =
      course.reviews.reduce((acc, item) => item.rating + acc, 0) /
      course.reviews.length;

    await course.save();
    return res.status(201).json({ message: 'Review saved successfully', reviews: course.reviews });
  } catch (error) {
    console.error('Review Error:', error);
    return res.status(500).json({ message: error.message });
  }
});

// @desc    Request Certificate for completed course
// @route   POST /api/courses/:id/certificate/request
// @access  Private
router.post('/:id/certificate/request', protect, async (req, res) => {
  try {
    const courseId = req.params.id;
    const userId = req.user._id;

    // 1. Fetch Course and Order
    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: 'Course not found' });

    const order = await Order.findOne({ student: userId, course: courseId, status: 'completed' });
    if (!order) return res.status(403).json({ message: 'You have not enrolled in this course' });

    // 2. Verify 100% completion
    if (order.completedVideos.length < course.videos.length) {
      return res.status(400).json({ message: 'Course is not fully completed yet' });
    }

    // 3. Check if certificate already exists
    if (order.certificate) {
      return res.status(400).json({ message: 'Certificate already generated' });
    }

    // 4. Calculate Performance Score
    let videoPerformanceScore = 100;
    if (order.videoAnalytics && order.videoAnalytics.length > 0) {
      let totalSkips = order.videoAnalytics.reduce((acc, curr) => acc + (curr.skipCount || 0), 0);
      let speedSum = 0;
      let speedCount = 0;
      order.videoAnalytics.forEach(v => {
        if (v.averageSpeed) {
          speedSum += v.averageSpeed;
          speedCount++;
        }
      });
      let avgSpeed = speedCount > 0 ? (speedSum / speedCount) : 1;

      videoPerformanceScore -= (totalSkips * 5);
      if (avgSpeed > 1.5) {
        videoPerformanceScore -= Math.round((avgSpeed - 1) * 20);
      }
      if (videoPerformanceScore < 0) videoPerformanceScore = 0;
      if (videoPerformanceScore > 100) videoPerformanceScore = 100;
    }

    // Include Mock Test Scores if applicable
    let finalPerformanceScore = videoPerformanceScore;
    
    if (course.mockTests && course.mockTests.length > 0) {
      if (!order.mockTestResults || order.mockTestResults.length < course.mockTests.length) {
        return res.status(400).json({ message: 'You must complete all mock tests before requesting a certificate' });
      }
      
      let totalMockScore = 0;
      order.mockTestResults.forEach(result => {
        // Calculate percentage for this mock test
        const percentage = (result.score / result.totalQuestions) * 100;
        totalMockScore += percentage;
      });
      
      const avgMockScore = totalMockScore / course.mockTests.length;
      
      // Final score is average of video performance and mock test performance
      finalPerformanceScore = Math.round((videoPerformanceScore + avgMockScore) / 2);
    }

    let performanceScore = finalPerformanceScore;

    // 5. Check Score Requirement
    if (performanceScore < 65) {
      return res.status(400).json({ 
        message: `Your performance score is ${performanceScore}%. You need at least 65% to generate a certificate. Please review the material carefully.` 
      });
    }

    // 6. Check if a pending request already exists
    const { default: CertificateRequest } = await import('../models/CertificateRequest.js');
    const existingRequest = await CertificateRequest.findOne({ student: userId, course: courseId });
    
    if (existingRequest && existingRequest.status === 'pending') {
      return res.status(400).json({ message: 'You already have a pending certificate request' });
    }
    
    if (existingRequest && existingRequest.status === 'rejected') {
       existingRequest.status = 'pending';
       existingRequest.score = performanceScore;
       await existingRequest.save();
       return res.status(200).json({ message: 'Certificate request re-submitted to admin', request: existingRequest });
    }

    // 7. Create Request
    const newRequest = await CertificateRequest.create({
      student: userId,
      course: courseId,
      score: performanceScore,
      status: 'pending'
    });

    res.status(201).json({ message: 'Certificate request sent to admin successfully', request: newRequest });

  } catch (error) {
    console.error('Certificate Request Error:', error);
    res.status(500).json({ message: error.message });
  }
});


// @desc    Get all students and their progress for a specific course
// @route   GET /api/courses/admin/:id/students
// @access  Private/Admin
router.get('/admin/:id/students', protect, admin, async (req, res) => {
  try {
    const courseId = req.params.id;
    
    // Fetch the course to know total videos
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }
    
    const totalVideos = course.videos ? course.videos.length : 0;

    // Find all orders for this course
    const orders = await Order.find({ course: courseId, status: 'completed' })
      .populate('student', 'name email');

    // Calculate progress and structure data
    let studentsProgress = orders.map(order => {
      const completedCount = order.completedVideos ? order.completedVideos.length : 0;
      let progressPercentage = 0;
      
      if (totalVideos > 0) {
        progressPercentage = Math.round((completedCount / totalVideos) * 100);
      } else if (totalVideos === 0 && completedCount === 0) {
        progressPercentage = 0; 
      }

      if (progressPercentage > 100) progressPercentage = 100;

      return {
        _id: order.student._id,
        name: order.student.name,
        email: order.student.email,
        progressPercentage: progressPercentage,
        completedVideosCount: completedCount,
        totalVideos: totalVideos,
        enrolledAt: order.createdAt
      };
    });

    studentsProgress.sort((a, b) => b.progressPercentage - a.progressPercentage);

    res.json(studentsProgress);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get overview of active/inactive students across courses
// @route   GET /api/courses/admin/overview/activity
// @access  Private/Admin
router.get('/admin/overview/activity', protect, admin, async (req, res) => {
  try {
    const courses = await Course.find({}, 'title thumbnail category courseType videos');
    
    const overviewData = await Promise.all(courses.map(async (course) => {
      const orders = await Order.find({ course: course._id, status: 'completed' }).populate('student', 'name email');
      
      const activeStudents = [];
      const inactiveStudents = [];
      
      // Calculate 24 hours ago
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      
      orders.forEach(order => {
        if (order.student) {
          const lastActivityDate = order.lastAccessed || order.updatedAt;
          
          const analytics = (order.videoAnalytics || []).filter(a => new Date(a.timestamp) > oneDayAgo);
          let avgSpeed = 1;
          let totalSkips = 0;
          let performanceScore = 100;
          
          if (analytics.length > 0) {
            const speedSum = analytics.reduce((acc, curr) => acc + (curr.averageSpeed || 1), 0);
            avgSpeed = parseFloat((speedSum / analytics.length).toFixed(2));
            totalSkips = analytics.reduce((acc, curr) => acc + (curr.skipCount || 0), 0);
            
            // Calculate Performance Score
            performanceScore -= (totalSkips * 5); // -5 for each skip
            if (avgSpeed > 1.2) {
              performanceScore -= Math.round((avgSpeed - 1) * 20); // Penalize very high speeds
            }
            if (performanceScore < 0) performanceScore = 0;
            if (performanceScore > 100) performanceScore = 100;
          } else if (order.completedVideos && order.completedVideos.length === 0) {
            performanceScore = 0; // hasn't started watching yet
          }

          const studentData = {
            _id: order.student._id,
            name: order.student.name,
            email: order.student.email,
            lastAccessed: lastActivityDate,
            avgSpeed,
            totalSkips,
            performanceScore,
            completedVideosCount: order.completedVideos ? order.completedVideos.length : 0
          };
          
          if (lastActivityDate && lastActivityDate > oneDayAgo) {
            activeStudents.push(studentData);
          } else {
            inactiveStudents.push(studentData);
          }
        }
      });
      
      return {
        _id: course._id,
        title: course.title,
        thumbnail: course.thumbnail,
        courseType: course.courseType,
        category: course.category,
        totalVideos: course.videos ? course.videos.length : 0,
        activeCount: activeStudents.length,
        inactiveCount: inactiveStudents.length,
        activeStudents,
        inactiveStudents
      };
    }));
    
    res.json(overviewData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get AI performance analysis for a student
// @route   GET /api/courses/admin/:courseId/students/:studentId/performance
// @access  Private/Admin
router.get('/admin/:courseId/students/:studentId/performance', protect, admin, async (req, res) => {
  try {
    const { courseId, studentId } = req.params;
    
    const order = await Order.findOne({ course: courseId, student: studentId })
      .populate('student', 'name email');
      
    if (!order) {
      return res.status(404).json({ message: 'Enrollment not found for this student.' });
    }

    const course = await Course.findById(courseId);
    
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const analytics = (order.videoAnalytics || []).filter(a => new Date(a.timestamp) > oneDayAgo);
    
    // Check if OpenRouter API Key exists
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ message: 'OpenRouter API key is missing in environment variables.' });
    }

    // Construct analytics summary
    const totalVideosWatched = order.completedVideos.length;
    const totalCourseVideos = course.videos ? course.videos.length : 0;
    
    let avgSpeed = 1;
    let totalSkips = 0;
    let didSkip = false;
    let performanceScore = 100;
    
    if (analytics.length > 0) {
      const speedSum = analytics.reduce((acc, curr) => acc + (curr.averageSpeed || 1), 0);
      avgSpeed = parseFloat((speedSum / analytics.length).toFixed(2));
      totalSkips = analytics.reduce((acc, curr) => acc + (curr.skipCount || 0), 0);
      didSkip = analytics.some(a => a.skipped);
      
      performanceScore -= (totalSkips * 5);
      if (avgSpeed > 1.2) {
        performanceScore -= Math.round((avgSpeed - 1) * 20);
      }
      if (performanceScore < 0) performanceScore = 0;
      if (performanceScore > 100) performanceScore = 100;
    } else if (order.completedVideos && order.completedVideos.length === 0) {
      performanceScore = 0;
    }
    
    const prompt = `You are an expert AI learning analyst. Analyze the following student's learning behavior for a course.
Student Name: ${order.student.name}
Course: ${course.title}
Performance Score: ${performanceScore}/100
Progress: ${totalVideosWatched} out of ${totalCourseVideos} videos completed.
Average Playback Speed: ${avgSpeed}x
Did they skip parts of videos? ${didSkip ? 'Yes' : 'No'}
Total Skip/Seek Actions: ${totalSkips}

Provide a constructive, professional performance report analyzing their engagement and giving recommendations. 
IMPORTANT: You MUST return ONLY a raw JSON object. Do not wrap in markdown blocks. Use exactly this structure:
{
  "engagementLevel": "High", // "High", "Medium", or "Low"
  "strengths": ["string", "string"],
  "weaknesses": ["string", "string"],
  "summary": "1-2 paragraphs of formatted HTML text summarizing their performance."
}`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openai/gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const aiData = await response.json();
    
    if (!response.ok) {
      throw new Error(aiData.error?.message || 'Failed to fetch AI response');
    }

    let aiResponseText = aiData.choices[0].message.content;
    const jsonMatch = aiResponseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      aiResponseText = jsonMatch[0];
    }
    
    let reportJson;
    try {
      reportJson = JSON.parse(aiResponseText);
      reportJson.score = performanceScore;
      reportJson.avgSpeed = avgSpeed;
      reportJson.totalSkips = totalSkips;
    } catch (e) {
      reportJson = {
        score: performanceScore,
        avgSpeed: avgSpeed,
        totalSkips: totalSkips,
        engagementLevel: "Unknown",
        strengths: [],
        weaknesses: [],
        summary: aiResponseText
      };
    }

    res.json({ report: reportJson });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get all pending certificate requests
// @route   GET /api/courses/admin/certificate-requests
// @access  Private/Admin
router.get('/admin/certificate-requests', protect, admin, async (req, res) => {
  try {
    const { default: CertificateRequest } = await import('../models/CertificateRequest.js');
    const requests = await CertificateRequest.find({ status: 'pending' })
      .populate('student', 'name email')
      .populate('course', 'title category')
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Approve a certificate request
// @route   POST /api/courses/admin/certificate-requests/:requestId/approve
// @access  Private/Admin
router.post('/admin/certificate-requests/:requestId/approve', protect, admin, async (req, res) => {
  try {
    const { default: CertificateRequest } = await import('../models/CertificateRequest.js');
    const request = await CertificateRequest.findById(req.params.requestId).populate('student').populate('course');
    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (request.status !== 'pending') return res.status(400).json({ message: 'Request is not pending' });

    // Mark as approved
    request.status = 'approved';
    await request.save();

    // Get Graphic Template
    const Setting = (await import('../models/Setting.js')).default;
    const templateSetting = await Setting.findOne({ key: 'certificateGraphicTemplate' });
    const bgImage = templateSetting && templateSetting.value ? `http://localhost:5000${templateSetting.value}` : '';

    // Generate HTML overlay certificate
    // Generate HTML overlay certificate
    const certificateHtml = bgImage ? `
      <div style="position: relative; width: 1000px; max-width: 100%; margin: 0 auto; overflow: hidden; font-family: 'Inter', sans-serif; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
        <img src="${bgImage}" style="display: block; width: 1000px; max-width: 100%; height: auto; z-index: 0;" />
        
        <div style="position: absolute; inset: 0; z-index: 10; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; color: #1e293b; padding-top: 10%;">
          
          <h2 style="font-size: 54px; font-weight: 800; margin-bottom: 2%; padding-bottom: 10px; font-family: 'Georgia', serif; text-transform: uppercase;">
            ${request.student.name}
          </h2>
          
          <h3 style="font-size: 28px; font-weight: 600; margin-bottom: 4%; margin-top: 2%; max-width: 800px; text-transform: uppercase; color: #334155;">
            ${request.course.category || 'Specialized Program'}
          </h3>
          
          <div style="display: flex; gap: 60px; align-items: center; margin-top: 5%;">
            <div style="text-align: center;">
              <p style="font-size: 14px; opacity: 0.7; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 1px;">Performance Score</p>
              <p style="font-size: 32px; font-weight: 800; color: #0f172a;">${request.score}%</p>
            </div>
            <div style="text-align: center;">
              <p style="font-size: 14px; opacity: 0.7; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 1px;">Date Issued</p>
              <p style="font-size: 24px; font-weight: 700; color: #0f172a;">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
          </div>
        </div>
      </div>
    ` : `
      <div style="position: relative; width: 1000px; height: 707px; margin: 0 auto; overflow: hidden; background-color: #f8fafc; border-radius: 12px; font-family: 'Inter', sans-serif; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
        <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(135deg, #1e293b, #0f172a); z-index: 0;"></div>
        
        <div style="position: absolute; inset: 0; z-index: 10; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px; text-align: center; color: #ffffff;">
          <h1 style="font-size: 56px; font-weight: 800; margin-bottom: 20px; letter-spacing: -1px; color: #38bdf8;">CERTIFICATE</h1>
          <p style="font-size: 24px; font-weight: 500; margin-bottom: 40px; opacity: 0.8;">OF COMPLETION</p>
          
          <p style="font-size: 18px; margin-bottom: 15px;">This is to proudly present that</p>
          <h2 style="font-size: 48px; font-weight: 700; margin-bottom: 30px; border-bottom: 2px solid #334155; padding-bottom: 10px; min-width: 500px; display: inline-block;">
            ${request.student.name}
          </h2>
          
          <p style="font-size: 18px; margin-bottom: 10px;">has successfully completed the course</p>
          <h3 style="font-size: 32px; font-weight: 600; margin-bottom: 40px;">${request.course.title}</h3>
          
          <div style="display: flex; gap: 40px; align-items: center; margin-top: 20px;">
            <div style="text-align: center;">
              <p style="font-size: 14px; opacity: 0.7; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 1px;">Performance Score</p>
              <p style="font-size: 28px; font-weight: 800; color: #34d399;">${request.score}%</p>
            </div>
            <div style="width: 2px; height: 50px; background-color: #334155;"></div>
            <div style="text-align: center;">
              <p style="font-size: 14px; opacity: 0.7; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 1px;">Date Issued</p>
              <p style="font-size: 20px; font-weight: 600;">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
          </div>
        </div>
      </div>
    `;

    // Save to Order
    const order = await Order.findOne({ student: request.student._id, course: request.course._id, status: 'completed' });
    if (order) {
      order.certificate = certificateHtml;
      await order.save();
    }

    res.json({ message: 'Certificate generated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Generate AI Mock Test
// @route   POST /api/courses/admin/generate-mock-test
// @access  Private/Admin
router.post('/admin/generate-mock-test', protect, admin, async (req, res) => {
  try {
    const { topic, numQuestions } = req.body;
    
    if (!topic || !numQuestions) {
      return res.status(400).json({ message: 'Topic and number of questions are required' });
    }

    const prompt = `You are an expert educator. Create a multiple-choice mock test about "${topic}" with exactly ${numQuestions} questions.
Return ONLY a valid JSON object matching this structure without any markdown formatting or code blocks:
{
  "title": "Mock Test: ${topic}",
  "questions": [
    {
      "questionText": "Question text here",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswerIndex": 0,
      "explanation": "Brief explanation of why the answer is correct"
    }
  ]
}
Ensure there are exactly ${numQuestions} questions. Make the questions challenging but fair.`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        max_tokens: 2000,
        messages: [
          { role: 'user', content: prompt }
        ]
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error?.message || 'Failed to fetch AI response');
    }

    let aiResponseText = data.choices?.[0]?.message?.content || '';
    
    // Extract JSON if wrapped in markdown
    const jsonMatch = aiResponseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      aiResponseText = jsonMatch[0];
    }
    
    const mockTestData = JSON.parse(aiResponseText);
    res.json(mockTestData);
  } catch (error) {
    console.error('Mock Test Generation Error:', error);
    res.status(500).json({ message: 'Failed to generate mock test. Please try again.' });
  }
});

// @desc    Add Mock Test to Course
// @route   POST /api/courses/admin/:id/mock-test
// @access  Private/Admin
router.post('/admin/:id/mock-test', protect, admin, async (req, res) => {
  try {
    const { title, timeLimit, questions } = req.body;
    
    if (!title || !timeLimit || !questions || questions.length === 0) {
      return res.status(400).json({ message: 'Title, time limit, and questions are required' });
    }

    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    course.mockTests.push({ title, timeLimit, questions });
    await course.save();

    res.status(201).json({ message: 'Mock test added successfully', course });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Submit Mock Test Result
// @route   POST /api/courses/:id/mock-test/:mockTestId/submit
// @access  Private
router.post('/:id/mock-test/:mockTestId/submit', protect, async (req, res) => {
  try {
    const { score, totalQuestions, timeTaken } = req.body;
    const { id: courseId, mockTestId } = req.params;

    const order = await Order.findOne({ student: req.user._id, course: courseId, status: 'completed' });
    if (!order) {
      return res.status(403).json({ message: 'You must be enrolled to submit mock test results' });
    }

    // Check if result already exists and update, or add new
    const existingResultIndex = order.mockTestResults?.findIndex(r => r.mockTestId.toString() === mockTestId);
    
    if (existingResultIndex !== undefined && existingResultIndex !== -1) {
      // Keep highest score
      if (score > order.mockTestResults[existingResultIndex].score) {
        order.mockTestResults[existingResultIndex] = {
          mockTestId,
          score,
          totalQuestions,
          timeTaken,
          completedAt: new Date()
        };
      }
    } else {
      if (!order.mockTestResults) order.mockTestResults = [];
      order.mockTestResults.push({
        mockTestId,
        score,
        totalQuestions,
        timeTaken,
        completedAt: new Date()
      });
    }

    await order.save();
    res.json({ message: 'Mock test result saved successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
