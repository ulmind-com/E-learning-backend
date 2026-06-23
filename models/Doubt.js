import mongoose from 'mongoose';

const doubtSchema = new mongoose.Schema({
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
  videoUrl: {
    type: String,
    required: true,
  },
  questionText: {
    type: String,
    required: true,
  },
  questionMedia: {
    type: String,
    default: null,
  },
  status: {
    type: String,
    enum: ['pending', 'solved'],
    default: 'pending',
  },
  adminReplyText: {
    type: String,
    default: null,
  },
  adminReplyMedia: {
    type: String,
    default: null,
  },
  solvedAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

const Doubt = mongoose.model('Doubt', doubtSchema);
export default Doubt;
