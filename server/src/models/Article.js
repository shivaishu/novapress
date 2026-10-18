import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  body: { type: String, required: true, trim: true, maxlength: 1000 }
}, { timestamps: true });

const articleSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 150 },
  excerpt: { type: String, required: true, trim: true, maxlength: 300 },
  body: { type: String, required: true },
  category: { type: String, required: true, trim: true },
  image: { type: String, default: '' },
  imagePublicId: { type: String, default: '' },
  source: { type: String, default: '' },
  sourceUrl: { type: String, default: '' },
  providerId: { type: String, sparse: true, unique: true },
  publishedAt: { type: Date, default: null },
  summary: { type: String, default: '', maxlength: 1200 },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  readMinutes: { type: Number, default: 4 },
  reactions: [{ user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, value: { type: String, enum: ['like', 'dislike'] } }],
  comments: [commentSchema],
  published: { type: Boolean, default: true },
  featured: { type: Boolean, default: false }
}, { timestamps: true });

articleSchema.index({ title: 'text', excerpt: 'text', body: 'text' });
export default mongoose.model('Article', articleSchema);
