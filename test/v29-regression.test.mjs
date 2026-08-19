import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const intro = fs.readFileSync(new URL('../public/intro.html', import.meta.url), 'utf8');
const resolver = fs.readFileSync(new URL('../src/playback/resolver.js', import.meta.url), 'utf8');
const player = fs.readFileSync(new URL('../public/player-enhance-v13.js', import.meta.url), 'utf8');

test('app document does not run the old site-intro overlay', () => {
  assert.doesNotMatch(index, /site-intro-v\d+/);
  assert.match(index, /player-enhance-v13\.js/);
});

test('standalone first-visit intro owns the video before app navigation', () => {
  assert.match(intro, /id="introVideo"/);
  assert.match(intro, /velora-site-intro\.mp4/);
  assert.match(intro, /location\.replace\('\/\?app=1'\)/);
});

test('movie and show resolver is Videasy-only', () => {
  assert.match(resolver, /buildVideasySource/);
  assert.doesNotMatch(resolver, /VidCore|VidLink|VidSrc|buildFallbackSources/);
  assert.match(resolver, /return \[buildVideasySource/);
});

test('the liked v13 playback enhancement remains active', () => {
  assert.ok(player.length > 1000);
  assert.match(player, /velora/);
});
