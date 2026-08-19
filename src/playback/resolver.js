import { buildVideasySource } from "./providers/videasy.js";
import { findTmdbIdByTitle } from "../catalog/tmdb.js";

function tmdbIdFromVeloraId(id) {
  const match = String(id || "").match(/^tmdb-(?:movie|tv)-(\d+)$/);
  return match ? Number(match[1]) : null;
}

export async function resolvePlayback(input = {}) {
  const mediaType = input.mediaType === "movie" ? "movie" : "tv";
  let tmdbId = tmdbIdFromVeloraId(input.id);

  // Makes old recovered catalog IDs playable during migration when TMDB is configured.
  if (!tmdbId && input.title) {
    tmdbId = await findTmdbIdByTitle(input.title, mediaType, input.year);
  }

  if (!tmdbId) throw new Error(`Could not map "${input.title || input.id || "title"}" to a TMDB ID for Videasy.`);

  const season = Number(input.season);
  const episode = Number(input.episode);

  return [buildVideasySource({
    tmdbId,
    mediaType,
    season: Number.isInteger(season) && season > 0 ? season : undefined,
    episode: Number.isInteger(episode) && episode > 0 ? episode : undefined
  })];
}
