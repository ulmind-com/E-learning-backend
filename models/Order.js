import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    razorpayOrderId: {
      type: String,
      required: true,
    },
    razorpayPaymentId: {
      type: String,
    },
    razorpaySignature: {
      type: String,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending',
    },
    completedVideos: {
      type: [String],
      default: [],
    },
    certificate: {
      type: String,
      default: null,
    },
    lastAccessed: {
      type: Date,
      default: null,
    },
    videoAnalytics: [
      {
        videoId: String,
        watchTime: Number,
        averageSpeed: Number,
        skipped: Boolean,
        skipCount: Number,
        timestamp: { type: Date, default: Date.now }
      }
    ],
    mockTestResults: [
      {
        mockTestId: {
          type: mongoose.Schema.Types.ObjectId,
          required: true
        },
        score: { type: Number, required: true },
        totalQuestions: { type: Number, required: true },
        timeTaken: { type: Number }, // in seconds
        completedAt: { type: Date, default: Date.now }
      }
    ],
  },
  {
    timestamps: true,
  }
);

const Order = mongoose.model('Order', orderSchema);
export default Order;
