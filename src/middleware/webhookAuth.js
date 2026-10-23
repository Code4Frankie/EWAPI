const crypto = require('crypto');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

// Accepts the secret in the x-webhook-secret header (preferred) or ?token= for
// providers that can't send custom headers.
module.exports = (req, _res, next) => {
  const given = Buffer.from(String(req.get('x-webhook-secret') || req.query.token || ''));
  const expected = Buffer.from(env.WEBHOOK_SECRET);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    return next(new ApiError(401, 'Invalid webhook credentials'));
  }
  next();
};
