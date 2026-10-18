import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from './models/User.js';

const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.toLowerCase().trim();
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
if (!email || !password || password.length < 14) throw new Error('Set BOOTSTRAP_ADMIN_EMAIL and a 14+ character BOOTSTRAP_ADMIN_PASSWORD in server/.env.');
await mongoose.connect(process.env.MONGODB_URI);
const admin = await User.findOne({ email });
if (!admin) throw new Error(`No bootstrap account found for ${email}. Run npm run seed first.`);
admin.role = 'admin';
admin.password = await bcrypt.hash(password, 12);
await admin.save();
console.log(`Bootstrap admin password reset for ${email}.`);
await mongoose.disconnect();
