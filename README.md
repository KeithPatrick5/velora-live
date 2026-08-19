# Velora / Dulo recovered source project

This project was reconstructed from the deployed Velora build captured from the authenticated ChatGPT Site. The recovered frontend assets are preserved instead of redesigning the UI.

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

Without `TMDB_API_TOKEN`, the app uses the recovered catalog snapshots. Those old non-TMDB IDs may not resolve to playback until TMDB is configured because Videasy is intentionally connected through TMDB IDs.

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
