// Vercel serverless function: hands the browser its ICE (STUN/TURN) servers for voice chat.
// Voice works for most people with STUN alone. Add a TURN relay for people on strict networks
// (some mobile carriers, corporate Wi-Fi). Configure ONE of these in Vercel > Settings > Environment Variables:
//   METERED_DOMAIN + METERED_API_KEY          (Metered.ca TURN, e.g. yourapp.metered.live)
//   TURN_URL + TURN_USERNAME + TURN_CREDENTIAL (any TURN server; TURN_URL may be comma-separated)
// With neither set, this returns relay:false and the app keeps PeerJS's built-in defaults.

const STUN = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302", "stun:stun.cloudflare.com:3478"] }];

module.exports = async (req, res) => {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  res.setHeader("Cache-Control", "private, max-age=300");

  const { METERED_DOMAIN, METERED_API_KEY, TURN_URL, TURN_USERNAME, TURN_CREDENTIAL } = process.env;

  try {
    if (METERED_DOMAIN && METERED_API_KEY && /^[a-z0-9.-]+$/i.test(METERED_DOMAIN)) {
      const r = await fetch("https://" + METERED_DOMAIN + "/api/v1/turn/credentials?apiKey=" + encodeURIComponent(METERED_API_KEY));
      if (r.ok) {
        const list = await r.json();
        if (Array.isArray(list) && list.length) return res.status(200).json({ relay: true, iceServers: [...STUN, ...list] });
      }
    }
    if (TURN_URL && TURN_USERNAME && TURN_CREDENTIAL) {
      const urls = TURN_URL.split(",").map((u) => u.trim()).filter(Boolean);
      return res.status(200).json({ relay: true, iceServers: [...STUN, { urls, username: TURN_USERNAME, credential: TURN_CREDENTIAL }] });
    }
  } catch { /* fall through to STUN only */ }

  return res.status(200).json({ relay: false, iceServers: STUN });
};
