import createError from 'http-errors';
import { User } from '../models/User.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/tokens.js';
import { config } from '../config/index.js';

function calcRefreshExpiryDate() {
  // Convert refreshExpiresIn (e.g., '30d') to a Date
  const match = /^(\d+)([smhd])$/.exec(config.jwt.refreshExpiresIn);
  const now = new Date();
  if (!match) return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
  return new Date(now.getTime() + value * multipliers[unit]);
}

export const AuthController = {
  register: async (req, res, next) => {
    try {
      const { name, phoneNumber, countryCode = '+1', password } = req.body;
      const existing = await User.findOne({ phoneNumber });
      if (existing) throw createError(409, 'Phone number already registered');

      const passwordHash = await User.hashPassword(password);
      const user = await User.create({ name, phoneNumber, countryCode, passwordHash });
      const accessToken = signAccessToken({ sub: user.id });
      const refreshToken = signRefreshToken({ sub: user.id });
      const expiresAt = calcRefreshExpiryDate();
      user.refreshTokens.push({ token: refreshToken, expiresAt });
      await user.save();

      // Set refresh token as httpOnly cookie
      const isProd = process.env.NODE_ENV === 'production';
      const cookieDomain = process.env.COOKIE_DOMAIN; // e.g., ".example.com"
      const cookieOpts = {
        httpOnly: true,
        secure: isProd,              // required for SameSite=None on modern browsers
        sameSite: isProd ? 'none' : 'lax',
        expires: expiresAt,
      };
      if (cookieDomain) cookieOpts.domain = cookieDomain;
      res.cookie('refreshToken', refreshToken, cookieOpts);

      res.status(201).json({
        user: { id: user.id, name: user.name, phoneNumber: user.phoneNumber, countryCode: user.countryCode },
        accessToken,
      });
    } catch (err) {
      next(err);
    }
  },

  login: async (req, res, next) => {
    try {
      const { phoneNumber, password } = req.body;
      const user = await User.findOne({ phoneNumber });
      if (!user) throw createError(401, 'Invalid credentials');

      const match = await user.comparePassword(password);
      if (!match) throw createError(401, 'Invalid credentials');

      const accessToken = signAccessToken({ sub: user.id });
      const refreshToken = signRefreshToken({ sub: user.id });
      const expiresAt = calcRefreshExpiryDate();

      // Keep only last 5 refresh tokens (simple rotation policy)
      user.refreshTokens = [...user.refreshTokens.filter(rt => rt.expiresAt > new Date()), { token: refreshToken, expiresAt }].slice(-5);
      await user.save();

      // Set refresh token as httpOnly cookie
      const isProd = process.env.NODE_ENV === 'production';
      const cookieDomain = process.env.COOKIE_DOMAIN; // e.g., ".example.com"
      const cookieOpts = {
        httpOnly: true,
        secure: isProd,              // required for SameSite=None on modern browsers
        sameSite: isProd ? 'none' : 'lax',
        expires: expiresAt,
      };
      if (cookieDomain) cookieOpts.domain = cookieDomain;
      res.cookie('refreshToken', refreshToken, cookieOpts);

      res.json({
        user: { id: user.id, name: user.name, phoneNumber: user.phoneNumber, countryCode: user.countryCode },
        accessToken,
      });
    } catch (err) {
      next(err);
    }
  },

  refresh: async (req, res, next) => {
    try {
      const bodyToken = req.body?.refreshToken;
      const cookieToken = req.cookies?.refreshToken;
      const token = bodyToken || cookieToken;
      if (!token) throw createError(401, 'Missing refresh token');

      const payload = verifyRefreshToken(token);
      const user = await User.findById(payload.sub);
      if (!user) throw createError(401, 'User not found');

      const known = user.refreshTokens.find(rt => rt.token === token && rt.expiresAt > new Date());
      if (!known) throw createError(401, 'Refresh token invalid or expired');

      const newAccessToken = signAccessToken({ sub: user.id });
      const newRefreshToken = signRefreshToken({ sub: user.id });
      const expiresAt = calcRefreshExpiryDate();

      // rotate: remove old, add new
      user.refreshTokens = user.refreshTokens.filter(rt => rt.token !== token);
      user.refreshTokens.push({ token: newRefreshToken, expiresAt });
      await user.save();

      const isProd = process.env.NODE_ENV === 'production';
      const cookieDomain = process.env.COOKIE_DOMAIN; // e.g., ".example.com"
      const cookieOpts = {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        expires: expiresAt,
      };
      if (cookieDomain) cookieOpts.domain = cookieDomain;
      res.cookie('refreshToken', newRefreshToken, cookieOpts);

      res.json({ accessToken: newAccessToken });
    } catch (err) {
      next(err);
    }
  },

  logout: async (req, res, next) => {
    try {
      const token = req.body?.refreshToken || req.cookies?.refreshToken;
      const isProd = process.env.NODE_ENV === 'production';
      const cookieDomain = process.env.COOKIE_DOMAIN; // e.g., ".example.com"
      const clearOpts = { httpOnly: true, sameSite: isProd ? 'none' : 'lax', secure: isProd };
      if (cookieDomain) clearOpts.domain = cookieDomain;
      if (!token) {
        res.clearCookie('refreshToken', clearOpts);
        return res.json({ message: 'Logged out' });
      }
      try {
        const payload = verifyRefreshToken(token);
        const user = await User.findById(payload.sub);
        if (user) {
          user.refreshTokens = user.refreshTokens.filter(rt => rt.token !== token);
          await user.save();
        }
      } catch (_) {}
      res.clearCookie('refreshToken', clearOpts);
      res.json({ message: 'Logged out' });
    } catch (err) {
      next(err);
    }
  },

  me: async (req, res, next) => {
    try {
      const user = await User.findById(req.user.id).select('name phoneNumber countryCode');
      if (!user) throw createError(404, 'User not found');
      res.json({ user: { id: user.id, name: user.name, phoneNumber: user.phoneNumber, countryCode: user.countryCode } });
    } catch (err) {
      next(err);
    }
  },
};
