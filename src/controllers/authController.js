import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import env from '../config/env.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import audit from '../utils/audit.js';

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12); // equalises timing for unknown emails

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const signAccess = (u) =>
  jwt.sign({ sub: u.id, role: u.role }, env.JWT_ACCESS_SECRET, { expiresIn: env.ACCESS_TTL });
const signRefresh = (u) =>
  jwt.sign({ sub: u.id, jti: crypto.randomUUID() }, env.JWT_REFRESH_SECRET, {
    expiresIn: `${env.REFRESH_TTL_DAYS}d`,
  });

async function issueTokens(user) {
  const accessToken = signAccess(user);
  const refreshToken = signRefresh(user);
  await User.updateOne({ _id: user._id }, { refreshTokenHash: sha256(refreshToken) });
  return { accessToken, refreshToken };
}

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1).max(200) });
const refreshSchema = z.object({ refreshToken: z.string().min(10) });

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() }).select(
    '+passwordHash +failedLogins +lockUntil'
  );

  if (user?.lockUntil && user.lockUntil > new Date()) {
    throw new ApiError(423, 'Account temporarily locked. Try again later.');
  }

  const ok = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH);
  if (!user || !ok || !user.isActive) {
    if (user) {
      user.failedLogins += 1;
      if (user.failedLogins >= MAX_FAILED) {
        user.lockUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
        user.failedLogins = 0;
      }
      await user.save();
      audit({ ip: req.ip }, 'auth.login_failed', 'User', user.id);
    }
    throw new ApiError(401, 'Invalid email or password');
  }

  user.failedLogins = 0;
  user.lockUntil = undefined;
  user.lastLoginAt = new Date();
  await user.save();

  const tokens = await issueTokens(user);
  audit({ user, ip: req.ip }, 'auth.login', 'User', user.id);
  res.json({ success: true, data: { user, ...tokens } });
});

const refresh = asyncHandler(async (req, res) => {
  let payload;
  try {
    payload = jwt.verify(req.body.refreshToken, env.JWT_REFRESH_SECRET);
  } catch {
    throw new ApiError(401, 'Invalid refresh token');
  }
  const user = await User.findById(payload.sub).select('+refreshTokenHash');
  if (!user || !user.isActive) throw new ApiError(401, 'Account unavailable');

  if (user.refreshTokenHash !== sha256(req.body.refreshToken)) {
    // Token reuse: revoke the session entirely.
    await User.updateOne({ _id: user._id }, { $unset: { refreshTokenHash: 1 } });
    throw new ApiError(401, 'Refresh token no longer valid');
  }
  const tokens = await issueTokens(user);
  res.json({ success: true, data: tokens });
});

const logout = asyncHandler(async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $unset: { refreshTokenHash: 1 } });
  res.json({ success: true, data: null });
});

const me = (req, res) => res.json({ success: true, data: req.user });

export { login, refresh, logout, me, loginSchema, refreshSchema };
