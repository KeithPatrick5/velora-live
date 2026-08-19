// Explicit ESM extension keeps Vercel's CommonJS bootstrap isolated.
const DEFAULT_BASE = "https://player.videasy.net";

function positiveInt(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function boolParam(params, name, value) {
  if (value === true) params.set(name, "true");
  if (value === false) params.set(name, "false");
}

function playerOptions() {
  const params = new URLSearchParams();

  // Videasy's documented/observed embed options. Keep them centralized so
  // provider changes never leak into the recovered frontend bundle.
  boolParam(params, "overlay", process.env.VIDEASY_OVERLAY !== "false");

  const color = String(process.env.VIDEASY_COLOR || "").trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{6}$/.test(color)) params.set("color", color);

  return params;
}

export function buildVideasySource({ tmdbId, mediaType, season, episode }) {
  const id = positiveInt(tmdbId);
  if (!id) throw new Error("A valid TMDB ID is required for Videasy playback.");

  const base = (process.env.VIDEASY_PLAYER_BASE || DEFAULT_BASE).replace(/\/$/, "");
  const params = playerOptions();

  if (mediaType === "movie") {
    return {
      provider: "videasy",
      title: "Videasy",
      quality: "Auto",
      type: "embed",
      url: `${base}/movie/${id}${params.size ? `?${params}` : ""}`
    };
  }

  // For a show-level Play/Start Watching action, let Videasy present its own
  // episode selector instead of silently forcing S1E1.
  params.set("episodeSelector", "true");
  params.set("nextEpisode", "true");

  const s = positiveInt(season);
  const e = positiveInt(episode);
  const path = s && e ? `/tv/${id}/${s}/${e}` : `/tv/${id}`;

  return {
    provider: "videasy",
    title: "Videasy",
    quality: "Auto",
    type: "embed",
    url: `${base}${path}?${params}`
  };
}
