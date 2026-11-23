# Deploying Thrilx on Vercel

Folder layout (already set up):

```
thrilx/
├─ public/          index.html, style.css, script.js   (the site)
├─ api/             tmdb.js, ping.js, turn.js           (serverless functions)
├─ vercel.json
├─ package.json
└─ .gitignore
```

## Steps
1. Push this folder to a GitHub repo (or run `npx vercel` inside it).
2. In Vercel: **Add New → Project → import the repo**. Leave Framework as "Other". No build command needed.
3. **Settings → Environment Variables**, add:
   - `TMDB_KEY` = your TMDB v3 key or v4 read token (required)
4. Deploy, then open `https://YOUR-SITE.vercel.app/api/ping`. You should see `{"ok":true,"tmdbKeySet":true,...}`.

Changed an env var? Redeploy so functions pick it up.

## Voice chat on strict networks (optional)
Voice works for most people out of the box. Some mobile carriers and corporate/school Wi-Fi block direct
connections, so those people won't hear each other without a relay (TURN) server. To add one, set either:
- `METERED_DOMAIN` (e.g. `yourapp.metered.live`) + `METERED_API_KEY`, or
- `TURN_URL` (comma-separated ok) + `TURN_USERNAME` + `TURN_CREDENTIAL`

`/api/ping` shows `"turnConfigured": true` once it's picked up.

## Local testing
`npx vercel dev` (needs a `.env.local` with `TMDB_KEY=...`). Voice chat needs https or localhost.
