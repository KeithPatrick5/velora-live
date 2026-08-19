const TMDB_ORIGIN = "https://www.themoviedb.org";
const titleIndex = require("./data/title-index.json");

function decodeHtml(value = "") {
  return value
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)))
    .replace(/&#x([0-9a-f]+);/gi, (_, number) => String.fromCodePoint(parseInt(number, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function posterUrl(url = "") {
  if (!/^https:\/\/media\.themoviedb\.org\//.test(url)) return "";
  return url.replace(/\/w\d+_and_h\d+_face\//, "/w500/");
}

function parseCards(html) {
  const markers = [...html.matchAll(/class="(?:comp:media-card\b|w-full overflow-hidden rounded-xl\b)/g)].map((match) => match.index);
  const results = [];
  const seen = new Set();

  for (let index = 0; index < markers.length; index += 1) {
    const block = html.slice(markers[index], markers[index + 1] ?? html.length);
    const identity = block.match(/data-media-type="(movie|tv)"[^>]*data-media-adult="false"[^>]*href="\/(movie|tv)\/(\d+)[^"]*"/);
    if (!identity || identity[1] !== identity[2]) continue;

    const type = identity[1];
    const id = Number(identity[3]);
    const key = `${type}:${id}`;
    if (seen.has(key)) continue;

    const image = block.match(/<img\b[^>]*\balt="([^"]*)"[^>]*\bsrc="([^"]+)"[^>]*>/);
    const heading = block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/);
    const releaseDate = block.match(/<span class="release_date[^"]*">([\s\S]*?)<\/span>/);
    const overview = block.match(/<div class="mt-4[^>]*>[\s\S]*?<p>([\s\S]*?)<\/p>/);
    const title = decodeHtml(heading?.[1] || image?.[1] || "");
    if (!title) continue;

    const year = decodeHtml(releaseDate?.[1] || "").match(/\b(?:18|19|20)\d{2}\b/)?.[0] || "";
    seen.add(key);
    results.push({
      id,
      type,
      title: title.slice(0, 180),
      year,
      poster: posterUrl(image?.[2]),
      overview: decodeHtml(overview?.[1] || "").slice(0, 600)
    });
  }

  return results;
}

function parseQuickSearch(payload) {
  if (!Array.isArray(payload?.results)) return [];
  return payload.results
    .filter((item) => item && typeof item === "object" && (item.media_type === "movie" || item.media_type === "tv") && !item.adult && !item.softcore)
    .map((item) => ({
      id:Number(item.id),
      type:item.media_type,
      title:String(item.name || item.title || "").slice(0, 180),
      year:String(item.release_date || item.first_air_date || "").slice(0, 4),
      poster:item.poster_path ? `https://media.themoviedb.org/t/p/w500${item.poster_path}` : "",
      overview:String(item.overview || "").slice(0, 600)
    }))
    .filter((item) => Number.isInteger(item.id) && item.id > 0 && item.title);
}

function fold(value) {
  return String(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function searchIndex(query, limit = 80) {
  const term = fold(query);
  const matches = [];
  const sources = [["movie", titleIndex.movies], ["tv", titleIndex.tv]];

  for (const [type, entries] of sources) {
    for (let rank = 0; rank < entries.length; rank += 1) {
      const [id, title] = entries[rank];
      const normalizedTitle = fold(title);
      const position = normalizedTitle.indexOf(term);
      if (position < 0) continue;
      const relevancePenalty = normalizedTitle === term ? 0 : position === 0 ? 500 : normalizedTitle.includes(` ${term}`) ? 1000 : 2500;
      const score = rank + relevancePenalty + Math.abs(normalizedTitle.length - term.length) * 40;
      matches.push({score, rank, item:{id,type,title,year:"",poster:"",overview:""}});
    }
  }

  return matches
    .sort((left, right) => left.score - right.score || left.rank - right.rank)
    .slice(0, limit)
    .map((match) => match.item);
}

module.exports = async function handler(request, response) {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");

  const mode = request.query?.mode === "search" ? "search" : request.query?.mode === "enrich" ? "enrich" : "browse";
  const type = request.query?.type === "tv" ? "tv" : "movie";
  const page = Math.min(500, Math.max(1, Number.parseInt(request.query?.page, 10) || 1));
  const query = String(request.query?.q || "").trim().slice(0, 80);

  if ((mode === "search" || mode === "enrich") && query.length < 2) {
    return response.status(400).json({error:"Enter at least two characters."});
  }

  if (mode === "search") {
    return response.status(200).json({mode, type:"all", page:1, catalogSize:titleIndex.count, results:searchIndex(query)});
  }

  const path = mode === "enrich"
    ? `/search/trending?query=${encodeURIComponent(query)}&language=en-US`
    : `/${type}?language=en-US&page=${page}`;

  try {
    const upstream = await fetch(`${TMDB_ORIGIN}${path}`, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-US,en;q=0.9",
        "user-agent": "Mozilla/5.0 (compatible; NoctraCatalog/1.0)"
      },
      signal: AbortSignal.timeout(mode === "enrich" ? 7000 : 9000)
    });

    if (!upstream.ok) throw new Error(`Upstream returned ${upstream.status}`);
    const body = await upstream.text();
    const results = mode === "enrich" ? parseQuickSearch(JSON.parse(body)) : parseCards(body);
    return response.status(200).json({mode, type:mode === "browse" ? type : "all", page, catalogSize:titleIndex.count, results});
  } catch (error) {
    console.error("[api/catalog]", {mode, type, page, message:String(error)});
    return response.status(502).json({error:"Catalog service unavailable."});
  }
};
