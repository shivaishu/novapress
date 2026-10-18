import { Router } from 'express';
import User from '../models/User.js';
import Subscriber from '../models/Subscriber.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = Router();
router.use(protect, adminOnly);
router.get('/users', async (_req, res, next) => {
  try { res.json({ users: await User.find().select('name email role createdAt').sort({ createdAt: -1 }).limit(200).lean() }); }
  catch (error) { next(error); }
});
router.get('/subscribers', async (_req, res, next) => {
  try { res.json({ subscribers: await Subscriber.find({ active: true }).select('email createdAt').sort({ createdAt: -1 }).limit(500).lean() }); }
  catch (error) { next(error); }
});
router.patch('/users/:id/role', async (req, res, next) => {
  try {
    if (!['reader', 'editor', 'admin'].includes(req.body.role)) return res.status(400).json({ message: 'Choose reader, editor, or admin.' });
    if (String(req.user._id) === req.params.id && req.body.role !== 'admin') return res.status(400).json({ message: 'You cannot remove your own admin access.' });
    const user = await User.findByIdAndUpdate(req.params.id, { role: req.body.role }, { new: true }).select('name email role');
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json({ user });
  } catch (error) { next(error); }
});
export default router;
