import createError from 'http-errors';
import { Contact } from '../models/Contact.js';
import { User } from '../models/User.js';
import { Conversation } from '../models/Conversation.js';

export const ContactsController = {
  // Create a contact; if phone matches an existing user, link and ensure a conversation exists
  create: async (req, res, next) => {
    try {
      const owner = req.user.id;
      const { name = '', countryCode = '+1', phoneNumber } = req.body;
      if (!phoneNumber) throw createError(400, 'Phone number is required');

      const normalizedPhone = String(phoneNumber).replace(/\s+/g, '');

      // Check if contact exists for this owner & phone
      const existing = await Contact.findOne({ owner, phoneNumber: normalizedPhone });
      if (existing) return res.status(200).json({ contact: existing, message: 'Contact already exists' });

      // See if there is a registered user with this phone
      const linkedUser = await User.findOne({ phoneNumber: normalizedPhone });

      const contact = await Contact.create({ owner, name: String(name).trim(), countryCode, phoneNumber: normalizedPhone, linkedUser: linkedUser ? linkedUser._id : null });

      let conversationId = null;
      if (linkedUser) {
        // Ensure a conversation exists between owner and linked user
        let convo = await Conversation.findOne({ participants: { $all: [owner, linkedUser._id] } });
        if (!convo) {
          convo = await Conversation.create({ participants: [owner, linkedUser._id], status: 'pending', requestedBy: owner });
        }
        conversationId = convo._id;
      }

      res.status(201).json({ contact, conversationId });
    } catch (err) {
      next(err);
    }
  },
};
