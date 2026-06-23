import mongoose from 'mongoose';

const assignedTaskSchema = new mongoose.Schema({
  task: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InternshipTask',
    required: true,
  },
  status: {
    type: String,
    enum: ['Pending', 'Submitted', 'Verified'],
    default: 'Pending',
  },
  submission: {
    gitRepo: { type: String, trim: true },
    liveLink: { type: String, trim: true },
    documentUrl: { type: String, trim: true },
  },
  submittedAt: {
    type: Date,
  },
  verifiedAt: {
    type: Date,
  }
});

const internshipApplicationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    resume: {
      name: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, required: true },
      college: { type: String, required: true },
      degree: { type: String, required: true },
      skills: { type: String, required: true },
      linkedin: { type: String },
      github: { type: String },
      portfolio: { type: String },
    },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected', 'Completed'],
      default: 'Pending',
    },
    assignedTasks: [assignedTaskSchema],
    certificateIssued: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const InternshipApplication = mongoose.model('InternshipApplication', internshipApplicationSchema);
export default InternshipApplication;
