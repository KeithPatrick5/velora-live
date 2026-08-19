import test from "node:test";
import assert from "node:assert/strict";
import { buildVideasySource } from "../src/playback/providers/videasy.js";
import { resolvePlayback } from "../src/playback/resolver.js";

test("movie uses Videasy TMDB movie endpoint", () => {
  const source = buildVideasySource({ tmdbId: 27205, mediaType: "movie" });
  assert.equal(source.provider, "videasy");
  assert.equal(source.type, "embed");
  assert.match(source.url, /^https:\/\/player\.videasy\.net\/movie\/27205\?/);
  assert.match(source.url, /overlay=true/);
});

test("show-level playback opens Videasy episode selector", () => {
  const source = buildVideasySource({ tmdbId: 1396, mediaType: "tv" });
  assert.match(source.url, /^https:\/\/player\.videasy\.net\/tv\/1396\?/);
  assert.match(source.url, /episodeSelector=true/);
  assert.match(source.url, /nextEpisode=true/);
  assert.doesNotMatch(source.url, /\/1\/1/);
});

test("explicit episode uses Videasy TV episode endpoint", () => {
  const source = buildVideasySource({ tmdbId: 1396, mediaType: "tv", season: 2, episode: 3 });
  assert.match(source.url, /^https:\/\/player\.videasy\.net\/tv\/1396\/2\/3\?/);
  assert.match(source.url, /episodeSelector=true/);
  assert.match(source.url, /nextEpisode=true/);
});

test("resolver pulls TMDB id from Velora id", async () => {
  const sources = await resolvePlayback({ id: "tmdb-movie-27205", mediaType: "movie", title: "Inception" });
  assert.equal(sources.length, 2);
  assert.equal(sources[0].provider, "vidcore");
  assert.equal(sources[1].provider, "videasy");
  assert.match(sources[0].url, /\/movie\/27205/);
  assert.match(sources[1].url, /\/movie\/27205/);
});

test("invalid TMDB id is rejected", () => {
  assert.throws(() => buildVideasySource({ tmdbId: 0, mediaType: "movie" }), /valid TMDB ID/);
});
