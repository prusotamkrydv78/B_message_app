import createError from 'http-errors';
import mongoose from 'mongoose';
import { Group } from '../models/Group.js';
import { GroupMessage } from '../models/GroupMessage.js';
import { getIO } from '../socket.js';

export const GroupMessagesController = {
  history: async (req, res, next) => {
    try {
      const me = req.user.id;
      const { groupId } = req.params;
      const group = await Group.findById(groupId).lean();
      if (!group) throw createError(404, 'Group not found');
      const isMember = (group.members || []).some(m => String(m.user) === String(me));
      if (!isMember) throw createError(403, 'Not in group');
      const messages = await GroupMessage.find({ group: groupId }).sort({ createdAt: 1 }).lean();
      res.json({ groupId, messages: messages.map(m => ({
        id: m._id,
        group: m.group,
        sender: m.sender,
        text: m.text,
        createdAt: m.createdAt,
      })) });
    } catch (err) { next(err); }
  },

  send: async (req, res, next) => {
    try {
      const me = req.user.id;
      const { groupId } = req.params;
      const { text = '', clientId } = req.body || {};
      if (!text.trim()) throw createError(400, 'text is required');
      const group = await Group.findById(groupId);
      if (!group) throw createError(404, 'Group not found');
      const isMember = (group.members || []).some(m => String(m.user) === String(me));
      if (!isMember) throw createError(403, 'Not in group');

      const msg = await GroupMessage.create({ group: groupId, sender: me, text: text.trim() });
      group.lastMessage = { text: msg.text, sender: msg.sender, at: msg.createdAt };
      await group.save();

      const io = getIO();
      if (io) {
        io.to(`group:${groupId}`).emit('receive_group_message', {
          _id: msg._id,
          group: groupId,
          sender: me,
          text: msg.text,
          createdAt: msg.createdAt,
          clientId: clientId || null,
        });
      }
      res.status(201).json({ id: msg._id, createdAt: msg.createdAt });
    } catch (err) { next(err); }
  },
};
