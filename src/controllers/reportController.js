import { z } from 'zod';
import Report from '../models/Report.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import audit from '../utils/audit.js';
import { uploadMany, deleteMany } from '../services/media.js';
import { resolveLocation, createReport } from '../services/reportService.js';
import { safeSendSms } from '../services/sms.js';
import {
  LGAS, CATEGORIES, SEVERITIES, STATUSES, CHANNELS, TRANSITIONS, REOPEN_TO,
} from '../config/constants.js';

// Multipart fields arrive as strings; '' should mean "not provided".
const optNum = (min, max) =>
  z.preprocess((v) => (v === '' || v == null ? undefined : v), z.coerce.number().min(min).max(max).optional());
const optStr = (max) =>
  z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().max(max).optional());

const createSchema = z.object({
  category: z.enum(CATEGORIES),
  severity: z.enum(SEVERITIES).default('medium'),
  description: z.string().trim().min(10).max(2000),
  lga: z.enum(LGAS),
  ward: optStr(100),
  pollingUnitCode: optStr(40),
  latitude: optNum(-90, 90),
  longitude: optNum(-180, 180),
  occurredAt: z.preprocess((v) => (v === '' ? undefined : v), z.coerce.date().optional()),
});

const listSchema = z.object({
  status: z.enum(STATUSES).optional(),
  category: z.enum(CATEGORIES).optional(),
  severity: z.enum(SEVERITIES).optional(),
  channel: z.enum(CHANNELS).optional(),
  lga: z.enum(LGAS).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

const statusSchema = z.object({
  status: z.enum(STATUSES),
  note: z.string().trim().max(1000).optional(),
});
const assignSchema = z.object({ assignedTo: z.string().regex(/^[a-f\d]{24}$/i).nullable() });
const noteSchema = z.object({ note: z.string().trim().min(1).max(1000) });

// Who can see what: observers -> own reports; moderators -> their LGAs (or all if none set); admins -> all.
function scopeFilter(user) {
  if (user.role === 'observer') return { reporter: user._id };
  if (user.role === 'moderator' && user.assignedLgas?.length) {
    return { 'location.lga': { $in: user.assignedLgas } };
  }
  return {};
}

async function findAccessible(req) {
  const report = await Report.findOne({ _id: req.params.id, ...scopeFilter(req.user) });
  if (!report) throw new ApiError(404, 'Report not found');
  return report;
}

const create = asyncHandler(async (req, res) => {
  const b = req.body;
  const location = await resolveLocation({
    lga: b.lga,
    ward: b.ward,
    pollingUnitCode: b.pollingUnitCode,
    ...(b.latitude != null && b.longitude != null && {
      geo: { type: 'Point', coordinates: [b.longitude, b.latitude] },
    }),
  });

  const media = await uploadMany(req.files);
  try {
    const report = await createReport({
      channel: 'web',
      category: b.category,
      severity: b.severity,
      description: b.description,
      location,
      occurredAt: b.occurredAt,
      reporter: req.user._id,
      reporterPhone: req.user.phone,
      reporterVerified: true,
      media,
    });
    audit(req, 'report.create', 'Report', report.id, { refCode: report.refCode });
    res.status(201).json({ success: true, data: report });
  } catch (e) {
    await deleteMany(media); // don't leave orphaned uploads behind
    throw e;
  }
});

const list = asyncHandler(async (req, res) => {
  const { status, category, severity, channel, lga, from, to, q, page, limit } = req.query;
  const filter = { ...scopeFilter(req.user) };
  if (status) filter.status = status;
  if (category) filter.category = category;
  if (severity) filter.severity = severity;
  if (channel) filter.channel = channel;
  if (lga) {
    // keep any scope restriction: intersect rather than overwrite
    const scoped = filter['location.lga']?.$in;
    if (scoped && !scoped.includes(lga)) return res.json({ success: true, data: [], meta: { page, limit, total: 0 } });
    filter['location.lga'] = lga;
  }
  if (from || to) filter.createdAt = { ...(from && { $gte: from }), ...(to && { $lte: to }) };
  if (q) filter.$text = { $search: q };

  const [items, total] = await Promise.all([
    Report.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('reporter', 'name phone')
      .populate('assignedTo', 'name'),
    Report.countDocuments(filter),
  ]);
  res.json({ success: true, data: items, meta: { page, limit, total } });
});

const getOne = asyncHandler(async (req, res) => {
  const report = await findAccessible(req);
  await report.populate([
    { path: 'reporter', select: 'name phone email' },
    { path: 'assignedTo', select: 'name' },
    { path: 'history.by', select: 'name role' },
  ]);
  res.json({ success: true, data: report });
});

const updateStatus = asyncHandler(async (req, res) => {
  const report = await findAccessible(req);
  const { status: to, note } = req.body;
  const from = report.status;

  const normal = TRANSITIONS[from].includes(to);
  const reopen = req.user.role === 'admin' && ['rejected', 'resolved'].includes(from) && to === REOPEN_TO;
  if (!normal && !reopen) {
    throw new ApiError(400, `Cannot move a report from "${from}" to "${to}"`);
  }
  if ((to === 'rejected' || to === 'escalated') && !note) {
    throw new ApiError(400, `A note is required when marking a report "${to}"`);
  }

  report.status = to;
  report.history.push({ from, to, by: req.user._id, note });
  await report.save();
  audit(req, 'report.status', 'Report', report.id, { from, to });

  // One short SMS back to unregistered/SMS reporters on final outcomes only.
  if (report.channel === 'sms' && report.reporterPhone && ['verified', 'rejected', 'resolved'].includes(to)) {
    safeSendSms(report.reporterPhone, `Voter Witness ${report.refCode}: your report is now ${to.replace('_', ' ')}.`);
  }
  res.json({ success: true, data: report });
});

const assign = asyncHandler(async (req, res) => {
  const report = await findAccessible(req);
  report.assignedTo = req.body.assignedTo;
  await report.save();
  audit(req, 'report.assign', 'Report', report.id, { assignedTo: req.body.assignedTo });
  res.json({ success: true, data: report });
});

const addNote = asyncHandler(async (req, res) => {
  const report = await findAccessible(req);
  report.history.push({ from: report.status, to: report.status, by: req.user._id, note: req.body.note });
  await report.save();
  res.status(201).json({ success: true, data: report });
});

export {
  create, list, getOne, updateStatus, assign, addNote,
  createSchema, listSchema, statusSchema, assignSchema, noteSchema,
};
