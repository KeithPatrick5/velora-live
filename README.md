# Noctra

Noctra is a mobile-first movie and series browser with a dark cinematic interface, instant search, a local My List, and Videasy playback.

## Run locally

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`.

## Deploy

This folder is a static site. Deploy the folder root to Vercel with no build command.

## Playback

Movies use `https://player.videasy.to/movie/{tmdbId}`. Series use `https://player.videasy.to/tv/{tmdbId}/{season}/{episode}` with Videasy's episode selector and next-episode options enabled.
