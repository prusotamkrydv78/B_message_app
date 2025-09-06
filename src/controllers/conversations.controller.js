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
          status: c.status || 'accepted',
          requestedBy: c.requestedBy || null,
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
        convo = await Conversation.create({ participants: [me, userId], status: 'pending', requestedBy: me });
      }
      res.status(201).json({ id: convo.id, status: convo.status, requestedBy: convo.requestedBy });
    } catch (err) {
      next(err);
    }
  },
  accept: async (req, res, next) => {
    try {
      const me = req.user.id;
      const { id } = req.params;
      const convo = await Conversation.findById(id);
      if (!convo) throw createError(404, 'Conversation not found');
      const isParticipant = (convo.participants || []).some((p) => String(p) === String(me));
      if (!isParticipant) throw createError(403, 'Not allowed');
      if (convo.status === 'accepted') return res.json({ id: convo.id, status: 'accepted' });
      if (String(convo.requestedBy) === String(me)) throw createError(400, 'Requester cannot accept');
      convo.status = 'accepted';
      convo.acceptedAt = new Date();
      await convo.save();
      res.json({ id: convo.id, status: convo.status });
    } catch (err) {
      next(err);
    }
  }
};
