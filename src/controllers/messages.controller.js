import mongoose from 'mongoose';
import createError from 'http-errors';
import { Message } from '../models/Message.js';
import { Conversation } from '../models/Conversation.js';

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

      // Find or create conversation between me and other
      let convo = await Conversation.findOne({
        participants: { $all: [toObjectId(me), toObjectId(other)] },
      });
      if (!convo) {
        convo = await Conversation.create({ participants: [me, other] });
      }

      const messages = await Message.find({ conversation: convo._id })
        .sort({ createdAt: 1 })
        .limit(500);

      res.json({ conversationId: convo._id, messages });
    } catch (err) {
      next(err);
    }
  },
};
