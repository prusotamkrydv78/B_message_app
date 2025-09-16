import createError from 'http-errors';
import multer from 'multer';
import { uploadBufferToCloudinary } from '../utils/cloudinary.js';

// Multer memory storage to receive files in memory and pipe to Cloudinary
const storage = multer.memoryStorage();
export const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB
    files: 5,
  },
});

function mapCloudinaryResult(file, r) {
  const ext = r.format ? `.${r.format}` : '';
  const filename = file?.originalname || r.original_filename + ext;
  const isImage = r.resource_type === 'image';
  const isVideo = r.resource_type === 'video';
  const type = isImage ? 'image' : (isVideo ? 'video' : 'file');
  return {
    url: r.secure_url || r.url,
    secure_url: r.secure_url || r.url,
    public_id: r.public_id,
    resource_type: r.resource_type,
    format: r.format,
    bytes: r.bytes,
    width: r.width,
    height: r.height,
    original_filename: r.original_filename,
    etag: r.etag,
    type,
    filename,
    mimeType: file?.mimetype || null,
  };
}

export const UploadsController = {
  // POST /api/v1/uploads
  async uploadFiles(req, res, next) {
    try {
      const files = req.files || [];
      if (!files.length) throw createError(400, 'No files provided');
      const results = await Promise.all(files.map(async (f) => {
        const r = await uploadBufferToCloudinary(f.buffer, f.originalname);
        return mapCloudinaryResult(f, r);
      }));
      res.status(201).json({ attachments: results });
    } catch (err) {
      // Surface clearer errors for credential/config problems
      const msg = err?.message || 'Upload failed';
      if (String(msg).toLowerCase().includes('invalid signature') || String(msg).toLowerCase().includes('api key')) {
        return next(createError(401, 'Cloudinary credentials invalid. Check CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.'));
      }
      if (String(msg).toLowerCase().includes('max file size')) {
        return next(createError(413, 'File too large'));
      }
      // default
      next(createError(500, msg));
    }
  },
};
