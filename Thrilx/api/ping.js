// Health check: open /api/ping. If this works, Vercel is deploying your api/ folder correctly.
module.exports = (req, res) => {
  res.status(200).json({
    ok: true,
    tmdbKeySet: Boolean(process.env.TMDB_KEY),
    turnConfigured: Boolean((process.env.METERED_DOMAIN && process.env.METERED_API_KEY) || (process.env.TURN_URL && process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL)),
  });
};
