function positiveInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function buildVidCoreSource({ tmdbId, mediaType, season, episode }) {
  const id = positiveInt(tmdbId);
  if (!id) throw new Error('A valid TMDB ID is required for VidCore playback.');

  const base = String(process.env.VIDCORE_PLAYER_BASE || 'https://www.vidcore.org').replace(/\/$/, '');
  const params = new URLSearchParams({
    autoPlay: 'false',
    title: 'false',
    poster: 'true',
    theme: 'ef1d43'
  });

  if (mediaType === 'movie') {
    return {
      provider: 'vidcore',
      title: 'VidCore',
      quality: 'Auto',
      type: 'embed',
      url: `${base}/embed/movie/${id}?${params}`
    };
  }

  const s = positiveInt(season);
  const e = positiveInt(episode);
  // VidCore's documented TV player is episode-specific. If the recovered UI
  // opens a show without an episode yet, start at S1E1 so the player is usable.
  const seasonNumber = s || 1;
  const episodeNumber = e || 1;
  return {
    provider: 'vidcore',
    title: 'VidCore',
    quality: 'Auto',
    type: 'embed',
    url: `${base}/embed/tv/${id}/${seasonNumber}/${episodeNumber}?${params}`
  };
}
