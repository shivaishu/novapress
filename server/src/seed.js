import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from './models/User.js';
import Article from './models/Article.js';
import Category from './models/Category.js';

await mongoose.connect(process.env.MONGODB_URI);
const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.toLowerCase().trim();
const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
if (!adminEmail || !adminPassword || adminPassword.length < 14) throw new Error('Set BOOTSTRAP_ADMIN_EMAIL and a unique 14+ character BOOTSTRAP_ADMIN_PASSWORD in server/.env before seeding.');
let editor = await User.findOne({ email: adminEmail });
if (!editor) editor = await User.create({ name: 'Nova Editorial', email: adminEmail, password: await bcrypt.hash(adminPassword, 12), role: 'admin' });
else if (editor.role !== 'admin') { editor.role = 'admin'; await editor.save(); }
for (const name of ['World', 'Technology', 'Business', 'Culture', 'Science', 'Politics', 'Sports', 'Entertainment', 'Lifestyle']) {
  await Category.updateOne({ name }, { $setOnInsert: { name, slug: name.toLowerCase(), active: true } }, { upsert: true });
}
if (!await Article.exists({})) {
  await Article.insertMany([
    { title: 'The cities rethinking how streets belong to everyone', excerpt: 'A new generation of urban planners is making room for quieter, greener, more human neighborhoods.', body: 'Across the world, city leaders are reconsidering the most ordinary part of urban life: the street. Pilot programs are widening footpaths, adding protected bike lanes, and creating small public spaces from underused parking areas.\n\nThe shift is less about one grand redesign than many local decisions. Residents are invited to help identify dangerous crossings, choose shade trees, and decide where deliveries should happen. Early results point to slower traffic and stronger neighborhood connections.\n\nThe challenge is keeping these improvements accessible to everyone. Cities are pairing street changes with public transit investment and measuring who benefits as projects grow.', category: 'World', image: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=1200&q=85', author: editor._id, readMinutes: 6, featured: true },
    { title: 'Inside the small labs building a more useful kind of AI', excerpt: 'Researchers are shifting attention from bigger models to tools that can explain their work and fit into daily life.', body: 'At university labs and small research teams, a quieter trend is taking hold: building AI tools around specific needs. Instead of asking one model to do everything, teams are combining smaller systems with carefully designed interfaces.\n\nThat approach can make results easier to review and less expensive to run. It also puts more weight on the people who define a problem, evaluate the output, and decide when a human should take over.\n\nFor the public, the practical test will be whether these systems save time without making important decisions harder to understand.', category: 'Technology', image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1200&q=85', author: editor._id, readMinutes: 5 },
    { title: 'The neighborhood bookstores making a comeback', excerpt: 'From reading clubs to late-night openings, independent shops are finding new ways to become community anchors.', body: 'Independent bookstores are experimenting with a broader role in their neighborhoods. Many now host writing workshops, local history talks, and small exhibitions alongside their shelves.\n\nOwners say the most reliable growth comes from building a reason to return. A monthly reading group or a thoughtful children’s corner can make a store feel like a shared place rather than a transaction.\n\nThe model does not erase the financial pressures of retail, but it shows how local businesses can create value that is difficult to replicate online.', category: 'Culture', image: 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=1200&q=85', author: editor._id, readMinutes: 4 },
    { title: 'Why clean energy storage is getting a second look', excerpt: 'New grid projects are showing how batteries can help balance renewable power through the day.', body: 'As solar and wind power become a larger part of electricity supply, storage is moving from a technical footnote to a central planning question. Utilities are testing batteries that can respond quickly when demand rises or generation dips.\n\nThe technology is not a single solution. Grid operators are combining storage with transmission upgrades, flexible demand, and better forecasting. The mix varies by region and by the needs of local communities.\n\nResearchers are watching cost, material sourcing, and end-of-life recycling as closely as capacity. Those details will shape how quickly promising pilots become dependable infrastructure.', category: 'Science', image: 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=1200&q=85', author: editor._id, readMinutes: 7 }
  ]);
}
console.log('Seed complete. Bootstrap admin credentials are stored in server/.env.');
await mongoose.disconnect();
