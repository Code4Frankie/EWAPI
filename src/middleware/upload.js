import multer from 'multer';
import ApiError from '../utils/ApiError.js';

const ALLOWED = new Set([
  'image/jpeg', 'image/png', 'image/webp',
  'video/mp4', 'video/quicktime',
  'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 }, // 10MB each, 5 per report
  fileFilter: (_req, file, cb) =>
    ALLOWED.has(file.mimetype)
      ? cb(null, true)
      : cb(new ApiError(415, `Unsupported file type: ${file.mimetype}`)),
});

export default upload.array('media', 5);
