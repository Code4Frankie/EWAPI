const express = require('express');
const rateLimit = require('express-rate-limit');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const upload = require('../middleware/upload');
const webhookAuth = require('../middleware/webhookAuth');
const auth = require('../controllers/authController');
const users = require('../controllers/userController');
const reports = require('../controllers/reportController');
const comms = require('../controllers/commsController');
const stats = require('../controllers/statsController');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Too many attempts, try again later' },
});
const uploadLimiter = rateLimit({ windowMs: 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });
const webhookLimiter = rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false });

router.get('/health', (_req, res) => res.json({ success: true, data: { status: 'ok', time: new Date() } }));

// Auth
router.post('/auth/login', authLimiter, validate({ body: auth.loginSchema }), auth.login);
router.post('/auth/refresh', authLimiter, validate({ body: auth.refreshSchema }), auth.refresh);
router.post('/auth/logout', authenticate, auth.logout);
router.get('/auth/me', authenticate, auth.me);

// Users (admin)
router.post('/users', authenticate, authorize('admin'), validate({ body: users.createSchema }), users.create);
router.get('/users', authenticate, authorize('admin'), validate({ query: users.listSchema }), users.list);
router.patch('/users/:id', authenticate, authorize('admin'), validate({ body: users.updateSchema }), users.update);

// Reports
router.post(
  '/reports', authenticate, authorize('observer', 'moderator', 'admin'), uploadLimiter,
  upload, validate({ body: reports.createSchema }), reports.create
);
router.get('/reports', authenticate, validate({ query: reports.listSchema }), reports.list);
router.get('/reports/:id', authenticate, reports.getOne);
router.patch('/reports/:id/status', authenticate, authorize('moderator', 'admin'), validate({ body: reports.statusSchema }), reports.updateStatus);
router.patch('/reports/:id/assign', authenticate, authorize('moderator', 'admin'), validate({ body: reports.assignSchema }), reports.assign);
router.post('/reports/:id/notes', authenticate, authorize('moderator', 'admin'), validate({ body: reports.noteSchema }), reports.addNote);

// Stats
router.get('/stats/summary', authenticate, authorize('moderator', 'admin'), stats.summary);

// Provider webhooks (shared-secret protected)
router.post('/webhooks/sms', webhookLimiter, webhookAuth, comms.smsInbound);
router.post('/webhooks/voice', webhookLimiter, webhookAuth, comms.voiceInbound);

module.exports = router;
