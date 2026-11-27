// Vercel serverless function: proxies a small allowlist of TMDB endpoints and keeps the key server-side.
// Call it as /api/tmdb?path=/trending/all/week&other=params
// The key comes from the TMDB_KEY environment variable (Vercel > Settings > Environment Variables).

const ALLOWED = new RegExp(
  "^/(" +
    "trending/(movie|tv|all)/(day|week)" +
    "|(movie|tv)/(popular|top_rated|now_playing|on_the_air)" +
    "|(movie|tv)/\\d+(/(videos|credits|similar))?" +
    "|tv/\\d+/season/\\d+" +
    "|discover/(movie|tv)" +
    "|search/(movie|tv|multi)" +
    "|genre/(movie|tv)/list" +
  ")$"
);

module.exports = async (req, res) => {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const key = process.env.TMDB_KEY;
  if (!key) return res.status(500).json({ error: "TMDB_KEY is not configured" });

  const params = new URL(req.url, "http://localhost").searchParams;
  const path = params.get("path") || "";
  if (!ALLOWED.test(path)) return res.status(404).json({ error: "Endpoint not allowed", path });

  const upstream = new URL("https://api.themoviedb.org/3" + path);
  params.forEach((v, k) => { if (k !== "path" && k !== "api_key") upstream.searchParams.set(k, v); });

  const headers = { Accept: "application/json" };
  if (key.startsWith("eyJ")) headers.Authorization = "Bearer " + key; // v4 token
  else upstream.searchParams.set("api_key", key);                      // v3 key

  try {
    const r = await fetch(upstream, { headers });
    const body = await r.text();
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=300");
    return res.status(r.status).send(body);
  } catch {
    return res.status(502).json({ error: "Could not reach TMDB" });
  }
};
