import { Router } from 'express';
import Notification from '../models/Notification.js';
import { protect } from '../middleware/auth.js';

const router = Router();
router.use(protect);
router.get('/', async (req, res, next) => {
  try {
    const [notifications, unread] = await Promise.all([
      Notification.find({ recipient: req.user._id }).populate('actor', 'name').populate('article', 'title').sort({ createdAt: -1 }).limit(30),
      Notification.countDocuments({ recipient: req.user._id, readAt: null })
    ]);
    res.json({ notifications, unread });
  } catch (error) { next(error); }
});
router.patch('/read-all', async (req, res, next) => {
  try { await Notification.updateMany({ recipient: req.user._id, readAt: null }, { $set: { readAt: new Date() } }); res.json({ message: 'Notifications marked as read.' }); }
  catch (error) { next(error); }
});
router.patch('/:id/read', async (req, res, next) => {
  try {
    const item = await Notification.findOneAndUpdate({ _id: req.params.id, recipient: req.user._id }, { $set: { readAt: new Date() } }, { new: true });
    if (!item) return res.status(404).json({ message: 'Notification not found.' });
    res.json({ notification: item });
  } catch (error) { next(error); }
});
export default router;
