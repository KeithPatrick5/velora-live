import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSportsFocus } from '../src/live/index.js';

function ev(sport, mins, league='TEST', state='pre') {
  return { sport, league, state, date:new Date(Date.now()+mins*60000).toISOString(), shortName:`${sport}-${mins}` };
}

test('dominant baseball slate becomes baseball focus', () => {
  const focus=buildSportsFocus([ev('baseball',30,'MLB'),ev('baseball',60,'MLB'),ev('baseball',90,'MLB'),ev('baseball',120,'MLB'),ev('soccer',40,'MLS')]);
  assert.equal(focus.mode,'sport');
  assert.equal(focus.sport,'baseball');
  assert.ok(focus.events.length>=3);
});

test('mixed sports slate stays mixed', () => {
  const focus=buildSportsFocus([ev('baseball',30,'MLB'),ev('soccer',35,'MLS'),ev('basketball',40,'WNBA'),ev('hockey',45,'NHL')]);
  assert.equal(focus.mode,'mixed');
  assert.equal(focus.sport,null);
});

test('empty slate falls back to channels', () => {
  const focus=buildSportsFocus([]);
  assert.equal(focus.mode,'channels');
});
