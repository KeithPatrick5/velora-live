function positiveInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function buildFallbackSources({ tmdbId, mediaType, season, episode }) {
  const id = positiveInt(tmdbId);
  if (!id) return [];
  const s = positiveInt(season);
  const e = positiveInt(episode);
  const isMovie = mediaType === 'movie';

  const sources = [];

  // VidLink first: current public docs expose TMDB-based iframe embeds and
  // PLAYER_EVENT postMessages, and it tends to fail fast instead of hanging.
  if (isMovie) {
    sources.push({
      provider: 'vidlink', title: 'VidLink', quality: 'Auto', type: 'embed',
      url: `https://vidlink.pro/movie/${id}?primaryColor=ff315d&secondaryColor=202024&iconColor=ffffff&icons=default&title=false&poster=true&autoplay=false&fallback_url=${encodeURIComponent(`https://player.videasy.net/movie/${id}?overlay=true`)}`
    });
  } else if (s && e) {
    sources.push({
      provider: 'vidlink', title: 'VidLink', quality: 'Auto', type: 'embed',
      url: `https://vidlink.pro/tv/${id}/${s}/${e}?primaryColor=ff315d&secondaryColor=202024&iconColor=ffffff&icons=default&title=false&poster=true&autoplay=false&nextbutton=true&fallback_url=${encodeURIComponent(`https://player.videasy.net/tv/${id}/${s}/${e}?overlay=true&episodeSelector=true&nextEpisode=true`)}`
    });
  }

  // Keep Videasy as the second source rather than the only source.
  if (isMovie) {
    sources.push({ provider: 'videasy', title: 'Videasy', quality: 'Auto', type: 'embed', url: `https://player.videasy.net/movie/${id}?overlay=true` });
  } else {
    const path = s && e ? `/tv/${id}/${s}/${e}` : `/tv/${id}`;
    sources.push({ provider: 'videasy', title: 'Videasy', quality: 'Auto', type: 'embed', url: `https://player.videasy.net${path}?overlay=true&episodeSelector=true&nextEpisode=true` });
  }

  // Third source gives the Sources button a real escape hatch when one embed stalls.
  if (isMovie) {
    sources.push({ provider: 'vidsrc', title: 'VidSrc', quality: 'Auto', type: 'embed', url: `https://vidsrc.to/embed/movie/${id}` });
  } else if (s && e) {
    sources.push({ provider: 'vidsrc', title: 'VidSrc', quality: 'Auto', type: 'embed', url: `https://vidsrc.to/embed/tv/${id}/${s}/${e}` });
  } else {
    sources.push({ provider: 'vidsrc', title: 'VidSrc', quality: 'Auto', type: 'embed', url: `https://vidsrc.to/embed/tv/${id}` });
  }

  return sources;
}
