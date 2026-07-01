import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './config/db.js';
import authRoutes from './routes/auth.js';
import courseRoutes from './routes/courses.js';
import paymentRoutes from './routes/payment.js';
import uploadRoutes from './routes/upload.js';
import settingsRoutes from './routes/settings.js';
import doubtRoutes from './routes/doubts.js';
import internshipRoutes from './routes/internship.js';

// Load env variables
dotenv.config();

// Connect to MongoDB
connectDB();

import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const __dirname = path.resolve();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const roomUsers = {};
const grantedUsers = {};

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  socket.on('join-room', (roomId, userDetails) => {
    if (!roomUsers[roomId]) {
      roomUsers[roomId] = [];
    }
    if (!grantedUsers[roomId]) {
      grantedUsers[roomId] = new Set();
    }

    if (userDetails.role !== 'admin') {
      const isAdminInRoom = roomUsers[roomId].some(u => u.role === 'admin');
      if (!isAdminInRoom) {
        socket.emit('force-disconnect', 'Admin has not started the class yet. Please wait.');
        return;
      }
    }

    const userWithSocket = { ...userDetails, socketId: socket.id, roomId };
    roomUsers[roomId].push(userWithSocket);

    socket.join(roomId);

    // Send the list of existing users to the new user
    const usersInRoom = roomUsers[roomId].filter(u => u.socketId !== socket.id);
    socket.emit('all-users', usersInRoom);
    socket.emit('media-status-changed', Array.from(grantedUsers[roomId]));
  });

  socket.on('sending-signal', payload => {
    io.to(payload.userToSignal).emit('user-joined', { signal: payload.signal, callerID: payload.callerID, user: payload.user });
  });

  socket.on('returning-signal', payload => {
    io.to(payload.callerID).emit('receiving-returned-signal', { signal: payload.signal, id: socket.id });
  });

  socket.on('grant-media', (targetSocketId, userId, roomId) => {
    io.to(targetSocketId).emit('grant-media', userId, roomId);
  });

  socket.on('media-accepted', (userId, roomId) => {
    if (roomId && userId) {
      if (!grantedUsers[roomId]) grantedUsers[roomId] = new Set();
      grantedUsers[roomId].add(userId);
      io.to(roomId).emit('media-status-changed', Array.from(grantedUsers[roomId]));
    }
  });

  socket.on('revoke-media', (targetSocketId, userId, roomId) => {
    if (roomId && userId && grantedUsers[roomId]) {
      grantedUsers[roomId].delete(userId);
      io.to(roomId).emit('media-status-changed', Array.from(grantedUsers[roomId]));
    }
    io.to(targetSocketId).emit('revoke-media');
  });

  socket.on('chat-message', (roomId, messageData) => {
    io.to(roomId).emit('chat-message', messageData);
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
    // Remove user from roomUsers
    for (const roomId in roomUsers) {
      roomUsers[roomId] = roomUsers[roomId].filter(u => u.socketId !== socket.id);
      if (roomUsers[roomId].length === 0) {
        delete roomUsers[roomId];
      }
    }
    socket.broadcast.emit('user-disconnected', socket.id);
  });
});

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/doubts', doubtRoutes);
app.use('/api/internship', internshipRoutes);

app.use('/uploads', express.static(path.join(__dirname, '/uploads')));

// Basic test route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Backend server is running smoothly' });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
