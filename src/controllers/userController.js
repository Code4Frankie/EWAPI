import { z } from 'zod';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import audit from '../utils/audit.js';
import { normalizePhone } from '../utils/phone.js';
import { ROLES, LGAS } from '../config/constants.js';

const phoneField = z
  .string()
  .transform((v, ctx) => {
    const p = normalizePhone(v);
    if (!p) ctx.addIssue({ code: 'custom', message: 'Invalid Nigerian phone number' });
    return p;
  })
  .optional();

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().email(),
  phone: phoneField,
  password: z.string().min(10).max(128),
  role: z.enum(ROLES).default('observer'),
  assignedLgas: z.array(z.enum(LGAS)).default([]),
});

const updateSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    phone: phoneField,
    role: z.enum(ROLES),
    assignedLgas: z.array(z.enum(LGAS)),
    isActive: z.boolean(),
    password: z.string().min(10).max(128),
  })
  .partial();

const listSchema = z.object({
  role: z.enum(ROLES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

const create = asyncHandler(async (req, res) => {
  const { password, ...rest } = req.body;
  const user = await User.create({ ...rest, passwordHash: await User.hashPassword(password) });
  audit(req, 'user.create', 'User', user.id, { role: user.role });
  res.status(201).json({ success: true, data: user });
});

const list = asyncHandler(async (req, res) => {
  const { role, page, limit } = req.query;
  const filter = role ? { role } : {};
  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter),
  ]);
  res.json({ success: true, data: items, meta: { page, limit, total } });
});

const update = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  if (user.id === req.user.id && (req.body.isActive === false || (req.body.role && req.body.role !== user.role))) {
    throw new ApiError(400, 'You cannot deactivate or change the role of your own account');
  }

  const { password, ...rest } = req.body;
  Object.assign(user, rest);
  if (password) {
    user.passwordHash = await User.hashPassword(password);
    user.refreshTokenHash = undefined; // force re-login
  }
  if (rest.isActive === false) user.refreshTokenHash = undefined;
  await user.save();

  audit(req, 'user.update', 'User', user.id, { fields: Object.keys(req.body).filter((k) => k !== 'password'), passwordReset: Boolean(password) });
  res.json({ success: true, data: user });
});

export { create, list, update, createSchema, updateSchema, listSchema };
