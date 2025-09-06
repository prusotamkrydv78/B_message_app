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
};
