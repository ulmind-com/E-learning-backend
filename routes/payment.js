import express from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import Course from '../models/Course.js';
import Order from '../models/Order.js';
import { protect } from '../middleware/auth.js';
import fs from 'fs';

const router = express.Router();

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_dummy_id',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_secret',
});

// @desc    Direct Enroll (Bypass Payment)
// @route   POST /api/payment/enroll
// @access  Private
router.post('/enroll', protect, async (req, res) => {
  try {
    const { courseId } = req.body;

    if (!courseId) {
      return res.status(400).json({ message: 'Course ID is required' });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Check if student already purchased the course
    const existingPurchase = await Order.findOne({
      student: req.user._id,
      course: courseId,
      status: 'completed',
    });

    if (existingPurchase) {
      return res.status(400).json({ message: 'You have already purchased this course' });
    }

    // Create completed order directly
    const order = await Order.create({
      student: req.user._id,
      course: courseId,
      amount: course.price || 0,
      razorpayOrderId: `direct_enroll_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      razorpayPaymentId: 'N/A',
      razorpaySignature: 'N/A',
      status: 'completed',
    });

    return res.status(201).json({
      success: true,
      message: 'Enrolled successfully!',
      courseTitle: course.title,
    });
  } catch (error) {
    console.error('Enroll error:', error);
    return res.status(500).json({ message: error.message });
  }
});

// @desc    Verify Razorpay Payment Signature
// @route   POST /api/payment/verify
// @access  Private
router.post('/verify', protect, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: 'Missing payment signature verification parameters' });
    }

    // Verify signature
    let isSignatureValid = false;

    if (razorpay_signature.startsWith('demo_sig_') || razorpay_order_id.startsWith('demo_order_')) {
      isSignatureValid = true; // Bypass signature check for demo payments
    } else {
      const body = razorpay_order_id + '|' + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'dummy_secret')
        .update(body.toString())
        .digest('hex');

      isSignatureValid = expectedSignature === razorpay_signature;
    }

    if (isSignatureValid) {
      // Find the pending order and update to completed
      const order = await Order.findOne({ razorpayOrderId: razorpay_order_id });
      if (!order) {
        return res.status(404).json({ message: 'Order reference not found' });
      }

      order.status = 'completed';
      order.razorpayPaymentId = razorpay_payment_id;
      order.razorpaySignature = razorpay_signature;
      await order.save();

      return res.status(200).json({ success: true, message: 'Payment verified successfully', order });
    } else {
      // Find the pending order and update to failed
      const order = await Order.findOne({ razorpayOrderId: razorpay_order_id });
      if (order) {
        order.status = 'failed';
        await order.save();
      }
      return res.status(400).json({ success: false, message: 'Payment verification failed' });
    }
  } catch (error) {
    console.error('Verification error:', error);
    return res.status(500).json({ message: error.message });
  }
});

export default router;
