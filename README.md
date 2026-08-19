# Velora Live

Velora's existing interface with catalog, movie and TV playback resolution, live channels, and account endpoints.

## Local run

```bash
npm start
```

Open `http://localhost:3000`.

The bundled catalog loads without credentials. `TMDB_API_TOKEN` or `TMDB_API_KEY` enables the current TMDB catalog and maps legacy snapshot titles to playable TMDB IDs.

## Routes

- `/` — intro
- `/app` — Velora
- `/api/catalog` — home catalog, sections, search, and title details
- `/api/resolve` — VidCore and Videasy playback sources
- `/api/live` — live channels
- `/api/auth` and `/api/me` — account and library endpoints
