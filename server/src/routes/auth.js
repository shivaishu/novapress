import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';
import passport from '../services/passport.js';

const router = Router();
const publicUser = (user) => ({ id: user._id, name: user.name, email: user.email, role: user.role });
const tokenFor = (user) => jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
const clientUrl = () => (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
const issueSocialCookie = (req, res) => {
  const token = tokenFor(req.user);
  res.cookie('nova_oauth', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 60_000, path: '/api/auth/oauth/session' });
  res.redirect(`${clientUrl()}/signin?oauth=complete`);
};

router.get('/providers', (_req, res) => res.json({ google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) }));
router.get('/google', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return res.status(503).json({ message: 'Google sign in needs Google OAuth credentials in server/.env.' });
  passport.authenticate('google', { scope: ['profile', 'email'], session: false, state: true })(req, res, next);
});
router.get('/google/callback', passport.authenticate('google', { session: false, failureRedirect: `${clientUrl()}/signin?oauthError=Google%20sign%20in%20was%20cancelled` }), issueSocialCookie);
router.get('/oauth/session', async (req, res) => {
  const token = req.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith('nova_oauth='))?.slice('nova_oauth='.length);
  res.clearCookie('nova_oauth', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/api/auth/oauth/session' });
  try {
    const userId = jwt.verify(decodeURIComponent(token || ''), process.env.JWT_SECRET).id;
    const user = await User.findById(userId);
    if (!user) return res.status(401).json({ message: 'Account not found.' });
    res.json({ token: tokenFor(user), user: publicUser(user) });
  } catch { res.status(401).json({ message: 'The social sign-in session expired. Please try again.' }); }
});

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name?.trim() || !email?.trim() || !password) return res.status(400).json({ message: 'Name, email, and password are required.' });
    if (password.length < 8) return res.status(400).json({ message: 'Use a password with at least 8 characters.' });
    if (await User.exists({ email: email.toLowerCase().trim() })) return res.status(409).json({ message: 'An account with that email already exists.' });
    const user = await User.create({ name, email, password: await bcrypt.hash(password, 12) });
    res.status(201).json({ token: tokenFor(user), user: publicUser(user) });
  } catch (error) { next(error); }
});

router.post('/login', async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email?.toLowerCase().trim() }).select('+password');
    if (!user || !await bcrypt.compare(req.body.password || '', user.password)) return res.status(401).json({ message: 'Email or password is incorrect.' });
    res.json({ token: tokenFor(user), user: publicUser(user) });
  } catch (error) { next(error); }
});

router.get('/me', protect, (req, res) => res.json({ user: publicUser(req.user) }));
router.patch('/me', protect, async (req, res, next) => {
  try {
    const name = req.body.name?.trim();
    if (!name || name.length > 60) return res.status(400).json({ message: 'Name must be between 1 and 60 characters.' });
    req.user.name = name;
    await req.user.save();
    res.json({ user: publicUser(req.user) });
  } catch (error) { next(error); }
});
router.patch('/me/password', protect, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 8) return res.status(400).json({ message: 'Provide your current password and a new password with at least 8 characters.' });
    const user = await User.findById(req.user._id).select('+password');
    if (!await bcrypt.compare(currentPassword, user.password)) return res.status(400).json({ message: 'Current password is incorrect.' });
    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();
    res.json({ message: 'Password updated.' });
  } catch (error) { next(error); }
});
export default router;
