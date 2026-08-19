import fs from 'node:fs';
import assert from 'node:assert/strict';
import { resolvePlayback } from '../src/playback/resolver.js';

const index = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const intro = fs.readFileSync(new URL('../public/intro.html', import.meta.url), 'utf8');
const player = fs.readFileSync(new URL('../public/player-enhance-v13.js', import.meta.url), 'utf8');
const server = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');

assert(!index.includes('/site-intro-v22.js'));
assert(intro.includes('location.replace(\'/?app=1\')'));
assert(server.includes('url.searchParams.get("app") !== "1"'));
assert(index.includes('/player-enhance-v13.js'));
assert(player.includes('VELORA LIVE') || player.includes('Loading media') || player.length > 1000);

const sources = await resolvePlayback({ id: 'tmdb-movie-672', mediaType: 'movie', title: 'Harry Potter and the Chamber of Secrets', year: 2002 });
assert.equal(sources.length, 2);
assert.equal(sources[0].provider, 'vidcore');
assert.equal(sources[0].url, 'https://www.vidcore.org/embed/movie/672?autoPlay=false&title=false&poster=true&theme=ef1d43');
assert.equal(sources[1].provider, 'videasy');
assert(sources[1].url.includes('/movie/672'));
console.log('v28 regression: standalone intro + VidCore primary + Videasy fallback; v13 player loader preserved');
