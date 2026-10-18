import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { sendEmail } from './email.js';

export async function notify(req, { recipient, actor, article, type, message, emailSubject }) {
  if (!recipient || String(recipient) === String(actor?._id || actor)) return null;
  const notification = await Notification.create({ recipient, actor: actor?._id || actor, article, type, message });
  const populated = await notification.populate([{ path: 'actor', select: 'name' }, { path: 'article', select: 'title' }]);
  req.app.get('io')?.to(`user:${recipient}`).emit('notification:new', populated);
  if (emailSubject) {
    void User.findById(recipient).select('email').then((user) => sendEmail({ to: user?.email, subject: emailSubject, text: message })).catch((error) => console.error('Email notification lookup failed:', error.message));
  }
  return populated;
}
