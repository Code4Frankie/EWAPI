const { ZodError } = require('zod');
const multer = require('multer');
const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');

const notFound = (req, _res, next) => next(new ApiError(404, `Not found: ${req.method} ${req.originalUrl}`));

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, _req, res, _next) => {
  let status = err.status || 500;
  let message = err.message || 'Server error';
  let details;

  if (err instanceof ZodError) {
    status = 400;
    message = 'Validation failed';
    details = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
  } else if (err instanceof multer.MulterError) {
    status = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 10MB)' : err.message;
  } else if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    message = 'Validation failed';
    details = Object.values(err.errors).map((e) => ({ path: e.path, message: e.message }));
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    message = `Invalid ${err.path}`;
  } else if (err.code === 11000) {
    status = 409;
    message = 'Duplicate value';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Malformed JSON';
  }

  if (status >= 500) {
    console.error(err);
    message = 'Internal server error'; // don't leak internals
  }

  res.status(status).json({ success: false, message, ...(details && { details }) });
};

module.exports = { notFound, errorHandler };
