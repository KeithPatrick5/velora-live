// Explicit ESM extension keeps Vercel's CommonJS bootstrap isolated.
const TMDB = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p";

function token() {
  return process.env.TMDB_API_TOKEN?.trim() || "";
}

function apiKey() {
  return process.env.TMDB_API_KEY?.trim() || "";
}

export function hasTmdb() {
  return Boolean(token() || apiKey());
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function request(path, params = {}) {
  if (!hasTmdb()) throw new Error("TMDB credentials are not configured");

  const buildUrl = useKey => {
    const url = new URL(`${TMDB}${path}`);
    url.searchParams.set("language", "en-US");
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
    }
    if (useKey && apiKey()) url.searchParams.set("api_key", apiKey());
    return url;
  };

  const attempt = async (useKey, retry = 0) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const headers = { Accept: "application/json" };
      if (!useKey && token()) headers.Authorization = `Bearer ${token()}`;
      const response = await fetch(buildUrl(useKey), { headers, signal: controller.signal });

      // Some environments have trouble with one TMDB auth form. Fall back to
      // the user's v3 API key when bearer auth is rejected.
      if ((response.status === 401 || response.status === 403) && !useKey && apiKey()) {
        return attempt(true, retry);
      }
      if ((response.status === 429 || response.status >= 500) && retry < 2) {
        await sleep(350 * (retry + 1));
        return attempt(useKey, retry + 1);
      }
      if (!response.ok) throw new Error(`TMDB ${response.status}: ${path}`);
      return response.json();
    } finally {
      clearTimeout(timer);
    }
  };

  return attempt(!token() && Boolean(apiKey()));
}

function year(value) {
  return value ? String(value).slice(0, 4) : "—";
}

function itemFromTmdb(raw, forcedType) {
  const type = forcedType || raw.media_type || (raw.title ? "movie" : "tv");
  const isMovie = type === "movie";
  const title = isMovie ? raw.title : raw.name;
  const date = isMovie ? raw.release_date : raw.first_air_date;
  const genreNames = Array.isArray(raw.genres) ? raw.genres.map(g => g.name) : [];
  return {
    id: `tmdb-${isMovie ? "movie" : "tv"}-${raw.id}`,
    title: title || "Untitled",
    year: year(date),
    type: isMovie ? "movie" : "show",
    summary: raw.overview || "",
    image: raw.poster_path ? `${IMG}/w500${raw.poster_path}` : "",
    backdrop: raw.backdrop_path ? `${IMG}/original${raw.backdrop_path}` : (raw.poster_path ? `${IMG}/w780${raw.poster_path}` : ""),
    score: raw.vote_average ? Number(raw.vote_average).toFixed(1) : "—",
    genres: genreNames,
    genreIds: raw.genre_ids || [],
    releaseDate: date || "",
    popularity: Number(raw.popularity || 0),
    tmdbId: raw.id
  };
}

function unique(items) {
  const seen = new Set();
  return items.filter(item => item?.id && !seen.has(item.id) && seen.add(item.id));
}

async function hydrateGenres(items) {
  // List endpoints expose genre IDs only. Keep API fast and map common IDs locally.
  const names = new Map([
    [28,"Action"],[12,"Adventure"],[16,"Animation"],[35,"Comedy"],[80,"Crime"],[99,"Documentary"],[18,"Drama"],[10751,"Family"],[14,"Fantasy"],[36,"History"],[27,"Horror"],[10402,"Music"],[9648,"Mystery"],[10749,"Romance"],[878,"Science Fiction"],[10770,"TV Movie"],[53,"Thriller"],[10752,"War"],[37,"Western"],
    [10759,"Action & Adventure"],[10762,"Kids"],[10763,"News"],[10764,"Reality"],[10765,"Sci-Fi & Fantasy"],[10766,"Soap"],[10767,"Talk"],[10768,"War & Politics"]
  ]);
  return items.map(item => ({ ...item, genres: item.genres.length ? item.genres : (item.genreIds || []).map(id => names.get(id)).filter(Boolean) }));
}

async function list(path, type, params = {}) {
  const data = await request(path, params);
  return hydrateGenres((data.results || []).map(x => itemFromTmdb(x, type)));
}

export async function homeCatalog() {
  const [trending, newestMovies, popularMovies, popularTv, airingTv, anime] = await Promise.all([
    list("/trending/all/day"),
    list("/movie/now_playing", "movie", { region: "US", page: 1 }),
    list("/movie/popular", "movie", { region: "US", page: 1 }),
    list("/tv/popular", "tv", { page: 1 }),
    list("/tv/on_the_air", "tv", { page: 1 }),
    list("/discover/tv", "tv", { with_genres: 16, with_origin_country: "JP", sort_by: "popularity.desc", page: 1 })
  ]);

  const featured = unique(trending).slice(0, 8);
  const newest = unique([...newestMovies, ...airingTv])
    .sort((a,b) => String(b.releaseDate).localeCompare(String(a.releaseDate)))
    .slice(0, 24);
  const popular = unique([...trending, ...popularMovies, ...popularTv]).slice(0, 24);
  const movies = unique([...popularMovies, ...newestMovies]).slice(0, 40);
  const shows = unique([...popularTv, ...airingTv]).slice(0, 40);
  const animeItems = unique(anime.map(x => ({ ...x, type: "anime", genres: uniqueStrings(["Anime", ...x.genres]) }))).slice(0, 40);
  const items = unique([...featured, ...newest, ...popular, ...movies, ...shows, ...animeItems]);

  return {
    items,
    rows: { featured, newest, popular, movies, shows, anime: animeItems },
    source: "tmdb-live",
    refreshedAt: new Date().toISOString()
  };
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

export async function sectionCatalog(section) {
  if (section === "movies") {
    const items = unique([...(await list("/movie/now_playing", "movie", { region: "US" })), ...(await list("/movie/popular", "movie", { region: "US" }))]);
    return { items, source: "tmdb-live" };
  }
  if (section === "anime") {
    const items = (await list("/discover/tv", "tv", { with_genres: 16, with_origin_country: "JP", sort_by: "popularity.desc" }))
      .map(x => ({ ...x, type: "anime", genres: uniqueStrings(["Anime", ...x.genres]) }));
    return { items, source: "tmdb-live" };
  }
  const items = unique([...(await list("/tv/on_the_air", "tv")), ...(await list("/tv/popular", "tv"))]);
  return { items, source: "tmdb-live" };
}

export async function searchCatalog(query) {
  const data = await request("/search/multi", { query, include_adult: false, page: 1 });
  const items = (data.results || [])
    .filter(x => x.media_type === "movie" || x.media_type === "tv")
    .map(x => itemFromTmdb(x, x.media_type));
  return { items: await hydrateGenres(items), source: "tmdb-live" };
}

export async function titleDetails(id, season = 1) {
  const match = String(id || "").match(/^tmdb-(movie|tv)-(\d+)$/);
  if (!match) return null;
  const mediaType = match[1];
  const tmdbId = Number(match[2]);
  const raw = await request(`/${mediaType}/${tmdbId}`);
  const item = itemFromTmdb(raw, mediaType);
  item.genres = (raw.genres || []).map(g => g.name);
  if (mediaType === "movie") return { item, seasons: [], episodes: [] };

  const seasons = (raw.seasons || []).filter(s => s.season_number > 0).map(s => ({ number: s.season_number }));
  let episodes = [];
  if (season > 0) {
    const seasonData = await request(`/tv/${tmdbId}/season/${season}`);
    episodes = (seasonData.episodes || []).map(ep => ({
      number: ep.episode_number,
      title: ep.name || `Episode ${ep.episode_number}`,
      runtime: ep.runtime ? `${ep.runtime} min` : "—",
      summary: ep.overview || "",
      image: ep.still_path ? `${IMG}/w780${ep.still_path}` : item.backdrop
    }));
  }
  return { item, seasons, episodes };
}

export async function findTmdbIdByTitle(title, mediaType, yearValue) {
  if (!hasTmdb()) return null;
  const endpoint = mediaType === "movie" ? "/search/movie" : "/search/tv";
  const year = Number(String(yearValue || "").slice(0, 4));
  const params = { query: title, include_adult: false, page: 1 };
  if (Number.isInteger(year) && year > 1800) {
    if (mediaType === "movie") params.primary_release_year = year;
    else params.first_air_date_year = year;
  }
  const data = await request(endpoint, params);
  const results = data.results || [];
  const exact = results.find(item => {
    const candidate = mediaType === "movie" ? item.title : item.name;
    return String(candidate || "").trim().toLowerCase() === String(title || "").trim().toLowerCase();
  });
  const hit = exact || results[0];
  return hit?.id ? Number(hit.id) : null;
}
