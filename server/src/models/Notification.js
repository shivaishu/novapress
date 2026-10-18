import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  article: { type: mongoose.Schema.Types.ObjectId, ref: 'Article' },
  type: { type: String, enum: ['comment', 'reaction', 'published', 'system'], required: true },
  message: { type: String, required: true, maxlength: 220 },
  readAt: { type: Date, default: null }
}, { timestamps: true });

export default mongoose.model('Notification', notificationSchema);
