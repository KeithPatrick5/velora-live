import { buildVidCoreSource } from './providers/vidcore.js';
import { buildVideasySource } from './providers/videasy.js';
import { findTmdbIdByTitle } from '../catalog/tmdb.js';

function tmdbIdFromVeloraId(id) {
  const match = String(id || '').match(/^tmdb-(?:movie|tv)-(\d+)$/);
  return match ? Number(match[1]) : null;
}

export async function resolvePlayback(input = {}) {
  const mediaType = input.mediaType === 'movie' ? 'movie' : 'tv';
  let tmdbId = tmdbIdFromVeloraId(input.id);

  if (!tmdbId && input.title) {
    tmdbId = await findTmdbIdByTitle(input.title, mediaType, input.year);
  }
  if (!tmdbId) throw new Error(`Could not map "${input.title || input.id || 'title'}" to a TMDB ID.`);

  const season = Number(input.season);
  const episode = Number(input.episode);
  const normalized = {
    tmdbId,
    mediaType,
    season: Number.isInteger(season) && season > 0 ? season : undefined,
    episode: Number.isInteger(episode) && episode > 0 ? episode : undefined
  };

  // VidCore is primary because its current public docs describe built-in
  // multi-server fallback. Keep Videasy immediately behind it as a second source.
  return [
    buildVidCoreSource(normalized),
    buildVideasySource(normalized)
  ];
}
