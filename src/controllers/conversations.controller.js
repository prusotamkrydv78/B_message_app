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
          isRequestedByMe: String(c.requestedBy) === String(me),
          isPending: c.status === 'pending',
          otherUser: other ? {
            id: other._id,
            name: other.name,
            phoneNumber: other.phoneNumber,
            countryCode: other.countryCode,
          } : null,
          lastMessage: c.lastMessage || null,
          updatedAt: c.updatedAt,
          acceptedAt: c.acceptedAt || null,
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

      // Prevent users from sending requests to themselves
      if (String(me) === String(userId)) {
        throw createError(400, 'Cannot send request to yourself');
      }

      const other = await User.findById(userId);
      if (!other) throw createError(404, 'User not found');

      let convo = await Conversation.findOne({
        participants: { $all: [me, userId], $size: 2 },
      });
      
      if (convo) {
        // If conversation already exists, return its current status
        if (convo.status === 'accepted') {
          return res.json({ 
            id: convo.id, 
            status: convo.status, 
            requestedBy: convo.requestedBy,
            message: 'Conversation already exists and is active'
          });
        } else if (convo.status === 'pending') {
          return res.json({ 
            id: convo.id, 
            status: convo.status, 
            requestedBy: convo.requestedBy,
            message: String(convo.requestedBy) === String(me) 
              ? 'You have already sent a request to this user'
              : 'This user has sent you a request. You can accept it.'
          });
        }
      } else {
        // Create new conversation request
        convo = await Conversation.create({ 
          participants: [me, userId], 
          status: 'pending', 
          requestedBy: me 
        });
      }
      
      res.status(201).json({ 
        id: convo.id, 
        status: convo.status, 
        requestedBy: convo.requestedBy,
        message: 'Connection request sent successfully'
      });
    } catch (err) {
      next(err);
    }
  },
  accept: async (req, res, next) => {
    try {
      const me = req.user.id;
      const { id } = req.params;
      const convo = await Conversation.findById(id).populate({
        path: 'participants',
        select: 'name phoneNumber countryCode'
      });
      
      if (!convo) throw createError(404, 'Conversation not found');
      
      const isParticipant = (convo.participants || []).some((p) => String(p._id) === String(me));
      if (!isParticipant) throw createError(403, 'Not allowed to accept this conversation');
      
      if (convo.status === 'accepted') {
        return res.json({ 
          id: convo.id, 
          status: 'accepted',
          message: 'Conversation is already accepted'
        });
      }
      
      if (String(convo.requestedBy) === String(me)) {
        throw createError(400, 'You cannot accept your own request');
      }
      
      // Accept the conversation
      convo.status = 'accepted';
      convo.acceptedAt = new Date();
      await convo.save();
      
      // Get the requester info for response
      const requester = convo.participants.find(p => String(p._id) === String(convo.requestedBy));
      
      res.json({ 
        id: convo.id, 
        status: convo.status,
        acceptedAt: convo.acceptedAt,
        requester: requester ? {
          id: requester._id,
          name: requester.name,
          phoneNumber: requester.phoneNumber,
          countryCode: requester.countryCode
        } : null,
        message: 'Connection request accepted successfully'
      });
    } catch (err) {
      next(err);
    }
  },

  delete: async (req, res, next) => {
    try {
      const me = req.user.id;
      const { id } = req.params;
      const convo = await Conversation.findById(id);
      if (!convo) throw createError(404, 'Conversation not found');
      const isParticipant = (convo.participants || []).some((p) => String(p) === String(me));
      if (!isParticipant) throw createError(403, 'Not allowed');
      
      await Conversation.findByIdAndDelete(id);
      res.json({ success: true, message: 'Conversation deleted' });
    } catch (err) {
      next(err);
    }
  }
};
