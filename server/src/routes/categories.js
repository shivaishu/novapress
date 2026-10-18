import { Router } from 'express';
import Category from '../models/Category.js';
import Article from '../models/Article.js';
import { protect, editorOnly } from '../middleware/auth.js';

const router = Router();
const slugify = (value) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

router.get('/', async (_req, res, next) => {
  try { res.json({ categories: await Category.find({ active: true }).sort({ name: 1 }).lean() }); }
  catch (error) { next(error); }
});

router.get('/manage', protect, editorOnly, async (_req, res, next) => {
  try { res.json({ categories: await Category.find().sort({ name: 1 }).lean() }); }
  catch (error) { next(error); }
});

router.post('/', protect, editorOnly, async (req, res, next) => {
  try {
    const name = req.body.name?.trim();
    if (!name) return res.status(400).json({ message: 'Category name is required.' });
    const category = await Category.create({ name, slug: slugify(name), description: req.body.description || '', accent: req.body.accent || '#7355d9' });
    res.status(201).json({ category });
  } catch (error) { next(error); }
});

router.patch('/:id', protect, editorOnly, async (req, res, next) => {
  try {
    const updates = {};
    if (req.body.name?.trim()) { updates.name = req.body.name.trim(); updates.slug = slugify(updates.name); }
    if (typeof req.body.description === 'string') updates.description = req.body.description.slice(0, 180);
    if (typeof req.body.active === 'boolean') updates.active = req.body.active;
    const category = await Category.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!category) return res.status(404).json({ message: 'Category not found.' });
    res.json({ category });
  } catch (error) { next(error); }
});

router.delete('/:id', protect, editorOnly, async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: 'Category not found.' });
    if (await Article.exists({ category: category.name })) return res.status(409).json({ message: 'Move or remove its articles before deleting this category.' });
    await category.deleteOne();
    res.json({ message: 'Category deleted.' });
  } catch (error) { next(error); }
});

export default router;
