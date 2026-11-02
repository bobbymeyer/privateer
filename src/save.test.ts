/** Saving and loading a run. Run with `npm test`. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decode, encode, SAVE_VERSION } from './save.ts';
import { legalActions } from './rules.ts';
import { portNamed } from './world/map.ts';
import { fight, raid } from './world/meet.ts';
import { advance, createSea, createWorld } from './world/world.ts';

const sea = createSea();

test('a run saved and loaded is the same run, and plays on the same', () => {
  let w = createWorld(sea, 11);
  for (let i = 0; i < 20; i++) {
    if (w.encounter || w.hail) break;
    w = advance(sea, w, sea.map.adj[w.player][0]);
  }
  const back = decode(encode(11, w))!;
  assert.equal(back.seed, 11);
  assert.ok(back.world.chart instanceof Uint8Array);
  assert.deepEqual(back.world, w);
  if (!w.encounter && !w.hail) {
    const to = sea.map.adj[w.player][0];
    assert.deepEqual(advance(sea, back.world, to), advance(sea, w, to));
  }
});

test('a run saved mid-fight picks up mid-fight', () => {
  const w = raid(sea, { ...createWorld(sea, 5), player: portNamed(sea.map, 'Havana') });
  const back = decode(encode(5, w))!.world;
  const a = legalActions(w.encounter!.fight)[0];
  assert.deepEqual(fight(sea, back, a), fight(sea, w, a));
});

test('nothing saved, garbage, or a save from another version: no run', () => {
  assert.equal(decode(null), null);
  assert.equal(decode('{not json'), null);
  const old = JSON.parse(encode(1, createWorld(sea, 1)));
  assert.equal(decode(JSON.stringify({ ...old, version: SAVE_VERSION + 1 })), null);
});
