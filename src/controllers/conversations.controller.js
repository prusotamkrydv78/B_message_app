import createError from 'http-errors';
import mongoose from 'mongoose';
import { Conversation } from '../models/Conversation.js';
import { User } from '../models/User.js';

export const ConversationsController = {
  listRecent: async (req, res, next) => {
    try {
      const me = new mongoose.Types.ObjectId(req.user.id);
      const convos = await Conversation.find({ participants: me })
        .sort({ updatedAt: -1 })
        .limit(50)
        .populate({
          path: 'participants',
          select: 'name phoneNumber countryCode',
        })
        .lean();

      const result = convos.map((c) => {
        const others = (c.participants || []).filter((p) => String(p._id) !== String(me));
        const other = others[0] || null;
        return {
          id: c._id,
          otherUser: other ? {
            id: other._id,
            name: other.name,
            phoneNumber: other.phoneNumber,
            countryCode: other.countryCode,
          } : null,
          lastMessage: c.lastMessage || null,
          updatedAt: c.updatedAt,
        };
      });

      res.json({ conversations: result });
    } catch (err) {
      next(err);
    }
  },

  // Optional: create or get 1:1 conversation
  start: async (req, res, next) => {
    try {
      const me = req.user.id;
      const { userId } = req.body;
      if (!userId) throw createError(400, 'userId is required');

      const other = await User.findById(userId);
      if (!other) throw createError(404, 'User not found');

      let convo = await Conversation.findOne({
        participants: { $all: [me, userId], $size: 2 },
      });
      if (!convo) {
        convo = await Conversation.create({ participants: [me, userId] });
      }
      res.status(201).json({ id: convo.id });
    } catch (err) {
      next(err);
    }
  },
};
