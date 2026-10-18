import { Router } from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { protect, editorOnly } from '../middleware/auth.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 }, fileFilter: (_req, file, callback) => {
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.mimetype)) return callback(new Error('Choose a JPG, PNG, WebP, or AVIF image.'));
  callback(null, true);
} });

router.post('/image', protect, editorOnly, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Choose an image to upload.' });
    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) return res.status(503).json({ message: 'Image upload is not configured yet. Add Cloudinary credentials to server/.env.' });
    cloudinary.config({ cloud_name: CLOUDINARY_CLOUD_NAME, api_key: CLOUDINARY_API_KEY, api_secret: CLOUDINARY_API_SECRET, secure: true });
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ folder: 'nova-press/articles', resource_type: 'image', transformation: [{ width: 1800, height: 1200, crop: 'limit' }, { quality: 'auto', fetch_format: 'auto' }] }, (error, value) => error ? reject(error) : resolve(value));
      stream.end(req.file.buffer);
    });
    res.status(201).json({ image: result.secure_url, publicId: result.public_id, width: result.width, height: result.height });
  } catch (error) { next(error); }
});

export default router;
