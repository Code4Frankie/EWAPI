import { cloudinary, configured } from '../config/cloudinary.js';
import ApiError from '../utils/ApiError.js';

function uploadOne(file) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'electwatch/reports', resource_type: 'auto' },
      (err, r) => {
        if (err) return reject(err);
        resolve({
          url: r.secure_url,
          publicId: r.public_id,
          resourceType: r.resource_type,
          format: r.format,
          bytes: r.bytes,
        });
      }
    );
    stream.end(file.buffer);
  });
}

async function uploadMany(files = []) {
  if (!files.length) return [];
  if (!configured) throw new ApiError(503, 'Media storage is not configured');
  return Promise.all(files.map(uploadOne));
}

async function deleteMany(items = []) {
  if (!configured) return;
  await Promise.allSettled(
    items.map((m) => cloudinary.uploader.destroy(m.publicId, { resource_type: m.resourceType }))
  );
}

export { uploadMany, deleteMany };
