import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const js=fs.readFileSync(new URL('../public/live-enhance-v15.js', import.meta.url),'utf8');

test('featured sports rail does not promote Streamed-only embeds as playable live events',()=>{
  assert.match(js,/Streamed remains a schedule\/discovery source/);
  const block=js.match(/function eventPlayback\(ev,channels\)\{([\s\S]*?)\n  \}/)?.[1]||'';
  assert.match(block,/matchEventChannel/);
  assert.doesNotMatch(block,/streamedSources/);
});

test('unverified live sports are labeled instead of opening a player',()=>{
  assert.match(js,/No verified stream yet/);
  assert.match(js,/if\(!playback\|\|!playableNow\)\{card.disabled=true;return card\}/);
});
