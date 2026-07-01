import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    rating: { type: Number, required: true },
    comment: { type: String, required: true },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

const chapterSchema = new mongoose.Schema({
  title: { type: String, required: true },
  videos: [
    {
      title: { type: String, required: true },
      videoUrl: { type: String, required: true },
      duration: { type: String, default: '' },
    }
  ],
  notes: [
    {
      title: { type: String, required: true },
      fileUrl: { type: String, required: true },
    }
  ],
  mockTests: [
    {
      title: { type: String, required: true },
      timeLimit: { type: Number, required: true },
      questions: [
        {
          questionText: { type: String, required: true },
          options: [{ type: String, required: true }],
          correctAnswerIndex: { type: Number, required: true },
          explanation: { type: String, default: '' }
        }
      ]
    }
  ],
  liveClasses: [
    {
      title: { type: String, required: true },
      date: { type: Date, required: true },
      status: { type: String, enum: ['scheduled', 'live', 'ended'], default: 'scheduled' }
    }
  ]
});

const courseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Course title is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Course description is required'],
    },
    courseType: {
      type: String,
      enum: ['free', 'paid'],
      default: 'paid',
    },
    price: {
      type: Number,
      required: [true, 'Course price is required'],
      min: [0, 'Price cannot be negative'],
      default: 0,
    },
    discountPercentage: {
      type: Number,
      min: [0, 'Discount percentage cannot be negative'],
      max: [100, 'Discount percentage cannot exceed 100'],
      default: 0,
    },
    category: {
      type: String,
      default: 'General',
      trim: true,
    },
    level: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'beginner',
    },
    duration: {
      type: String,
      default: '',
    },
    thumbnail: {
      type: String,
      default: '',
    },
    videos: [
      {
        title: { type: String, required: true },
        videoUrl: { type: String, required: true },
        duration: { type: String, default: '' },
      }
    ],
    mockTests: [
      {
        title: { type: String, required: true },
        timeLimit: { type: Number, required: true }, // in minutes
        questions: [
          {
            questionText: { type: String, required: true },
            options: [{ type: String, required: true }],
            correctAnswerIndex: { type: Number, required: true },
            explanation: { type: String, default: '' }
          }
        ]
      }
    ],
    chapters: [chapterSchema],
    instructor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reviews: [reviewSchema],
    rating: {
      type: Number,
      required: true,
      default: 0,
    },
    numReviews: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const Course = mongoose.model('Course', courseSchema);
export default Course;
