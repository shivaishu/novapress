import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { readFile } from 'node:fs/promises';
import Article from './models/Article.js';
import User from './models/User.js';
import Category from './models/Category.js';

dotenv.config({ override: true });
if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required in server/.env.');

const cache = JSON.parse(await readFile(new URL('../data/gnews-cache.json', import.meta.url), 'utf8'));
if (!Array.isArray(cache.articles) || !cache.articles.length) throw new Error('The GNews cache is empty.');

await mongoose.connect(process.env.MONGODB_URI);
try {
  let admin = await User.findOne({ role: 'admin' }).sort({ createdAt: 1 });
  if (!admin) {
    if (await User.exists({})) throw new Error('No admin account exists. Promote an account to admin before importing news.');
    const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.toLowerCase().trim();
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
    if (!email || !password || password.length < 14) throw new Error('Configure BOOTSTRAP_ADMIN_EMAIL and a 14+ character BOOTSTRAP_ADMIN_PASSWORD in server/.env first.');
    admin = await User.create({ name: 'Nova Editorial', email, password: await bcrypt.hash(password, 12), role: 'admin' });
  }
  for (const name of ['World', 'Technology', 'Business', 'Culture', 'Science', 'Politics', 'Sports', 'Entertainment', 'Lifestyle']) {
    await Category.updateOne({ name }, { $setOnInsert: { name, slug: name.toLowerCase(), active: true } }, { upsert: true });
  }
  const operations = cache.articles.map((news) => ({
    updateOne: {
      filter: { providerId: news.providerId || news.sourceUrl },
      upsert: true,
      update: {
        $set: {
          title: String(news.title).slice(0, 150),
          excerpt: String(news.excerpt || news.title).slice(0, 300),
          body: `${news.excerpt || news.title}\n\nRead the full report at ${news.sourceUrl}`,
          category: news.category,
          image: news.image || '',
          source: news.source || '',
          sourceUrl: news.sourceUrl,
          publishedAt: news.publishedAt ? new Date(news.publishedAt) : new Date(),
          author: admin._id,
          published: true,
          featured: false,
          readMinutes: 4
        },
        $setOnInsert: { providerId: news.providerId || news.sourceUrl }
      }
    }
  }));
  const result = await Article.bulkWrite(operations, { ordered: false });
  const total = await Article.countDocuments({ providerId: { $exists: true, $ne: '' } });
  console.log(`GNews cache imported. Upserted ${result.upsertedCount}; updated ${result.modifiedCount}; sourced stories in database ${total}.`);
} finally {
  await mongoose.disconnect();
}
