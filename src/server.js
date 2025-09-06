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
// Track currently connected users
const connectedUsers = new Set();

// Track active calls: { callerId: { target, status, startTime } }
const activeCalls = new Map();

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
  connectedUsers.add(String(userId));
  // Broadcast presence update so any interested client can update UI
  io.emit('presence_update', { userId, status: 'online' });

  socket.on('typing', ({ to, isTyping }) => {
    if (!to) return;
    io.to(userRoom(to)).emit('typing', { from: userId, isTyping: !!isTyping });
  });

  // Presence: allow a client to request current status of a user
  socket.on('presence_request', ({ userId: target }) => {
    if (!target) return;
    const online = connectedUsers.has(String(target));
    socket.emit('presence_update', { userId: target, status: online ? 'online' : 'offline' });
  });

  // Seen receipts for 1:1 chats
  socket.on('mark_seen', ({ otherId, ids = [] }) => {
    if (!otherId) return;
    // Forward to the other user's room
    io.to(userRoom(otherId)).emit('messages_seen', { by: userId, ids });
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
    connectedUsers.delete(String(userId));
    io.emit('presence_update', { userId, status: 'offline' });
    // Clean up any active calls for this user
    for (const [callerId, call] of activeCalls.entries()) {
      if (callerId === userId || call.target === userId) {
        const otherUser = callerId === userId ? call.target : callerId;
        io.to(userRoom(otherUser)).emit('call_ended', { from: userId, reason: 'disconnect' });
        activeCalls.delete(callerId);
      }
    }
  });

  // WebRTC Voice Call Signaling
  socket.on('call_user', ({ to, offer }) => {
    if (!to) return;
    // Check if caller or target is already in a call
    if (activeCalls.has(userId)) {
      socket.emit('call_error', { message: 'You are already in a call' });
      return;
    }
    for (const [callerId, call] of activeCalls.entries()) {
      if (call.target === to) {
        socket.emit('call_error', { message: 'User is busy' });
        return;
      }
    }
    // Track the call
    activeCalls.set(userId, { target: to, status: 'calling', startTime: Date.now() });
    // Forward to target user
    io.to(userRoom(to)).emit('incoming_call', { from: userId, offer });
  });

  socket.on('answer_call', ({ to, answer }) => {
    if (!to || !activeCalls.has(to)) return;
    const call = activeCalls.get(to);
    if (call.target !== userId) return;
    // Update call status
    call.status = 'connected';
    // Forward answer to caller
    io.to(userRoom(to)).emit('call_answered', { from: userId, answer });
  });

  socket.on('decline_call', ({ to }) => {
    if (!to || !activeCalls.has(to)) return;
    const call = activeCalls.get(to);
    if (call.target !== userId) return;
    // Remove call and notify caller
    activeCalls.delete(to);
    io.to(userRoom(to)).emit('call_declined', { from: userId });
  });

  socket.on('end_call', ({ to }) => {
    if (!to) return;
    // Find and remove the call
    let callFound = false;
    if (activeCalls.has(userId) && activeCalls.get(userId).target === to) {
      activeCalls.delete(userId);
      callFound = true;
    } else {
      for (const [callerId, call] of activeCalls.entries()) {
        if (callerId === to && call.target === userId) {
          activeCalls.delete(callerId);
          callFound = true;
          break;
        }
      }
    }
    if (callFound) {
      io.to(userRoom(to)).emit('call_ended', { from: userId });
    }
  });

  socket.on('ice_candidate', ({ to, candidate }) => {
    if (!to) return;
    io.to(userRoom(to)).emit('ice_candidate', { from: userId, candidate });
  });
});

server.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });