import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export async function protect(req, res, next) {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ message: 'Please sign in to continue.' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(payload.id);
    if (!req.user) return res.status(401).json({ message: 'This account is no longer available.' });
    next();
  } catch { res.status(401).json({ message: 'Your session expired. Please sign in again.' }); }
}

export function editorOnly(req, res, next) {
  if (!['editor', 'admin'].includes(req.user?.role)) return res.status(403).json({ message: 'Editor access is required.' });
  next();
}

export function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' });
  next();
}
