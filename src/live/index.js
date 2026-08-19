import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const DEFAULT_PLAYLIST = 'https://iptv-org.github.io/iptv/countries/us.m3u';
const PLAYLIST_TTL_MS = 5 * 60 * 1000;
const HEALTH_FILE = process.env.VERCEL
  ? path.join('/tmp', 'velora-live-health.json')
  : path.join(ROOT, 'data', 'live-health.json');
const HEALTHY_TTL_MS = 6 * 60 * 60 * 1000;
const FAILED_TTL_MS = 45 * 60 * 1000;
const CHECK_TIMEOUT_MS = 4500;
const CHECK_BATCH = 24;
const CHECK_CONCURRENCY = 6;
let cache = { key: '', at: 0, channels: [] };
let playlistCaches = new Map();
let healthLoaded = false;
let health = new Map();
let checkCursor = 0;
let checkRunning = false;
let persistTimer = null;

function cleanId(value='') {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120);
}

function normalizeCategory(raw='') {
  const value = String(raw).toLowerCase();
  if (/sport/.test(value)) return 'Sports';
  if (/news|weather/.test(value)) return 'News';
  if (/movie|series|classic/.test(value)) return 'Movies & Series';
  if (/kid|animation|religious/.test(value)) return 'Kids & Family';
  if (/music/.test(value)) return 'Music';
  if (/documentary|science|education/.test(value)) return 'Documentary';
  if (/lifestyle|shop|food|travel/.test(value)) return 'Lifestyle';
  if (/entertainment|comedy/.test(value)) return 'Entertainment';
  if (/general|local/.test(value)) return 'Local & General';
  return 'Other';
}

function parseM3u(text, source='dynamic-m3u', provider='Local IPTV') {
  const channels = [];
  const lines = text.split(/\r?\n/);
  let meta = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#EXTINF:')) {
      const name = line.split(',').slice(1).join(',').trim() || 'Live channel';
      const attr = Object.fromEntries([...line.matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
      meta = { name, attr };
      continue;
    }
    if (!line.startsWith('#') && meta) {
      const baseId = meta.attr['tvg-id'] || meta.attr['tvg-name'] || meta.name || String(channels.length + 1);
      const rawCategory = meta.attr['group-title'] || 'General';
      channels.push({
        id: `${source}-${cleanId(baseId) || channels.length + 1}`,
        name: meta.name,
        category: normalizeCategory(rawCategory),
        rawCategory,
        country: meta.attr['tvg-country'] || '',
        language: meta.attr['tvg-language'] || '',
        description: meta.attr['tvg-name'] || meta.name,
        logo: meta.attr['tvg-logo'] || '',
        tvgId: meta.attr['tvg-id'] || '',
        player: { type: 'stream', url: line },
        source,
        provider
      });
      meta = null;
    }
  }
  return channels;
}


const FEATURED_NATIONAL_MATCHERS = [
  /\bespn\b/i, /\bespn2\b/i, /\bespnu\b/i, /espnews/i,
  /fox sports 1|\bfs1\b/i, /fox sports 2|\bfs2\b/i, /fox deportes/i,
  /cbs sports network/i, /cbs sports hq/i, /cbs sports golazo/i,
  /nfl channel|nfl network/i, /nba tv/i, /mlb network/i, /nhl network/i,
  /acc network/i, /sec network/i, /big ten network/i,
  /golf channel/i, /tennis channel/i, /bein sports xtra/i,
  /fubo sports network/i, /pluto tv sports/i,
  /tnt sports|\btnt\b/i, /\btbs\b/i, /usa network/i,
  /cnn/i, /msnbc/i, /cnbc/i, /fox news/i, /bbc news/i,
  /paramount movie|pluto.*movies|roku.*movie/i
];

function isFeaturedNational(ch) {
  const hay = `${ch?.name || ''} ${ch?.tvgId || ''} ${ch?.rawCategory || ''}`;
  return FEATURED_NATIONAL_MATCHERS.some(re => re.test(hay));
}

async function featuredNationalChannels() {
  const feeds = [
    ['english', process.env.LIVE_FEATURED_ENGLISH_M3U_URL || 'https://iptv-org.github.io/iptv/languages/eng.m3u'],
    ['us', process.env.LIVE_FEATURED_US_M3U_URL || 'https://iptv-org.github.io/iptv/countries/us.m3u']
  ];
  const groups = await Promise.all(feeds.map(async ([name, url]) => {
    const cacheKey = `featured:${url}`;
    const rec = playlistCaches.get(cacheKey);
    if (rec && Date.now() - rec.at < PLAYLIST_TTL_MS && rec.channels.length) return rec.channels;
    try {
      const all = await fetchPlaylist(url, `featured-${name}`, 'Featured National');
      const channels = all.filter(isFeaturedNational).map(ch => ({ ...ch, featuredNational: true }));
      playlistCaches.set(cacheKey, { at: Date.now(), channels });
      return channels;
    } catch {
      return rec?.channels || [];
    }
  }));
  return groups.flat();
}

async function fetchPlaylist(url, source='iptv-org', provider='Local IPTV') {
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'Velora/1.0 (+https://localhost)',
      'Accept': 'application/x-mpegURL, application/vnd.apple.mpegurl, text/plain, */*'
    },
    signal: AbortSignal.timeout(12_000)
  });
  if (!r.ok) throw new Error(`Live playlist returned ${r.status}`);
  return parseM3u(await r.text(), source, provider);
}

async function configuredChannels() {
  if (process.env.LIVE_CHANNELS_JSON) {
    try {
      const value = JSON.parse(process.env.LIVE_CHANNELS_JSON);
      if (Array.isArray(value)) return value.map(ch => ({...ch, category: normalizeCategory(ch.category)}));
    } catch {}
  }
  const jsonPath = path.join(ROOT, 'data', 'live-channels.json');
  try {
    const value = JSON.parse(await fs.readFile(jsonPath, 'utf8'));
    if (Array.isArray(value)) return value.map(ch => ({...ch, category: normalizeCategory(ch.category)}));
  } catch {}
  return [];
}

async function extraProviderFeeds() {
  const feeds = [];
  const envUrls = String(process.env.LIVE_EXTRA_M3U_URLS || '').split(',').map(x => x.trim()).filter(Boolean);
  envUrls.forEach((url, i) => feeds.push({ name: `Extra ${i + 1}`, url }));
  try {
    const file = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'live-providers.json'), 'utf8'));
    if (Array.isArray(file)) {
      for (const item of file) {
        if (item?.enabled === false || !item?.url) continue;
        feeds.push({ name: String(item.name || 'Extra provider'), url: String(item.url) });
      }
    }
  } catch {}
  return feeds;
}

function dedupe(channels) {
  const seen = new Set();
  return channels.filter(ch => {
    const key = `${(ch.tvgId || ch.name || '').toLowerCase()}|${ch.player?.url || ''}`;
    if (!ch?.name || !ch?.player?.url || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function channelKey(ch) {
  return cleanId(ch.tvgId || ch.name || ch.id) + '|' + (ch.player?.url || '');
}

async function ensureHealthLoaded() {
  if (healthLoaded) return;
  healthLoaded = true;
  try {
    const parsed = JSON.parse(await fs.readFile(HEALTH_FILE, 'utf8'));
    if (parsed && typeof parsed === 'object') health = new Map(Object.entries(parsed));
  } catch {}
}

function schedulePersist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(async () => {
    try {
      await fs.mkdir(path.dirname(HEALTH_FILE), { recursive: true });
      await fs.writeFile(HEALTH_FILE, JSON.stringify(Object.fromEntries(health), null, 2));
    } catch {}
  }, 400);
  persistTimer.unref?.();
}

function isFresh(rec) {
  if (!rec?.checkedAt) return false;
  const ttl = rec.status === 'working' ? HEALTHY_TTL_MS : FAILED_TTL_MS;
  return Date.now() - rec.checkedAt < ttl;
}

async function probeChannel(ch) {
  const url = ch.player?.url || '';
  const started = Date.now();
  let status = 'down';
  let detail = '';
  try {
    const r = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 VeloraStreamProbe/1.0',
        'Accept': 'application/vnd.apple.mpegurl, application/x-mpegURL, video/*, */*',
        'Range': 'bytes=0-4095'
      },
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS)
    });
    const type = r.headers.get('content-type') || '';
    if (r.ok || r.status === 206) {
      if (/m3u8/i.test(url) || /mpegurl/i.test(type)) {
        const text = await r.text().catch(() => '');
        status = /#EXTM3U/i.test(text) || /mpegurl/i.test(type) ? 'working' : 'down';
        detail = status === 'working' ? 'manifest-ok' : 'invalid-manifest';
      } else {
        status = 'working';
        detail = `http-${r.status}`;
        try { await r.body?.cancel(); } catch {}
      }
    } else {
      detail = `http-${r.status}`;
    }
  } catch (error) {
    detail = error?.name === 'TimeoutError' ? 'timeout' : (error?.message || 'request-failed').slice(0,80);
  }
  const previous = health.get(channelKey(ch));
  health.set(channelKey(ch), {
    status,
    checkedAt: Date.now(),
    latencyMs: Date.now() - started,
    successes: (previous?.successes || 0) + (status === 'working' ? 1 : 0),
    failures: (previous?.failures || 0) + (status === 'down' ? 1 : 0),
    detail
  });
  schedulePersist();
}

async function runPool(items, concurrency, fn) {
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      await fn(item);
    }
  }));
}

function scheduleHealthRefresh(channels) {
  if (checkRunning || !channels.length) return;
  checkRunning = true;
  setTimeout(async () => {
    try {
      await ensureHealthLoaded();
      const stale = [];
      for (let i = 0; i < channels.length && stale.length < CHECK_BATCH; i++) {
        const idx = (checkCursor + i) % channels.length;
        const ch = channels[idx];
        if (!isFresh(health.get(channelKey(ch)))) stale.push(ch);
      }
      checkCursor = (checkCursor + CHECK_BATCH) % Math.max(1, channels.length);
      await runPool(stale, CHECK_CONCURRENCY, probeChannel);
    } finally {
      checkRunning = false;
    }
  }, 25).unref?.();
}

function baseRank(ch) {
  const name = String(ch.name || '').toLowerCase();
  let score = 0;
  if (['News','Sports','Entertainment','Movies & Series','Kids & Family','Local & General'].includes(ch.category)) score += 10;
  if (/abc|nbc|cbs|fox|pbs|espn|news|sports|movie|kids|weather|local/.test(name)) score += 8;
  if (ch.logo) score += 3;
  if (/\.m3u8($|\?)/i.test(ch.player?.url || '')) score += 3;
  return score;
}

function enrichHealth(ch) {
  const rec = health.get(channelKey(ch));
  const healthStatus = rec?.status || 'unknown';
  const healthScore = healthStatus === 'working' ? 60 : healthStatus === 'down' ? -120 : 0;
  const providerScore = ch.provider === 'Scout Verified' ? 220 : ch.provider === 'Featured National' ? 140 : 0;
  const reliability = rec ? Math.round((rec.successes || 0) / Math.max(1, (rec.successes || 0) + (rec.failures || 0)) * 100) : null;
  return {
    ...ch,
    health: healthStatus,
    checkedAt: rec?.checkedAt || null,
    latencyMs: rec?.latencyMs || null,
    reliability,
    rank: baseRank(ch) + healthScore + providerScore
  };
}

// On a cold start, verify a small high-value set before the first Live response.
// This prevents unknown/dead playlist entries from being promoted into the hero
// or the first rails while the background checker is still warming up.
async function warmVerifiedChannels(channels, minimumWorking = 10) {
  const freshWorking = channels.filter(ch => {
    const rec = health.get(channelKey(ch));
    return rec?.status === 'working' && isFresh(rec);
  });
  if (freshWorking.length >= minimumWorking) return;

  const candidates = [...channels]
    .filter(ch => !isFresh(health.get(channelKey(ch))))
    .sort((a,b) => baseRank(b) - baseRank(a) || a.name.localeCompare(b.name))
    .slice(0, 24);
  if (!candidates.length) return;
  await runPool(candidates, 12, probeChannel);
}

export async function reportLiveHealth({ id, url, status, latencyMs }) {
  await ensureHealthLoaded();
  if (!url || !['working','down'].includes(status)) return false;
  const key = [...health.keys()].find(k => k.endsWith('|' + url)) || (cleanId(id || 'reported') + '|' + url);
  const prev = health.get(key) || {};
  health.set(key, {
    ...prev,
    status,
    checkedAt: Date.now(),
    latencyMs: Number.isFinite(Number(latencyMs)) ? Number(latencyMs) : prev.latencyMs || null,
    successes: (prev.successes || 0) + (status === 'working' ? 1 : 0),
    failures: (prev.failures || 0) + (status === 'down' ? 1 : 0),
    detail: 'client-report'
  });
  schedulePersist();
  return true;
}

function logicalChannelId(ch) {
  const tvg = cleanId(ch.tvgId || '');
  if (tvg) return `tvg:${tvg}`;
  return `name:${cleanId(String(ch.name || '').replace(/\b(hd|sd|fhd|uhd|4k|east|west)\b/ig, ' '))}`;
}

function sourcePreference(ch) {
  let score = Number(ch.rank || 0);
  if (ch.health === 'working') score += 1000;
  if (ch.provider === 'Scout Verified') score += 320;
  if (ch.provider === 'Featured National') score += 220;
  if (ch.provider === 'Curated') score += 80;
  if (ch.provider === 'National & Global') score += 40;
  if (ch.provider === 'Local IPTV') score += 20;
  if (Number.isFinite(ch.latencyMs)) score += Math.max(0, 30 - Math.min(30, ch.latencyMs / 100));
  return score;
}

function collapseLogicalChannels(channels) {
  const groups = new Map();
  for (const ch of channels) {
    const key = logicalChannelId(ch);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(ch);
  }
  const out = [];
  for (const group of groups.values()) {
    group.sort((a,b) => sourcePreference(b) - sourcePreference(a));
    const best = group[0];
    const inheritedLogo = best.logo || group.find(x => x.logo)?.logo || '';
    const inheritedDescription = best.description || group.find(x => x.description)?.description || best.name;
    const providers = [...new Set(group.map(x => x.provider || x.source).filter(Boolean))];
    const alternatives = group.slice(1).map(x => ({
      provider: x.provider || x.source || 'Alternate',
      url: x.player?.url || '',
      health: x.health,
      latencyMs: x.latencyMs || null
    }));
    out.push({ ...best, logo: inheritedLogo, description: inheritedDescription, providers, alternatives, sourceCount: group.length });
  }
  return out;
}

export async function getLiveChannels(options={}) {
  await ensureHealthLoaded();
  const forceRefresh = options.force === true || String(options.force || '') === '1';
  if (forceRefresh) {
    cache = { key: '', at: 0, channels: [] };
    playlistCaches = new Map();
  }
  const country = cleanId(options.country || process.env.LIVE_COUNTRY || 'us') || 'us';
  const playlistUrl = process.env.LIVE_M3U_URL || `https://iptv-org.github.io/iptv/countries/${country}.m3u` || DEFAULT_PLAYLIST;
  const key = playlistUrl;
  let dynamic = [];
  if (!forceRefresh && cache.key === key && Date.now() - cache.at < PLAYLIST_TTL_MS) {
    dynamic = cache.channels;
  } else {
    try {
      dynamic = await fetchPlaylist(playlistUrl);
      cache = { key, at: Date.now(), channels: dynamic };
    } catch (error) {
      if (cache.channels.length) dynamic = cache.channels;
      else throw error;
    }
  }

  // Keep the original country feed exactly as-is, then layer a second
  // provider beside it for higher-value national/global channels. The
  // second layer is additive: it never replaces local/regional streams.
  const nationalFeeds = [
    ['sports', process.env.LIVE_SPORTS_M3U_URL || 'https://iptv-org.github.io/iptv/categories/sports.m3u'],
    ['news', process.env.LIVE_NEWS_M3U_URL || 'https://iptv-org.github.io/iptv/categories/news.m3u'],
    ['entertainment', process.env.LIVE_ENTERTAINMENT_M3U_URL || 'https://iptv-org.github.io/iptv/categories/entertainment.m3u'],
    ['movies', process.env.LIVE_MOVIES_M3U_URL || 'https://iptv-org.github.io/iptv/categories/movies.m3u'],
    ['kids', process.env.LIVE_KIDS_M3U_URL || 'https://iptv-org.github.io/iptv/categories/kids.m3u']
  ];

  const nationalGroups = await Promise.all(nationalFeeds.map(async ([name, url]) => {
    const cacheKey = `national:${url}`;
    const rec = playlistCaches.get(cacheKey);
    if (rec && Date.now() - rec.at < PLAYLIST_TTL_MS && rec.channels.length) return rec.channels;
    try {
      const channels = await fetchPlaylist(url, `national-${name}`, 'National & Global');
      playlistCaches.set(cacheKey, { at: Date.now(), channels });
      return channels;
    } catch {
      return rec?.channels || [];
    }
  }));

  const extraFeeds = await extraProviderFeeds();
  const extraGroups = await Promise.all(extraFeeds.map(async ({ name, url }) => {
    const cacheKey = `extra:${url}`;
    const rec = playlistCaches.get(cacheKey);
    if (rec && Date.now() - rec.at < PLAYLIST_TTL_MS && rec.channels.length) return rec.channels;
    try {
      const channels = await fetchPlaylist(url, `extra-${cleanId(name)}`, name);
      playlistCaches.set(cacheKey, { at: Date.now(), channels });
      return channels;
    } catch {
      return rec?.channels || [];
    }
  }));

  const featured = await featuredNationalChannels();
  const configured = (await configuredChannels()).map(ch => ({ provider: ch.provider || 'Curated', ...ch }));
  const physical = dedupe([
    ...configured,
    ...featured,
    ...dynamic.map(ch => ({ provider: ch.provider || 'Local IPTV', ...ch })),
    ...nationalGroups.flat(),
    ...extraGroups.flat()
  ]);

  // Do not block the Live page on network health probes. Cached health is returned immediately;
  // warm-up and stale checks continue in the background.
  warmVerifiedChannels(physical, 16).catch(() => {});
  scheduleHealthRefresh(physical);
  let channels = collapseLogicalChannels(physical.map(enrichHealth));

  const category = String(options.category || '').trim().toLowerCase();
  const q = String(options.q || '').trim().toLowerCase();
  if (category && category !== 'all') channels = channels.filter(ch => String(ch.category || '').toLowerCase().includes(category));
  if (q) channels = channels.filter(ch => `${ch.name} ${ch.category} ${ch.country}`.toLowerCase().includes(q));
  channels.sort((a,b) => b.rank - a.rank || a.name.localeCompare(b.name));
  const limit = Math.max(1, Math.min(Number(options.limit || process.env.LIVE_LIMIT || 240), 500));
  return channels.slice(0, limit);
}



const STREAMED_API_BASE = String(process.env.STREAMED_API_BASE || 'https://streamed.pk/api').replace(/\/$/, '');
const STREAMED_CACHE_TTL_MS = 60 * 1000;
let streamedMatchesCache = { at: 0, matches: [] };

const STREAMED_SPORT_MAP = new Map([
  ['football','soccer'],
  ['soccer','soccer'],
  ['american-football','football'],
  ['american football','football'],
  ['basketball','basketball'],
  ['baseball','baseball'],
  ['hockey','hockey'],
  ['ice-hockey','hockey'],
  ['tennis','tennis'],
  ['rugby','rugby'],
  ['golf','golf'],
  ['cricket','cricket'],
  ['motor-sports','motorsports'],
  ['motorsports','motorsports'],
  ['fight','fighting'],
  ['boxing','fighting'],
  ['mma','fighting']
]);

function streamedSport(category='') {
  const raw = String(category || '').toLowerCase().trim();
  return STREAMED_SPORT_MAP.get(raw) || raw.replace(/\s+/g,'-') || 'other';
}

function streamedTeam(team={}) {
  return {
    id: String(team?.id || ''),
    name: String(team?.name || ''),
    shortName: String(team?.name || ''),
    abbreviation: '',
    logo: team?.badge ? `${STREAMED_API_BASE}/images/badge/${encodeURIComponent(team.badge)}.webp` : ''
  };
}

function streamedEvent(match={}, liveIds=new Set()) {
  const dateMs = Number(match.date || 0);
  const category = streamedSport(match.category);
  const home = streamedTeam(match.teams?.home || {});
  const away = streamedTeam(match.teams?.away || {});
  return {
    id: `streamed-${cleanId(match.id || `${match.title}-${dateMs}`)}`,
    externalId: String(match.id || ''),
    league: category === 'football' ? 'Football' : category === 'soccer' ? 'Soccer' : (category ? category[0].toUpperCase()+category.slice(1) : 'Sports'),
    sport: category,
    name: String(match.title || `${away.name} vs ${home.name}` || 'Live event'),
    shortName: String(match.title || `${away.name} vs ${home.name}` || 'Live event'),
    date: Number.isFinite(dateMs) && dateMs > 0 ? new Date(dateMs).toISOString() : '',
    state: liveIds.has(String(match.id || '')) ? 'in' : 'pre',
    detail: liveIds.has(String(match.id || '')) ? 'Live now' : 'Upcoming',
    broadcasts: [],
    away,
    home,
    provider: 'Streamed',
    stateSource: 'streamed',
    streamedPopular: Boolean(match.popular),
    streamedPoster: match.poster ? `${STREAMED_API_BASE}/images/poster/${encodeURIComponent(match.poster)}.webp` : '',
    streamedSources: Array.isArray(match.sources) ? match.sources
      .filter(x => x?.source && x?.id)
      .map(x => ({ source: String(x.source), id: String(x.id) })) : []
  };
}

function tokenSet(value='') {
  const stop = new Set(['vs','v','at','the','fc','cf','sc','club','united']);
  return new Set(String(value || '').toLowerCase().replace(/[^a-z0-9]+/g,' ').split(/\s+/).filter(x => x.length > 1 && !stop.has(x)));
}

function overlapScore(a,b) {
  const A=tokenSet(a), B=tokenSet(b);
  if (!A.size || !B.size) return 0;
  let hit=0; for (const x of A) if (B.has(x)) hit++;
  return hit / Math.max(1, Math.min(A.size, B.size));
}

function attachStreamedSources(espnEvents, streamedEvents) {
  const used = new Set();
  const merged = espnEvents.map(ev => {
    let best = null, bestScore = 0;
    const t = Date.parse(ev.date || '');
    for (const se of streamedEvents) {
      if (se.sport !== ev.sport) continue;
      const st = Date.parse(se.date || '');
      if (Number.isFinite(t) && Number.isFinite(st) && Math.abs(t-st) > 6*60*60*1000) continue;
      const score = Math.max(overlapScore(ev.shortName || ev.name, se.shortName || se.name),
        (overlapScore(ev.home?.name, se.home?.name) + overlapScore(ev.away?.name, se.away?.name))/2,
        (overlapScore(ev.home?.name, se.away?.name) + overlapScore(ev.away?.name, se.home?.name))/2);
      if (score > bestScore) { bestScore=score; best=se; }
    }
    if (best && bestScore >= .58) {
      used.add(best.id);
      return {
        ...ev,
        streamedSources: best.streamedSources,
        streamedPopular: best.streamedPopular,
        streamedEventId: best.externalId,
        provider: 'ESPN + Streamed'
      };
    }
    return ev;
  });
  // Keep Streamed-only events too. That lets Velora surface sports ESPN's
  // schedule feed does not cover, while still using the same Live & Upcoming UI.
  for (const ev of streamedEvents) if (!used.has(ev.id)) merged.push(ev);
  return merged;
}

async function fetchStreamedJson(pathname, timeout=7000) {
  const r = await fetch(`${STREAMED_API_BASE}${pathname}`, {
    headers: { 'User-Agent': 'Velora/1.0', 'Accept': 'application/json' },
    signal: AbortSignal.timeout(timeout)
  });
  if (!r.ok) throw new Error(`Streamed API returned ${r.status}`);
  return r.json();
}

async function fetchStreamedMatches() {
  if (Date.now() - streamedMatchesCache.at < STREAMED_CACHE_TTL_MS) return streamedMatchesCache.matches;
  try {
    const [all, live] = await Promise.all([
      fetchStreamedJson('/matches/all'),
      fetchStreamedJson('/matches/live').catch(() => [])
    ]);
    const liveIds = new Set((Array.isArray(live) ? live : []).map(x => String(x?.id || '')));
    const now = Date.now();
    const events = (Array.isArray(all) ? all : []).map(x => streamedEvent(x, liveIds)).filter(ev => {
      const t=Date.parse(ev.date || '');
      return ev.streamedSources?.length && Number.isFinite(t) && t > now - 8*60*60*1000 && t < now + 7*24*60*60*1000;
    });
    streamedMatchesCache = { at: Date.now(), matches: events };
    return events;
  } catch {
    return streamedMatchesCache.matches || [];
  }
}

export async function getStreamedSportsStreams(source, id) {
  const safeSource = String(source || '').toLowerCase();
  const safeId = String(id || '');
  if (!/^[a-z][a-z0-9_-]{0,30}$/.test(safeSource) || !safeId || safeId.length > 240) return [];
  try {
    const value = await fetchStreamedJson(`/stream/${encodeURIComponent(safeSource)}/${encodeURIComponent(safeId)}`);
    return (Array.isArray(value) ? value : []).filter(x => x?.embedUrl).map(x => ({
      id: String(x.id || ''),
      streamNo: Number(x.streamNo || 0),
      language: String(x.language || ''),
      hd: Boolean(x.hd),
      embedUrl: String(x.embedUrl),
      source: String(x.source || safeSource)
    }));
  } catch { return []; }
}

const SPORTS_CACHE_TTL_MS = 2 * 60 * 1000;
let sportsCache = { at: 0, snapshot: { events: [], focus: { mode: 'channels', label: 'Live TV', sport: null } } };

const ESPN_LEAGUES = [
  ['MLB','baseball','mlb','baseball'],
  ['NFL','football','nfl','football'],
  ['NCAAF','football','college-football','football'],
  ['NBA','basketball','nba','basketball'],
  ['WNBA','basketball','wnba','basketball'],
  ['NHL','hockey','nhl','hockey'],
  ['MLS','soccer','usa.1','soccer'],
  ['Liga MX','soccer','mex.1','soccer'],
  ['Premier League','soccer','eng.1','soccer'],
  ['Champions League','soccer','uefa.champions','soccer'],
  ['LaLiga','soccer','esp.1','soccer'],
  ['Bundesliga','soccer','ger.1','soccer'],
  ['Serie A','soccer','ita.1','soccer']
];

function teamFromCompetitor(comp={}) {
  const t = comp.team || {};
  const logo = Array.isArray(t.logos) ? t.logos[0]?.href : (t.logo || '');
  return {
    id: t.id || '',
    name: t.displayName || t.shortDisplayName || t.name || '',
    shortName: t.shortDisplayName || t.name || '',
    abbreviation: t.abbreviation || '',
    logo
  };
}

function collectBroadcasts(competition={}) {
  const names = [];
  for (const b of competition.broadcasts || []) for (const n of b.names || []) names.push(n);
  for (const b of competition.geoBroadcasts || []) {
    if (b?.media?.shortName) names.push(b.media.shortName);
    if (b?.media?.name) names.push(b.media.name);
  }
  return [...new Set(names.filter(Boolean))];
}

function espnDateRange(daysAhead = 7) {
  const start = new Date();
  start.setUTCHours(0,0,0,0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + daysAhead);
  const fmt = d => `${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,'0')}${String(d.getUTCDate()).padStart(2,'0')}`;
  return `${fmt(start)}-${fmt(end)}`;
}

async function fetchEspnLeague([league, sport, slug, sportGroup]) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${slug}/scoreboard?limit=1000&dates=${espnDateRange(7)}`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Velora/1.0' }, signal: AbortSignal.timeout(6000) });
    if (!r.ok) return [];
    const data = await r.json();
    return (data.events || []).map(ev => {
      const competition = ev.competitions?.[0] || {};
      const competitors = competition.competitors || [];
      const away = teamFromCompetitor(competitors.find(x => x.homeAway === 'away') || competitors[0]);
      const home = teamFromCompetitor(competitors.find(x => x.homeAway === 'home') || competitors[1]);
      const state = ev.status?.type?.state || 'pre';
      return {
        id: `${league.toLowerCase().replace(/\W+/g,'-')}-${ev.id}`,
        league,
        sport: sportGroup,
        name: ev.name || `${away.shortName} vs ${home.shortName}`,
        shortName: ev.shortName || `${away.shortName} vs ${home.shortName}`,
        date: ev.date || competition.date || '',
        state,
        detail: ev.status?.type?.shortDetail || ev.status?.type?.detail || '',
        broadcasts: collectBroadcasts(competition),
        stateSource: 'espn',
        away,
        home
      };
    });
  } catch { return []; }
}

function footballDayBoost(now=new Date()) {
  const month = now.getMonth() + 1;
  const day = now.getDay(); // 0 Sun ... 6 Sat
  const season = month >= 8 || month <= 2;
  return season && [0,1,4,6].includes(day) ? 8 : 0;
}

function eventWeight(ev, now=Date.now()) {
  const t = Date.parse(ev.date || '');
  if (!Number.isFinite(t)) return 0;
  if (ev.state === 'in') return 12;
  const hrs = (t - now) / 3600000;
  if (hrs < -1) return 0;
  if (hrs <= 2) return 8;
  if (hrs <= 6) return 5;
  if (hrs <= 12) return 3;
  if (hrs <= 24) return 1;
  return .25;
}

export function buildSportsFocus(events) {
  const now = Date.now();
  const relevant = events.filter(ev => {
    const delta = Date.parse(ev.date) - now;
    return ev.state === 'in' || (delta >= -60*60*1000 && delta <= 48*3600000);
  });
  if (!relevant.length) return { mode:'channels', label:'Best live channels', sport:null, events:[] };
  const groups = new Map();
  for (const ev of relevant) {
    const rec = groups.get(ev.sport) || { sport:ev.sport, score:0, count:0, live:0, events:[] };
    rec.score += eventWeight(ev, now);
    rec.count++;
    rec.live += ev.state === 'in' ? 1 : 0;
    rec.events.push(ev);
    groups.set(ev.sport, rec);
  }
  const fb = groups.get('football');
  if (fb) fb.score += footballDayBoost(new Date());
  const ranked=[...groups.values()].sort((a,b)=>b.score-a.score || b.count-a.count);
  const top=ranked[0], second=ranked[1];
  const total=ranked.reduce((n,x)=>n+x.score,0) || 1;
  const dominant = top && top.count >= 3 && (top.score/total >= .48 || !second || top.score >= second.score*1.55);
  if (dominant) {
    const label = top.sport === 'football' ? 'Football takes over' : `${top.sport[0].toUpperCase()+top.sport.slice(1)} is live`;
    return { mode:'sport', label, sport:top.sport, events:top.events.sort((a,b)=>eventWeight(b,now)-eventWeight(a,now)||Date.parse(a.date)-Date.parse(b.date)) };
  }
  const mixed=[]; const queues=ranked.map(x=>[...x.events].sort((a,b)=>eventWeight(b,now)-eventWeight(a,now)||Date.parse(a.date)-Date.parse(b.date)));
  while (mixed.length<12 && queues.some(q=>q.length)) for (const q of queues) if (q.length && mixed.length<12) mixed.push(q.shift());
  return { mode:'mixed', label:'Big games live & upcoming', sport:null, events:mixed };
}

export async function getUpcomingSports(options={}) {
  const forceRefresh = options.force === true || String(options.force || '') === '1';
  if (!forceRefresh && Date.now() - sportsCache.at < SPORTS_CACHE_TTL_MS) return sportsCache.snapshot;
  if (forceRefresh) { sportsCache = { at: 0, snapshot: { events: [], focus: { mode: 'channels', label: 'Live TV', sport: null } } }; streamedMatchesCache = { at: 0, matches: [] }; }
  const [groups, streamed] = await Promise.all([
    Promise.all(ESPN_LEAGUES.map(fetchEspnLeague)),
    fetchStreamedMatches()
  ]);
  const now = Date.now();
  const espnEvents = groups.flat().filter(ev => {
    const t = Date.parse(ev.date || '');
    return Number.isFinite(t) && t > now - 6 * 60 * 60 * 1000 && t < now + 7 * 24 * 60 * 60 * 1000;
  });
  const events = attachStreamedSources(espnEvents, streamed).filter(ev => {
    const t = Date.parse(ev.date || '');
    return Number.isFinite(t) && t > now - 8 * 60 * 60 * 1000 && t < now + 7 * 24 * 60 * 60 * 1000;
  }).sort((a,b) => {
    const ap = a.streamedSources?.length ? 1 : 0, bp = b.streamedSources?.length ? 1 : 0;
    if (a.state === 'in' && b.state !== 'in') return -1;
    if (b.state === 'in' && a.state !== 'in') return 1;
    if (ap !== bp) return bp-ap;
    return Date.parse(a.date)-Date.parse(b.date);
  }).slice(0, 120);
  const focus = buildSportsFocus(events);
  const snapshot = {
    events,
    streamed: { enabled: true, matched: events.filter(x => x.streamedSources?.length).length },
    focus: { ...focus, events: focus.events.slice(0,12) }
  };
  sportsCache = { at: Date.now(), snapshot };
  return snapshot;
}
