import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('live UI separates live, starting soon, and upcoming events', async () => {
  const js = await fs.readFile(new URL('../public/live-enhance-v15.js', import.meta.url), 'utf8');
  assert.match(js, /STARTING SOON/);
  assert.match(js, /Stream check begins near start/);
  assert.match(js, /resolveStreamedAvailability/);
  assert.match(js, /No verified stream yet/);
  assert.match(js, /matchEventChannel/);
});

test('upcoming cards remain visible without requiring a playback source', async () => {
  const js = await fs.readFile(new URL('../public/live-enhance-v15.js', import.meta.url), 'utf8');
  assert.doesNotMatch(js, /delta<=48\*60\*60\*1000\)\) && eventPlayback/);
  assert.match(js, /card\.disabled=true/);
});

