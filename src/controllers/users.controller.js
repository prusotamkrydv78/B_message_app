import { User } from '../models/User.js';

export const UsersController = {
  list: async (req, res, next) => {
    try {
      const q = (req.query.q || '').trim();
      const me = req.user.id;
      const filter = q
        ? {
            $and: [
              { _id: { $ne: me } },
              {
                $or: [
                  { name: { $regex: q, $options: 'i' } },
                  { phoneNumber: { $regex: q, $options: 'i' } },
                ],
              },
            ],
          }
        : { _id: { $ne: me } };

      const users = await User.find(filter)
        .select('name phoneNumber countryCode')
        .sort({ createdAt: -1 })
        .limit(50);

      res.json({ users });
    } catch (err) {
      next(err);
    }
  },

  validatePhone: async (req, res, next) => {
    try {
      const { countryCode, phoneNumber } = req.query;
      
      if (!phoneNumber) {
        return res.status(400).json({ error: 'Phone number is required' });
      }

      const normalizedPhone = String(phoneNumber).replace(/\s+/g, '');
      
      // Check if user exists with this phone number
      const user = await User.findOne({ phoneNumber: normalizedPhone })
        .select('name phoneNumber countryCode');

      if (user) {
        res.json({ 
          isRegistered: true, 
          user: {
            name: user.name,
            phoneNumber: user.phoneNumber,
            countryCode: user.countryCode
          }
        });
      } else {
        res.json({ 
          isRegistered: false,
          message: 'This phone number is not registered on ChatX'
        });
      }
    } catch (err) {
      next(err);
    }
  },
};
