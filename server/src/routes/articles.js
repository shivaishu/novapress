import { Router } from 'express';
import Article from '../models/Article.js';
import Category from '../models/Category.js';
import { v2 as cloudinary } from 'cloudinary';
import { protect, editorOnly } from '../middleware/auth.js';
import { notify } from '../services/notifications.js';
import User from '../models/User.js';

const router = Router();
const populate = (query) => query.populate('author', 'name').populate('comments.author', 'name');

async function categoryIsActive(name) {
  return Category.exists({ name: name?.trim(), active: true });
}

const newsSectors = [
  ['World', 'world', ''], ['Technology', 'technology', ''], ['Business', 'business', ''],
  ['Culture', 'search', 'culture OR arts'], ['Science', 'science', ''], ['Politics', 'search', 'politics OR election'],
  ['Sports', 'sports', ''], ['Entertainment', 'entertainment', ''], ['Lifestyle', 'search', 'lifestyle OR wellness']
];

async function fetchGnews({ mode, category, query, max, page, apiKey }) {
  const params = new URLSearchParams({ apikey: apiKey, lang: 'en', max: String(max), page: String(page) });
  if (mode === 'search') params.set('q', query);
  else { params.set('category', category); if (query) params.set('q', query); }
  const response = await fetch(`https://gnews.io/api/v4/${mode === 'search' ? 'search' : 'top-headlines'}?${params}`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(body.errors?.[0] || body.message || `GNews returned ${response.status}.`); error.status = response.status; throw error; }
  return body.articles || [];
}

router.post('/sync/news', protect, editorOnly, async (req, res, next) => {
  try {
    const apiKey = process.env.GNEWS_API_KEY;
    if (!apiKey) return res.status(503).json({ message: 'News sync needs GNEWS_API_KEY in server/.env. Add a GNews plan that supports the requested article count, then restart the API.' });
    const target = Math.min(Math.max(Number(req.body.target || process.env.NEWS_SYNC_TARGET || 300), 1), 300);
    const perSector = Math.ceil(target / newsSectors.length);
    const admin = await User.findOne({ role: 'admin' }).sort({ createdAt: 1 });
    if (!admin) return res.status(409).json({ message: 'Create an admin account before syncing news.' });
    let maxPerRequest = Math.min(Math.max(Number(process.env.GNEWS_MAX_PER_REQUEST) || 25, 1), 100);
    const fetched = [];
    for (const [name, category, query] of newsSectors) {
      let sectorItems = [];
      let page = 1;
      while (sectorItems.length < perSector && page <= 10) {
        try {
          const batch = await fetchGnews({ mode: category === 'search' ? 'search' : 'top', category, query, max: maxPerRequest, page, apiKey });
          sectorItems.push(...batch);
          if (batch.length < maxPerRequest) break;
          page += 1;
        } catch (error) {
          if (error.status === 400 && maxPerRequest > 10) { maxPerRequest = 10; continue; }
          throw error;
        }
        if (maxPerRequest <= 10) await new Promise((resolve) => setTimeout(resolve, 1050));
      }
      fetched.push(...sectorItems.slice(0, perSector).map((item) => ({ item, category: name })));
    }
    const unique = new Map();
    for (const entry of fetched) {
      const item = entry.item;
      if (!item.title || !item.url) continue;
      const providerId = item.id || item.url;
      if (!unique.has(providerId)) unique.set(providerId, { ...entry, providerId });
    }
    const operations = [...unique.values()].map(({ item, category, providerId }) => {
      const excerpt = (item.description || item.title).slice(0, 300);
      const description = item.content || item.description || item.title;
      return { updateOne: {
        filter: { providerId }, upsert: true,
        update: { $set: { title: item.title.slice(0, 150), excerpt, body: `${description}\n\nRead the full report at ${item.url}`, category, image: item.image || '', source: item.source?.name || '', sourceUrl: item.url, publishedAt: item.publishedAt ? new Date(item.publishedAt) : new Date(), author: admin._id, published: true, featured: false, readMinutes: 4 }, $setOnInsert: { providerId } }
      } };
    });
    if (operations.length) await Article.bulkWrite(operations, { ordered: false });
    const synced = await Article.countDocuments({ providerId: { $exists: true, $ne: '' } });
    req.app.get('io')?.emit('article:published', { newsSync: true });
    res.json({ requested: target, received: operations.length, totalNewsArticles: synced, message: synced >= target ? `News sync complete: ${synced} sourced stories are available.` : `News sync received ${operations.length} stories; ${synced} sourced stories are available. The provider returned fewer than ${target}.` });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: `GNews sync failed: ${error.message}` });
    next(error);
  }
});

router.get('/manage', protect, editorOnly, async (req, res, next) => {
  try {
    const { q, page = 1, limit = 30 } = req.query;
    const filter = {};
    if (q?.trim()) filter.$text = { $search: q.trim() };
    const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 100);
    const [articles, total] = await Promise.all([
      populate(Article.find(filter).sort({ updatedAt: -1 }).skip((Math.max(Number(page) || 1, 1) - 1) * safeLimit).limit(safeLimit)),
      Article.countDocuments(filter)
    ]);
    res.json({ articles, total });
  } catch (error) { next(error); }
});

router.get('/', async (req, res, next) => {
  try {
    const { category, q, page = 1, limit = 12 } = req.query;
    const filter = { published: true };
    if (category && category !== 'All stories') filter.category = category;
    if (q?.trim()) filter.$text = { $search: q.trim() };
      const [articles, total] = await Promise.all([
      populate(Article.find(filter).sort({ publishedAt: -1, createdAt: -1 }).skip((Number(page) - 1) * Number(limit)).limit(Math.min(Number(limit), 30))),
      Article.countDocuments(filter)
    ]);
    res.json({ articles, page: Number(page), pages: Math.ceil(total / Number(limit)), total });
  } catch (error) { next(error); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const article = await populate(Article.findOne({ _id: req.params.id, published: true }));
    if (!article) return res.status(404).json({ message: 'Article not found.' });
    res.json({ article });
  } catch (error) { next(error); }
});

router.post('/', protect, editorOnly, async (req, res, next) => {
  try {
    if (!await categoryIsActive(req.body.category)) return res.status(400).json({ message: 'Choose an active category.' });
    const article = await Article.create({ ...req.body, author: req.user._id });
    if (article.published) req.app.get('io')?.emit('article:published', { id: article._id, title: article.title });
    res.status(201).json({ article });
  }
  catch (error) { next(error); }
});

router.patch('/:id', protect, editorOnly, async (req, res, next) => {
  try {
    const allowed = ['title', 'excerpt', 'body', 'category', 'image', 'summary', 'readMinutes', 'published', 'featured'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
    if (updates.category && !await categoryIsActive(updates.category)) return res.status(400).json({ message: 'Choose an active category.' });
    if (req.body.imagePublicId) updates.imagePublicId = req.body.imagePublicId;
    const article = await Article.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }).populate('author', 'name');
    if (!article) return res.status(404).json({ message: 'Article not found.' });
    if (article.published) req.app.get('io')?.emit('article:updated', { id: article._id, title: article.title });
    res.json({ article });
  } catch (error) { next(error); }
});

router.delete('/:id', protect, editorOnly, async (req, res, next) => {
  try {
    const article = await Article.findByIdAndDelete(req.params.id);
    if (!article) return res.status(404).json({ message: 'Article not found.' });
    if (article.imagePublicId && process.env.CLOUDINARY_API_SECRET) {
      cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET, secure: true });
      await cloudinary.uploader.destroy(article.imagePublicId).catch((error) => console.error('Cloudinary cleanup failed:', error.message));
    }
    req.app.get('io')?.emit('article:deleted', { id: article._id });
    res.json({ message: 'Article deleted.' });
  } catch (error) { next(error); }
});

router.post('/:id/reactions', protect, async (req, res, next) => {
  try {
    const { value } = req.body;
    if (!['like', 'dislike'].includes(value)) return res.status(400).json({ message: 'Choose like or dislike.' });
    const article = await Article.findById(req.params.id);
    if (!article) return res.status(404).json({ message: 'Article not found.' });
    const existing = article.reactions.find((r) => r.user.equals(req.user._id));
    if (existing?.value === value) article.reactions = article.reactions.filter((r) => !r.user.equals(req.user._id));
    else if (existing) existing.value = value;
    else article.reactions.push({ user: req.user._id, value });
    await article.save();
    const mine = article.reactions.find((r) => r.user.equals(req.user._id))?.value || null;
    const likes = article.reactions.filter((r) => r.value === 'like').length;
    const dislikes = article.reactions.filter((r) => r.value === 'dislike').length;
    const update = { articleId: String(article._id), userId: String(req.user._id), likes, dislikes, mine };
    req.app.get('io')?.to(`article:${article._id}`).emit('article:reaction', update);
    if (mine) await notify(req, { recipient: article.author, actor: req.user._id, article: article._id, type: 'reaction', message: `${req.user.name} reacted to “${article.title}”.`, emailSubject: 'A reader reacted to your Nova Press story' });
    res.json(update);
  } catch (error) { next(error); }
});

router.post('/:id/comments', protect, async (req, res, next) => {
  try {
    const body = req.body.body?.trim();
    if (!body) return res.status(400).json({ message: 'Write a comment first.' });
    const article = await Article.findById(req.params.id);
    if (!article) return res.status(404).json({ message: 'Article not found.' });
    article.comments.push({ author: req.user._id, body });
    await article.save();
    await article.populate('comments.author', 'name');
    const comment = article.comments.at(-1);
    req.app.get('io')?.to(`article:${article._id}`).emit('article:comment', { ...comment.toObject(), articleId: String(article._id) });
    await notify(req, { recipient: article.author, actor: req.user._id, article: article._id, type: 'comment', message: `${req.user.name} commented on “${article.title}”.`, emailSubject: 'A reader commented on your Nova Press story' });
    res.status(201).json({ comment });
  } catch (error) { next(error); }
});

export default router;
