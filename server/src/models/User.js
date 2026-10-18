import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 60 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, minlength: 8, select: false },
  googleId: { type: String, sparse: true, unique: true, select: false },
  profileImage: { type: String, default: '' },
  role: { type: String, enum: ['reader', 'editor', 'admin'], default: 'reader' }
}, { timestamps: true });

userSchema.path('password').required(function passwordRequired() { return !this.googleId; });

export default mongoose.model('User', userSchema);
