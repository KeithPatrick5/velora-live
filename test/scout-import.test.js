import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const file = path.join(process.cwd(), 'data', 'live-channels.json');

test('scout verified channels are real HLS candidates, not placeholders', async () => {
  const channels = JSON.parse(await fs.readFile(file, 'utf8'));
  assert.ok(channels.length >= 8);
  for (const ch of channels) {
    assert.equal(ch.provider, 'Scout Verified');
    assert.match(ch.player.url, /^https:\/\//);
    assert.match(ch.player.url, /\.m3u8(?:$|\?)/);
    assert.doesNotMatch(ch.name, /placeholder/i);
  }
  const names = channels.map(x => x.name);
  assert.ok(names.includes('CBS Sports HQ'));
  assert.ok(names.includes('CBS Sports Golazo Network'));
  assert.ok(names.includes('CBS News 24/7'));
});
