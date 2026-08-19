import test from 'node:test';
import assert from 'node:assert/strict';
import { getStreamedSportsStreams } from '../src/live/index.js';

test('Streamed stream resolver returns documented embed streams', async () => {
  const oldFetch=global.fetch;
  global.fetch=async url => {
    assert.match(String(url), /streamed\.pk\/api\/stream\/alpha\/game-123$/);
    return new Response(JSON.stringify([
      { id:'s1', streamNo:1, language:'English', hd:true, embedUrl:'https://embed.example/watch/123', source:'alpha' }
    ]), {status:200,headers:{'content-type':'application/json'}});
  };
  try {
    const streams=await getStreamedSportsStreams('alpha','game-123');
    assert.equal(streams.length,1);
    assert.equal(streams[0].embedUrl,'https://embed.example/watch/123');
    assert.equal(streams[0].hd,true);
  } finally { global.fetch=oldFetch; }
});

test('Streamed resolver rejects malformed source identifiers', async () => {
  const streams=await getStreamedSportsStreams('../bad','x');
  assert.deepEqual(streams,[]);
});

test('Live & Upcoming includes Streamed events with playable source refs', async () => {
  const oldFetch=global.fetch;
  const when=Date.now()+30*60*1000;
  global.fetch=async url => {
    const u=String(url);
    if(u.includes('site.api.espn.com')) return new Response(JSON.stringify({events:[]}),{status:200,headers:{'content-type':'application/json'}});
    if(u.endsWith('/api/matches/live')) return new Response(JSON.stringify([]),{status:200,headers:{'content-type':'application/json'}});
    if(u.endsWith('/api/matches/all')) return new Response(JSON.stringify([{id:'m1',title:'Team Red vs Team Blue',category:'basketball',date:when,popular:true,teams:{home:{name:'Team Blue',badge:'blue'},away:{name:'Team Red',badge:'red'}},sources:[{source:'alpha',id:'abc'}]}]),{status:200,headers:{'content-type':'application/json'}});
    throw new Error('unexpected fetch '+u);
  };
  try {
    const fresh=await import(`../src/live/index.js?streamed-integration=${Date.now()}`);
    const result=await fresh.getUpcomingSports();
    assert.equal(result.events.length,1);
    assert.equal(result.events[0].provider,'Streamed');
    assert.deepEqual(result.events[0].streamedSources,[{source:'alpha',id:'abc'}]);
    assert.equal(result.streamed.matched,1);
  } finally { global.fetch=oldFetch; }
});
