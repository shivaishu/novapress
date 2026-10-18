import { Router } from 'express';
import Subscriber from '../models/Subscriber.js';
import { sendEmail } from '../services/email.js';

const router = Router();
router.post('/subscribe', async (req, res, next) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.status(400).json({ message: 'Enter a valid email address.' });
    const subscriber = await Subscriber.findOneAndUpdate({ email }, { $set: { active: true }, $setOnInsert: { email } }, { new: true, upsert: true, runValidators: true });
    void sendEmail({ to: subscriber.email, subject: 'You’re on the Nova Press list', text: 'Thanks for subscribing to the Nova Brief. Look out for our next edition.' });
    res.status(201).json({ message: 'Thanks for subscribing. Look out for the next edition.' });
  } catch (error) { next(error); }
});
export default router;
