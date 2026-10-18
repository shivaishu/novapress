import { Router } from 'express';
import Article from '../models/Article.js';
import { protect, editorOnly } from '../middleware/auth.js';

const router = Router();
router.post('/articles/:id/summary', protect, editorOnly, async (req, res, next) => {
  try {
    if (!process.env.GEMINI_API_KEY) return res.status(503).json({ message: 'AI summaries need GEMINI_API_KEY in server/.env.' });
    const article = await Article.findById(req.params.id);
    if (!article) return res.status(404).json({ message: 'Article not found.' });
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: 'Write a neutral 2 to 3 sentence news summary using only the supplied article. Do not add facts, names, dates, causes, or implications that the article does not state. Return plain text only.' }] },
        contents: [{ role: 'user', parts: [{ text: `Headline: ${article.title}\n\nArticle:\n${article.body.slice(0, 18000)}` }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 180 }
      }), signal: AbortSignal.timeout(25000)
    });
    const data = await response.json();
    if (!response.ok) return res.status(502).json({ message: data.error?.message || 'Gemini could not summarize this article.' });
    const summary = data.candidates?.[0]?.content?.parts?.map((part) => part.text).join('\n').trim();
    if (!summary) return res.status(502).json({ message: 'Gemini returned an empty summary.' });
    article.summary = summary.slice(0, 1200);
    await article.save();
    res.json({ summary: article.summary });
  } catch (error) { next(error); }
});
export default router;
