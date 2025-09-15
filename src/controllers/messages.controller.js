import mongoose from 'mongoose';
import createError from 'http-errors';
import { Message } from '../models/Message.js';
import { Conversation } from '../models/Conversation.js';
import { Call } from '../models/Call.js';

function toObjectId(id) {
  return new mongoose.Types.ObjectId(id);
}

export const MessagesController = {
  // GET /api/v1/messages/with/:userId
  async historyWith(req, res, next) {
    try {
      const me = req.user.id;
      const other = req.params.userId;
      if (!other) throw createError(400, 'userId is required');

      // Find conversation between me and other (do not auto-create; creation requires requestedBy)
      const convo = await Conversation.findOne({
        participants: { $all: [toObjectId(me), toObjectId(other)] },
      });

      // If no conversation yet, return empty history
      if (!convo) {
        return res.json({ conversationId: null, messages: [], calls: [], combined: [] });
      }

      const messages = await Message.find({ conversation: convo._id })
        .sort({ createdAt: 1 })
        .limit(500);

      // Get call records for this conversation
      const calls = await Call.find({ conversation: convo._id })
        .sort({ createdAt: 1 })
        .limit(100);

      //console.log('Found calls:', calls); // Debug log

      // Combine messages and calls, sorted by timestamp
      const combined = [
        ...messages.map(m => ({ ...m.toObject(), type: 'message' })),
        ...calls.map(c => ({ ...c.toObject(), type: 'call' }))
      ].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

      res.json({ conversationId: convo._id, messages, calls, combined });
    } catch (err) {
      next(err);
    }
  },
};
