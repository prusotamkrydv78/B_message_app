import createError from 'http-errors';
import { verifyAccessToken } from '../utils/tokens.js';

export function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [, token] = header.split(' ');
    if (!token) throw createError(401, 'Missing bearer token');
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub };
    next();
  } catch (err) {
    next(createError(401, 'Invalid or expired token'));
  }
}
