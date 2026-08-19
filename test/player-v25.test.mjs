import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src=fs.readFileSync(new URL('../public/player-enhance-v25.js', import.meta.url),'utf8');
test('movie gate reveals provider soon after iframe insertion',()=>assert.match(src,/setTimeout\(\(\) => \{ if \(document\.contains\(frame\)\) ready\(\); \}, 420\)/));
test('movie gate has short fail-open timeout',()=>assert.match(src,/setTimeout\(removeMoviePortal, 2800\)/));
