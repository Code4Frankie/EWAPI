import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

// Loads the user on every request so deactivation/role changes apply immediately.
const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new ApiError(401, 'Authentication required');

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
  } catch {
    throw new ApiError(401, 'Invalid or expired token');
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) throw new ApiError(401, 'Account unavailable');
  req.user = user;
  next();
});

const authorize = (...roles) => (req, _res, next) =>
  roles.includes(req.user.role) ? next() : next(new ApiError(403, 'Insufficient permissions'));

export { authenticate, authorize };
