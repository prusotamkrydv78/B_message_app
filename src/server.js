import dotenv from 'dotenv';
import http from 'http';
import { app } from './app.js';
import { connectDB } from './db/connect.js';
import { config } from './config/index.js';
import cors from 'cors';
import { Server as IOServer } from 'socket.io';
import { setIO } from './socket.js';
import { verifyAccessToken } from './utils/tokens.js';
import { Message } from './models/Message.js';
import { Conversation } from './models/Conversation.js';
import { Group } from './models/Group.js';
import { GroupMessage } from './models/GroupMessage.js';

dotenv.config();

const PORT =   process.env.PORT || 4000;
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

// Expose io to controllers
setIO(io);

const userRoom = (userId) => `user:${userId}`;
// Track currently connected users
const connectedUsers = new Set();

// Track active calls: { callerId: { target, status, startTime, type } }
const activeCalls = new Map();
// Track active video calls: { callerId: { target, status, startTime, type } }
const activeVideoCalls = new Map();

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
  //console.log(`[socket] user ${userId} connected`);

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
      // find conversation between userId and to
      let convo = conversationId
        ? await Conversation.findById(conversationId)
        : await Conversation.findOne({ participants: { $all: [userId, to] } });
      if (!convo) {
        return socket.emit('error_message', { message: 'Conversation not found', clientId: clientId || null });
      }
      if (convo.status !== 'accepted') {
        return socket.emit('error_message', { message: 'Connection request not accepted yet', clientId: clientId || null });
      }
      const msg = await Message.create({
        conversation: convo._id,
        sender: userId,
        recipient: to,
        text,
      });

    // --- Groups: join/leave room ---
    socket.on('join_group', async ({ groupId }) => {
      try {
        const g = await Group.findById(groupId).select('members').lean();
        if (!g) return;
        const isMember = (g.members || []).some(m => String(m.user) === String(userId));
        if (!isMember) return;
        socket.join(`group:${groupId}`);
      } catch {}
    });

    socket.on('leave_group', ({ groupId }) => {
      try { socket.leave(`group:${groupId}`); } catch {}
    });

    // --- Groups: send message ---
    socket.on('send_group_message', async ({ groupId, text, clientId }) => {
      try {
        if (!groupId || !text) return;
        const g = await Group.findById(groupId);
        if (!g) return;
        const isMember = (g.members || []).some(m => String(m.user) === String(userId));
        if (!isMember) return;
        const msg = await GroupMessage.create({ group: groupId, sender: userId, text: String(text).trim() });
        g.lastMessage = { text: msg.text, sender: msg.sender, at: msg.createdAt };
        await g.save();
        io.to(`group:${groupId}`).emit('receive_group_message', {
          _id: msg._id,
          group: groupId,
          sender: userId,
          text: msg.text,
          createdAt: msg.createdAt,
          clientId: clientId || null,
        });
      } catch (e) {
        try { socket.emit('error_group_message', { message: e?.message || 'Failed to send', clientId }); } catch {}
      }
    });

    // --- Groups: typing indicator ---
    socket.on('group_typing', async ({ groupId, isTyping }) => {
      try {
        const g = await Group.findById(groupId).select('members').lean();
        if (!g) return;
        const isMember = (g.members || []).some(m => String(m.user) === String(userId));
        if (!isMember) return;
        socket.to(`group:${groupId}`).emit('group_typing', { groupId, userId, isTyping: !!isTyping });
      } catch {}
    });

    // --- Groups: mark seen ---
    socket.on('group_mark_seen', async ({ groupId, ids = [] }) => {
      try {
        const g = await Group.findById(groupId).select('members').lean();
        if (!g) return;
        const isMember = (g.members || []).some(m => String(m.user) === String(userId));
        if (!isMember) return;
        io.to(`group:${groupId}`).emit('group_messages_seen', { groupId, by: userId, ids });
      } catch {}
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
      socket.emit('error_message', { message: 'Failed to send message', clientId: clientId || null });
    }
  });

  socket.on('disconnect', () => {
    //console.log(`[socket] user ${userId} disconnected`);
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
    // Clean up any active video calls for this user
    for (const [callerId, call] of activeVideoCalls.entries()) {
      if (callerId === userId || call.target === userId) {
        const otherUser = callerId === userId ? call.target : callerId;
        io.to(userRoom(otherUser)).emit('video_call_ended', { from: userId, reason: 'disconnect' });
        activeVideoCalls.delete(callerId);
      }
    }
  });

  // WebRTC Voice Call Signaling
  socket.on('call_user', ({ to, offer }) => {
    //console.log(`[call_user] from=${userId} to=${to}`);
    if (!to) return;
    // Check if caller or target is already in a call or video call
    if (activeCalls.has(userId) || activeVideoCalls.has(userId)) {
      socket.emit('call_error', { message: 'You are already in a call' });
      return;
    }
    for (const [callerId, call] of activeCalls.entries()) {
      if (call.target === to) {
        socket.emit('call_error', { message: 'User is busy' });
        return;
      }
    }
    for (const [callerId, call] of activeVideoCalls.entries()) {
      if (call.target === to) {
        socket.emit('call_error', { message: 'User is busy' });
        return;
      }
    }
    // Track the call
    activeCalls.set(userId, { target: to, status: 'calling', startTime: Date.now(), type: 'voice' });
    // Forward to target user
    io.to(userRoom(to)).emit('incoming_call', { from: userId, offer });
    //console.log(`[incoming_call] delivered to=${to} from=${userId}`);
  });

  socket.on('answer_call', ({ to, answer }) => {
    //console.log(`[answer_call] from=${userId} to=${to}`);
    if (!to || !activeCalls.has(to)) return;
    const call = activeCalls.get(to);
    if (call.target !== userId) return;
    // Update call status
    call.status = 'connected';
    // Forward answer to caller
    io.to(userRoom(to)).emit('call_answered', { from: userId, answer });
    //console.log(`[call_answered] to caller=${to} from callee=${userId}`);
  });

  socket.on('decline_call', ({ to }) => {
    //console.log(`[decline_call] from=${userId} to=${to}`);
    if (!to || !activeCalls.has(to)) return;
    const call = activeCalls.get(to);
    if (call.target !== userId) return;
    // Remove call and notify caller
    activeCalls.delete(to);
    io.to(userRoom(to)).emit('call_declined', { from: userId });
    //console.log(`[call_declined] notified caller=${to}`);
  });

  socket.on('end_call', ({ to }) => {
    //console.log(`[end_call] by=${userId} other=${to}`);
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
      //console.log(`[call_ended] sent to=${to}`);
    }
  });

  socket.on('ice_candidate', ({ to, candidate }) => {
    // Avoid logging entire candidate for brevity
    if (to) //console.log(`[ice_candidate] from=${userId} to=${to}`);
    if (!to) return;
    io.to(userRoom(to)).emit('ice_candidate', { from: userId, candidate });
  });

  // WebRTC Video Call Signaling
  socket.on('video_call_user', ({ to, offer }) => {
    //console.log(`[video_call_user] from=${userId} to=${to}`);
    if (!to) return;
    // Check if caller or target is already in a call or video call
    if (activeCalls.has(userId) || activeVideoCalls.has(userId)) {
      socket.emit('video_call_error', { message: 'You are already in a call' });
      return;
    }
    for (const [callerId, call] of activeCalls.entries()) {
      if (call.target === to) {
        socket.emit('video_call_error', { message: 'User is busy' });
        return;
      }
    }
    for (const [callerId, call] of activeVideoCalls.entries()) {
      if (call.target === to) {
        socket.emit('video_call_error', { message: 'User is busy' });
        return;
      }
    }
    // Track the video call
    activeVideoCalls.set(userId, { target: to, status: 'calling', startTime: Date.now(), type: 'video' });
    // Forward to target user
    io.to(userRoom(to)).emit('incoming_video_call', { from: userId, offer });
    //console.log(`[incoming_video_call] delivered to=${to} from=${userId}`);
  });

  socket.on('answer_video_call', ({ to, answer }) => {
    //console.log(`[answer_video_call] from=${userId} to=${to}`);
    if (!to || !activeVideoCalls.has(to)) return;
    const call = activeVideoCalls.get(to);
    if (call.target !== userId) return;
    // Update call status
    call.status = 'connected';
    // Forward answer to caller
    io.to(userRoom(to)).emit('video_call_answered', { from: userId, answer });
    //console.log(`[video_call_answered] to caller=${to} from callee=${userId}`);
  });

  socket.on('decline_video_call', ({ to }) => {
    //console.log(`[decline_video_call] from=${userId} to=${to}`);
    if (!to || !activeVideoCalls.has(to)) return;
    const call = activeVideoCalls.get(to);
    if (call.target !== userId) return;
    // Remove call and notify caller
    activeVideoCalls.delete(to);
    io.to(userRoom(to)).emit('video_call_declined', { from: userId });
    //console.log(`[video_call_declined] notified caller=${to}`);
  });

  socket.on('end_video_call', ({ to }) => {
    //console.log(`[end_video_call] by=${userId} other=${to}`);
    if (!to) return;
    // Find and remove the video call
    let callFound = false;
    if (activeVideoCalls.has(userId) && activeVideoCalls.get(userId).target === to) {
      activeVideoCalls.delete(userId);
      callFound = true;
    } else {
      for (const [callerId, call] of activeVideoCalls.entries()) {
        if (callerId === to && call.target === userId) {
          activeVideoCalls.delete(callerId);
          callFound = true;
          break;
        }
      }
    }
    if (callFound) {
      io.to(userRoom(to)).emit('video_call_ended', { from: userId });
      //console.log(`[video_call_ended] sent to=${to}`);
    }
  });

  socket.on('video_ice_candidate', ({ to, candidate }) => {
    if (to) //console.log(`[video_ice_candidate] from=${userId} to=${to}`);
    if (!to) return;
    io.to(userRoom(to)).emit('video_ice_candidate', { from: userId, candidate });
  });

  // Video call specific events
  socket.on('toggle_video_mute', ({ to, isMuted }) => {
    if (!to) return;
    io.to(userRoom(to)).emit('video_mute_toggled', { from: userId, isMuted });
  });

  socket.on('toggle_video_camera', ({ to, isCameraOff }) => {
    if (!to) return;
    io.to(userRoom(to)).emit('video_camera_toggled', { from: userId, isCameraOff });
  });
});

server.listen(PORT, () => {
      //console.log(`Server running on http://localhost:${PORT}`);
    });