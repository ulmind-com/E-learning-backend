import mongoose from 'mongoose';

const internshipSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    duration: {
      type: String,
      required: true,
    },
    internshipType: {
      type: String,
      enum: ['free', 'paid'],
      required: true,
    },
    price: {
      type: Number,
      default: 0,
    },
    maxStudents: {
      type: Number,
      required: true,
    },
    necessaryThings: {
      type: String,
      required: true,
    },
    thumbnail: {
      type: String,
      required: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const Internship = mongoose.model('Internship', internshipSchema);
export default Internship;
