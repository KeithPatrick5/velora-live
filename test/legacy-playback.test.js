import test from "node:test";
import assert from "node:assert/strict";
import { resolvePlayback } from "../src/playback/resolver.js";

const originalFetch = global.fetch;
const originalToken = process.env.TMDB_API_TOKEN;
const originalKey = process.env.TMDB_API_KEY;

test.afterEach(() => {
  global.fetch = originalFetch;
  process.env.TMDB_API_TOKEN = originalToken;
  process.env.TMDB_API_KEY = originalKey;
});

test("legacy movie IDs resolve by title + year to Videasy", async () => {
  process.env.TMDB_API_TOKEN = "token";
  process.env.TMDB_API_KEY = "key";
  global.fetch = async url => {
    const u = new URL(String(url));
    assert.equal(u.pathname, "/3/search/movie");
    assert.equal(u.searchParams.get("query"), "Obsession");
    assert.equal(u.searchParams.get("primary_release_year"), "2025");
    return new Response(JSON.stringify({ results: [{ id: 123456, title: "Obsession", release_date: "2025-01-01" }] }), { status: 200 });
  };
  const sources = await resolvePlayback({ id: "wikipedia-current-Obsession", mediaType: "movie", title: "Obsession", year: "2025" });
  assert.ok(sources.length >= 1);
  assert.ok(sources.some(source => /player\.videasy\.net\/movie\/123456/.test(source.url)));
});

test("TMDB bearer auth falls back to v3 API key on 401", async () => {
  process.env.TMDB_API_TOKEN = "bad-bearer";
  process.env.TMDB_API_KEY = "good-key";
  let calls = 0;
  global.fetch = async (url, init = {}) => {
    calls++;
    const u = new URL(String(url));
    if (calls === 1) {
      assert.equal(init.headers.Authorization, "Bearer bad-bearer");
      return new Response("unauthorized", { status: 401 });
    }
    assert.equal(u.searchParams.get("api_key"), "good-key");
    return new Response(JSON.stringify({ results: [{ id: 27205, title: "Inception" }] }), { status: 200 });
  };
  const sources = await resolvePlayback({ id: "itunes-old-id", mediaType: "movie", title: "Inception", year: "2010" });
  assert.equal(calls, 2);
  assert.match(sources[0].url, /\/movie\/27205/);
});
