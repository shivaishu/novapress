import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import session from 'express-session';
import { rateLimit } from 'express-rate-limit';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from './models/User.js';
import authRoutes from './routes/auth.js';
import articleRoutes from './routes/articles.js';
import categoryRoutes from './routes/categories.js';
import mediaRoutes from './routes/media.js';
import aiRoutes from './routes/ai.js';
import notificationRoutes from './routes/notifications.js';
import adminRoutes from './routes/admin.js';
import newsletterRoutes from './routes/newsletter.js';
import passport from './services/passport.js';

for (const key of ['MONGODB_URI', 'JWT_SECRET']) if (!process.env[key]) throw new Error(`${key} is required. Copy server/.env.example to server/.env and configure it.`);
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: process.env.CLIENT_URL || 'http://localhost:5173' } });
app.set('io', io);
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));
app.use(session({ secret: process.env.JWT_SECRET, resave: false, saveUninitialized: false, cookie: { sameSite: 'lax', secure: process.env.NODE_ENV === 'production', httpOnly: true, maxAge: 10 * 60 * 1000 } }));
app.use(passport.initialize());
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 100 }), authRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/ai', rateLimit({ windowMs: 60 * 60 * 1000, limit: 20 }), aiRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/newsletter', rateLimit({ windowMs: 60 * 60 * 1000, limit: 12 }), newsletterRoutes);
app.get('/api/health', (_req, res) => res.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected', service: 'Nova Press API' }));
app.use((_req, res) => res.status(404).json({ message: 'Route not found.' }));
app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.name === 'MulterError') return res.status(400).json({ message: err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 8 MB or smaller.' : err.message });
  if (err.name === 'CastError') return res.status(400).json({ message: 'Invalid resource id.' });
  if (err.code === 11000) return res.status(409).json({ message: 'That value is already in use.' });
  if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
  res.status(500).json({ message: 'Something went wrong. Please try again.' });
});
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (token) {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(payload.id).select('_id');
      if (!user) return next(new Error('Unauthorized'));
      socket.data.userId = String(user._id);
    }
    next();
  } catch { next(new Error('Unauthorized')); }
});
io.on('connection', (socket) => {
  if (socket.data.userId) socket.join(`user:${socket.data.userId}`);
  socket.on('join:article', (id) => { if (/^[a-f\d]{24}$/i.test(String(id))) socket.join(`article:${id}`); });
  socket.on('leave:article', (id) => socket.leave(`article:${id}`));
});

await mongoose.connect(process.env.MONGODB_URI);
const port = process.env.PORT || 5000;
httpServer.listen(port, () => console.log(`Nova Press API listening on http://localhost:${port}`));
