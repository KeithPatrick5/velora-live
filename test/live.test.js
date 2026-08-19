import test from 'node:test';
import assert from 'node:assert/strict';

const sample = `#EXTM3U
#EXTINF:-1 tvg-id="abc" tvg-logo="https://img.test/abc.png" group-title="News",ABC Test
https://example.test/abc.m3u8
#EXTINF:-1 tvg-id="sports" group-title="Sports",Sports Test
https://example.test/sports.m3u8
`;

test('loads and parses dynamic M3U channels', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => new Response(sample, { status: 200, headers: { 'content-type': 'application/x-mpegURL' } });
  try {
    const { getLiveChannels } = await import(`../src/live/index.js?test=${Date.now()}`);
    const channels = await getLiveChannels({ country: 'us', limit: 20 });
    const abc = channels.find(c => c.name === 'ABC Test');
    assert.ok(abc);
    assert.equal(abc.category, 'News');
    assert.equal(abc.player.type, 'stream');
    assert.match(abc.player.url, /\.m3u8$/);
    assert.ok(channels.some(c => c.name === 'Sports Test'));
    assert.ok(channels.length >= 2);
  } finally {
    global.fetch = originalFetch;
  }
});
