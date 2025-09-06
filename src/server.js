import dotenv from 'dotenv';
import http from 'http';
import { app } from './app.js';
import { connectDB } from './db/connect.js';
import { config } from './config/index.js';
import cors from 'cors';
import { Server as IOServer } from 'socket.io';
import { verifyAccessToken } from './utils/tokens.js';
import { Message } from './models/Message.js';
import { Conversation } from './models/Conversation.js';

dotenv.config();

const PORT =   4000;
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
})); 

connectDB(process.env.MONGODB_URI);
const server = http.createServer(app);

// Socket.IO setup
const io = new IOServer(server, {
  cors: {
    origin: config.cors.origin,
    credentials: true,
  },
});

const userRoom = (userId) => `user:${userId}`;

io.use((socket, next) => {
  try {
    const { token } = socket.handshake.auth || {};
    if (!token) return next(new Error('unauthorized'));
    const payload = verifyAccessToken(token);
    socket.userId = payload.sub;
    next();
  } catch (e) {
    next(new Error('unauthorized'));
  }
});

io.on('connection', (socket) => {
  const userId = socket.userId;
  socket.join(userRoom(userId));
  io.to(userRoom(userId)).emit('presence', { userId, status: 'online' });

  socket.on('typing', ({ to, isTyping }) => {
    if (!to) return;
    io.to(userRoom(to)).emit('typing', { from: userId, isTyping: !!isTyping });
  });

  socket.on('send_message', async ({ to, text, conversationId, clientId }) => {
    try {
      if (!to || !text) return;
      // find or create conversation between userId and to
      let convo = conversationId
        ? await Conversation.findById(conversationId)
        : await Conversation.findOne({ participants: { $all: [userId, to] } });
      if (!convo) {
        convo = await Conversation.create({ participants: [userId, to] });
      }
      const msg = await Message.create({
        conversation: convo._id,
        sender: userId,
        recipient: to,
        text,
      });
      // update lastMessage
      convo.lastMessage = { text, sender: userId, at: msg.createdAt };
      await convo.save();

      const payload = {
        _id: msg._id,
        conversation: convo._id,
        sender: userId,
        recipient: to,
        text,
        createdAt: msg.createdAt,
        clientId: clientId || null,
      };
      // echo to sender and deliver to recipient room
      io.to(userRoom(userId)).emit('receive_message', payload);
      io.to(userRoom(to)).emit('receive_message', payload);
    } catch (e) {
      // optionally emit error back
      socket.emit('error_message', { message: 'Failed to send message' });
    }
  });

  socket.on('disconnect', () => {
    io.to(userRoom(userId)).emit('presence', { userId, status: 'offline' });
  });
});

server.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });