// Health check: open /api/ping. If this works, Vercel is deploying your api/ folder correctly.
module.exports = (req, res) => {
  res.status(200).json({ ok: true, tmdbKeySet: Boolean(process.env.TMDB_KEY) });
};
