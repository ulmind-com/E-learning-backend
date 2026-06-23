import mongoose from 'mongoose';

const internshipTaskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    details: {
      type: String,
      required: true,
    },
    referalLink: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const InternshipTask = mongoose.model('InternshipTask', internshipTaskSchema);
export default InternshipTask;
