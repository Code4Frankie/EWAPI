import Report from '../models/Report.js';
import PollingUnit from '../models/PollingUnit.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { normalizePhone } from '../utils/phone.js';
import { createReport } from '../services/reportService.js';
import { safeSendSms } from '../services/sms.js';
import { SMS_CATEGORY_CODES, CATEGORIES } from '../config/constants.js';

const HELP =
  'ElectWatch: send EW <PU CODE> <TYPE> <message>. TYPE: VIOLENCE VOTEBUY BALLOT THREAT LATE RESULT SUPPRESS BVAS LOGISTICS OTHER';

const SMS_PATTERN = /^EW\s+(\S+)\s+(\S+)\s+([\s\S]{5,})$/i;

// Providers differ on field names, so accept the common ones.
const pick = (body, ...keys) => keys.map((k) => body[k]).find((v) => v != null && v !== '');

async function findReporter(phone) {
  const user = await User.findOne({ phone, isActive: true });
  return user || null;
}

const smsInbound = asyncHandler(async (req, res) => {
  const from = normalizePhone(pick(req.body, 'from', 'sender', 'msisdn'));
  const text = String(pick(req.body, 'text', 'message', 'body') || '').trim();
  const messageId = pick(req.body, 'id', 'messageId', 'message_id');
  if (!from || !text) throw new ApiError(400, 'from and text are required');

  // Webhook retries must not create duplicate reports.
  if (messageId) {
    const dup = await Report.findOne({ channel: 'sms', externalId: String(messageId) }).select('refCode');
    if (dup) return res.json({ success: true, data: { accepted: true, duplicate: true, refCode: dup.refCode } });
  }

  const m = text.match(SMS_PATTERN);
  const category = m && SMS_CATEGORY_CODES[m[2].toUpperCase()];
  if (!m || !category) {
    await safeSendSms(from, HELP);
    return res.json({ success: true, data: { accepted: false, reason: 'unparseable' } });
  }

  const pu = await PollingUnit.findOne({ code: m[1].toUpperCase() }).lean();
  if (!pu) {
    await safeSendSms(from, `ElectWatch: unknown polling unit code ${m[1].toUpperCase().slice(0, 20)}. Check and resend.`);
    return res.json({ success: true, data: { accepted: false, reason: 'unknown_polling_unit' } });
  }

  const reporter = await findReporter(from);
  const report = await createReport({
    channel: 'sms',
    externalId: messageId ? String(messageId) : undefined,
    category,
    severity: 'medium', // moderators triage; SMS senders can't self-assign severity
    description: m[3].trim().slice(0, 2000),
    location: { lga: pu.lga, ward: pu.ward, pollingUnitCode: pu.code, pollingUnit: pu._id, geo: pu.geo },
    reporter: reporter?._id,
    reporterPhone: from,
    reporterVerified: Boolean(reporter),
  });

  await safeSendSms(from, `ElectWatch: report received. Ref ${report.refCode}`);
  res.status(201).json({ success: true, data: { accepted: true, refCode: report.refCode } });
});

// Generic voice webhook: your hotline provider posts the call summary here once the call
// (and, if available, recording/transcript) is ready. Adjust field names to the provider chosen.
const voiceInbound = asyncHandler(async (req, res) => {
  const b = req.body;
  const from = normalizePhone(pick(b, 'from', 'caller', 'msisdn'));
  const callId = pick(b, 'callId', 'call_id', 'id');
  if (!from) throw new ApiError(400, 'caller number is required');

  if (callId) {
    const dup = await Report.findOne({ channel: 'voice', externalId: String(callId) }).select('refCode');
    if (dup) return res.json({ success: true, data: { accepted: true, duplicate: true, refCode: dup.refCode } });
  }

  const puCode = pick(b, 'pollingUnitCode', 'puCode');
  const pu = puCode ? await PollingUnit.findOne({ code: String(puCode).toUpperCase() }).lean() : null;
  const category = CATEGORIES.includes(b.category) ? b.category : 'other';
  const transcript = String(pick(b, 'transcript', 'text') || '').trim();
  const recordingUrl = pick(b, 'recordingUrl', 'recording_url');

  // Without a resolvable polling unit we can't place the report; park it for a moderator.
  const reporter = await findReporter(from);
  const report = await createReport({
    channel: 'voice',
    externalId: callId ? String(callId) : undefined,
    category,
    severity: 'medium',
    description: (transcript || 'Voice report received - transcript pending. Moderator to listen to recording.').slice(0, 2000),
    location: pu
      ? { lga: pu.lga, ward: pu.ward, pollingUnitCode: pu.code, pollingUnit: pu._id, geo: pu.geo }
      : { lga: reporter?.assignedLgas?.[0] || 'Lafia', pollingUnitCode: puCode ? String(puCode).toUpperCase() : undefined },
    reporter: reporter?._id,
    reporterPhone: from,
    reporterVerified: Boolean(reporter),
    // Recording is stored as a reference to the provider's URL; we do not fetch it server-side.
    media: recordingUrl && /^https:\/\//.test(String(recordingUrl))
      ? [{ url: String(recordingUrl), resourceType: 'audio', bytes: undefined }]
      : [],
    history: pu ? [] : [{ from: 'new', to: 'new', note: 'Location unresolved from call. Confirm LGA and polling unit.' }],
  });

  res.status(201).json({ success: true, data: { accepted: true, refCode: report.refCode } });
});

export { smsInbound, voiceInbound };
