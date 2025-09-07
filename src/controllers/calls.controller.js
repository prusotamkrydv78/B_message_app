import mongoose from 'mongoose';
import createError from 'http-errors';
import { Call } from '../models/Call.js';
import { Conversation } from '../models/Conversation.js';

function toObjectId(id) {
  return new mongoose.Types.ObjectId(id);
}

export const CallsController = {
  // POST /api/v1/calls/test - Create a test call record
  async createTestCall(req, res, next) {
    try {
      const { recipient } = req.body;
      const caller = req.user.id;

      // Find or create conversation between caller and recipient
      let conversation = await Conversation.findOne({
        participants: { $all: [toObjectId(caller), toObjectId(recipient)] },
      });

      if (!conversation) {
        conversation = await Conversation.create({ 
          participants: [caller, recipient],
          status: 'accepted'
        });
      }

      const call = await Call.create({
        conversation: conversation._id,
        caller,
        recipient,
        type: 'voice',
        status: 'ended',
        duration: 120,
        startedAt: new Date(Date.now() - 120000),
        endedAt: new Date(),
      });

      res.status(201).json({ call, message: 'Test call created' });
    } catch (err) {
      next(err);
    }
  },

  // POST /api/v1/calls - Create a call record
  async createCall(req, res, next) {
    try {
      const { recipient, type, status, duration, startedAt, endedAt } = req.body;
      const caller = req.user.id;

      if (!recipient || !type || !status) {
        throw createError(400, 'recipient, type, and status are required');
      }

      // Find or create conversation between caller and recipient
      let conversation = await Conversation.findOne({
        participants: { $all: [toObjectId(caller), toObjectId(recipient)] },
      });

      if (!conversation) {
        conversation = await Conversation.create({ 
          participants: [caller, recipient],
          status: 'accepted' // Auto-accept for call records
        });
      }

      const call = await Call.create({
        conversation: conversation._id,
        caller,
        recipient,
        type,
        status,
        duration: duration || 0,
        startedAt: startedAt ? new Date(startedAt) : new Date(),
        endedAt: endedAt ? new Date(endedAt) : null,
      });

      res.status(201).json({ call });
    } catch (err) {
      next(err);
    }
  },

  // GET /api/v1/calls/with/:userId - Get call history with a specific user
  async callHistoryWith(req, res, next) {
    try {
      const me = req.user.id;
      const other = req.params.userId;
      
      if (!other) throw createError(400, 'userId is required');

      // Find conversation between me and other
      const conversation = await Conversation.findOne({
        participants: { $all: [toObjectId(me), toObjectId(other)] },
      });

      if (!conversation) {
        return res.json({ calls: [] });
      }

      const calls = await Call.find({ conversation: conversation._id })
        .sort({ createdAt: -1 })
        .limit(100)
        .populate('caller', 'name')
        .populate('recipient', 'name');

      res.json({ calls });
    } catch (err) {
      next(err);
    }
  },
};
