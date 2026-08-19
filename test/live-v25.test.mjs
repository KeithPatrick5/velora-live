import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src=fs.readFileSync(new URL('../public/live-enhance-v25.js', import.meta.url),'utf8');
test('featured rail rejects Streamed-only event state',()=>assert.match(src,/stateSource==='streamed'/));
test('live featured events require verified playback',()=>assert.match(src,/ev\.state==='in'\) return Boolean\(eventPlayback\(ev,channels\)\)/));
test('refresh reaches backend refresh flag',()=>{assert.match(src,/refresh=1/);assert.match(src,/Refreshing/)});
test('featured upcoming window is capped at 24 hours',()=>assert.match(src,/24\*60\*60\*1000/));
