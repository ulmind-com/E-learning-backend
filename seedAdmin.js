import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

const updateAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    const email = 'ghoshtirtha1234@gmail.com';
    const password = '12345';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    let admin = await User.findOne({ email });
    if (admin) {
      admin.password = hashedPassword;
      admin.role = 'admin';
      await admin.save();
      console.log('Admin password updated');
    } else {
      admin = await User.create({
        name: 'Admin',
        email,
        password: hashedPassword,
        role: 'admin'
      });
      console.log('Admin user created');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

updateAdmin();
