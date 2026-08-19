import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../public/player-enhance-v23.js', import.meta.url), 'utf8');
assert.ok(src.includes("querySelectorAll('.livePlayerOverlay')"));
assert.ok(!src.includes("querySelector('.player')"));
assert.ok(!src.includes('veloraPlaybackPortal'));
assert.ok(!src.includes('createPortal('));
console.log('player-enhance-v23: movie/show DOM untouched; live gate retained');
