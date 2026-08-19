import test from "node:test";
import assert from "node:assert/strict";
import { resolvePlayback } from "../src/playback/resolver.js";

test("movie playback returns VidCore primary with Videasy fallback", async () => {
  const sources = await resolvePlayback({ id: "tmdb-movie-672", mediaType: "movie" });
  assert.equal(sources.length, 2);
  assert.equal(sources[0].provider, "vidcore");
  assert.match(sources[0].url, /vidcore\.org\/embed\/movie\/672/);
  assert.equal(sources[1].provider, "videasy");
  assert.match(sources[1].url, /player\.videasy\.net\/movie\/672/);
});

test("tv episode playback preserves season and episode", async () => {
  const sources = await resolvePlayback({ id: "tmdb-tv-1396", mediaType: "tv", season: 2, episode: 3 });
  assert.equal(sources.length, 2);
  assert.match(sources[0].url, /vidcore\.org\/embed\/tv\/1396\/2\/3/);
  assert.match(sources[1].url, /player\.videasy\.net\/tv\/1396\/2\/3/);
});
