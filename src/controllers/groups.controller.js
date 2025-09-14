import createError from 'http-errors';
import mongoose from 'mongoose';
import { Group } from '../models/Group.js';
import { User } from '../models/User.js';

export const GroupsController = {
  create: async (req, res, next) => {
    try {
      const me = req.user.id;
      const { name, memberIds = [], description = '' } = req.body || {};
      if (!name) throw createError(400, 'name is required');
      const uniqueMembers = Array.from(new Set([me, ...memberIds.map(String)])).map(id => new mongoose.Types.ObjectId(id));
      const members = uniqueMembers.map((uid) => ({ user: uid, role: String(uid) === String(me) ? 'owner' : 'member' }));
      const group = await Group.create({ name, description, owner: me, members });
      res.status(201).json({ id: group.id, name: group.name });
    } catch (err) { next(err); }
  },
  listMine: async (req, res, next) => {
    try {
      const me = new mongoose.Types.ObjectId(req.user.id);
      const groups = await Group.find({ 'members.user': me })
        .sort({ updatedAt: -1 })
        .select('name lastMessage members owner createdAt updatedAt')
        .lean();
      const formatted = groups.map(g => ({
        id: g._id,
        name: g.name,
        lastMessage: g.lastMessage || null,
        memberCount: (g.members || []).length,
        owner: g.owner,
        updatedAt: g.updatedAt,
      }));
      res.json({ groups: formatted });
    } catch (err) { next(err); }
  },
  details: async (req, res, next) => {
    try {
      const me = req.user.id;
      const { id } = req.params;
      const group = await Group.findById(id).populate({ path: 'members.user', select: 'name phoneNumber countryCode' }).lean();
      if (!group) throw createError(404, 'Group not found');
      const isMember = (group.members || []).some(m => String(m.user?._id || m.user) === String(me));
      if (!isMember) throw createError(403, 'Not a member of this group');
      res.json({
        id: group._id,
        name: group.name,
        description: group.description,
        owner: group.owner,
        members: (group.members || []).map(m => ({
          id: m.user._id || m.user,
          name: m.user.name,
          phoneNumber: m.user.phoneNumber,
          countryCode: m.user.countryCode,
          role: m.role,
          joinedAt: m.joinedAt,
        })),
        lastMessage: group.lastMessage || null,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
      });
    } catch (err) { next(err); }
  },
  addMembers: async (req, res, next) => {
    try {
      const me = req.user.id;
      const { id } = req.params;
      const { memberIds = [] } = req.body || {};
      const group = await Group.findById(id);
      if (!group) throw createError(404, 'Group not found');
      const meMember = (group.members || []).find(m => String(m.user) === String(me));
      if (!meMember || (meMember.role !== 'owner' && meMember.role !== 'admin')) throw createError(403, 'Not allowed');
      const existingSet = new Set(group.members.map(m => String(m.user)));
      memberIds.forEach((uid) => {
        const s = String(uid);
        if (!existingSet.has(s)) {
          group.members.push({ user: new mongoose.Types.ObjectId(s), role: 'member' });
        }
      });
      await group.save();
      res.json({ success: true });
    } catch (err) { next(err); }
  },
  removeMember: async (req, res, next) => {
    try {
      const me = req.user.id;
      const { id, userId } = req.params;
      const group = await Group.findById(id);
      if (!group) throw createError(404, 'Group not found');
      const meMember = (group.members || []).find(m => String(m.user) === String(me));
      if (!meMember) throw createError(403, 'Not in group');
      const canRemove = String(me) === String(userId) || meMember.role === 'owner' || meMember.role === 'admin';
      if (!canRemove) throw createError(403, 'Not allowed');
      group.members = (group.members || []).filter(m => String(m.user) !== String(userId));
      await group.save();
      res.json({ success: true });
    } catch (err) { next(err); }
  },
  update: async (req, res, next) => {
    try {
      const me = req.user.id;
      const { id } = req.params;
      const { name, description } = req.body || {};
      const group = await Group.findById(id);
      if (!group) throw createError(404, 'Group not found');
      const meMember = (group.members || []).find(m => String(m.user) === String(me));
      if (!meMember || (meMember.role !== 'owner' && meMember.role !== 'admin')) throw createError(403, 'Not allowed');
      if (typeof name === 'string' && name.trim()) group.name = name.trim();
      if (typeof description === 'string') group.description = description;
      await group.save();
      res.json({ success: true });
    } catch (err) { next(err); }
  },
  delete: async (req, res, next) => {
    try {
      const me = req.user.id;
      const { id } = req.params;
      const group = await Group.findById(id);
      if (!group) throw createError(404, 'Group not found');
      const meMember = (group.members || []).find(m => String(m.user) === String(me));
      if (!meMember || meMember.role !== 'owner') throw createError(403, 'Only owner can delete');
      await Group.findByIdAndDelete(id);
      res.json({ success: true });
    } catch (err) { next(err); }
  },
};
