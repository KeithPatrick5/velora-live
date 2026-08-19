# Velora / Dulo

The existing Velora frontend is preserved, with a Node backend for catalog, playback, accounts, and live TV.

## What is implemented

- Existing Velora UI and layout preserved from the deployed build.
- `/api/catalog` rebuilt as a normal local backend.
- Live TMDB catalog support using TMDB IDs.
- Snapshot fallback so the recovered site boots without a TMDB token.
- Playback provider abstraction.
- Videasy configured as provider #1 using TMDB IDs.
- Movies and TV episode playback supported.
- Local account, library, and playback-progress API implemented.

## Run

Requires Node.js 20+.

```bash
cp .env.example .env
# Put your TMDB Read Access Token in .env, then export it or load it in your shell.
export TMDB_API_TOKEN="YOUR_TOKEN"
npm start
```

Open http://localhost:3000

Without `TMDB_API_TOKEN`, the app uses the catalog snapshots. Snapshot titles still display, but their legacy IDs require TMDB to map them to playback IDs.

## Vercel

The included `vercel.json` keeps the intro, app, static assets, and every `/api/*` route connected to the Node backend. Add `TMDB_API_TOKEN` (or `TMDB_API_KEY`) to the Vercel project before deploying so snapshot titles can resolve to playable TMDB IDs.

## Architecture

```text
Velora UI
  -> /api/catalog
     -> TMDB live catalog
  -> /api/resolve
     -> playback resolver
        -> Videasy provider
           -> TMDB movie / TV IDs
```

The video bytes are not proxied through this server. Videasy playback is embedded directly in the existing fullscreen player shell.

## Dynamic Live TV
Live TV now loads dynamically from the public iptv-org country playlist instead of shipping hardcoded channel cards.

Defaults:
- `LIVE_COUNTRY=us`
- `LIVE_LIMIT=180`
- provider: `https://iptv-org.github.io/iptv/countries/us.m3u`

Optional overrides:
- `LIVE_COUNTRY=mx` (or another 2-letter country code)
- `LIVE_M3U_URL=https://.../playlist.m3u`
- `LIVE_LIMIT=300`

The browser uses hls.js for `.m3u8` streams when native HLS is unavailable.

## Live UI v2 fixes
- Active development assets are served with `Cache-Control: no-store` so new Live markup can never pair with stale CSS.
- The recovered/original Live placeholder is hidden once the enhanced Live app mounts.
- Live layout styles moved to `/live-layout-v2.css` and use bounded logo/card dimensions.
- Full-screen cinematic Velora V boot intro is in `/velora-intro-v2.css`.

## Live provider stack

Velora Live keeps the selected country playlist as the **Local IPTV** provider and layers a separate **National & Global** provider from public category feeds (sports, news, entertainment, movies and kids). Streams are health-checked together, duplicate logical channels are collapsed, and the healthiest source wins while alternates are retained in API metadata.

Additional M3U providers can be added without code changes using `LIVE_EXTRA_M3U_URLS` or by copying `data/live-providers.example.json` to `data/live-providers.json` and adding provider URLs.
