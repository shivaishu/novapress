import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, unique: true, maxlength: 40 },
  slug: { type: String, required: true, trim: true, lowercase: true, unique: true },
  description: { type: String, trim: true, maxlength: 180, default: '' },
  accent: { type: String, trim: true, default: '#7355d9' },
  active: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model('Category', categorySchema);
