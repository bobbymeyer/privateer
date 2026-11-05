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
    if (w.encounter || w.hail || w.dilemma || w.spoil) break;
    w = advance(sea, w, sea.map.adj[w.player][0]);
  }
  const back = decode(encode(11, w))!;
  assert.equal(back.seed, 11);
  assert.ok(back.world.chart instanceof Uint8Array);
  assert.deepEqual(back.world, w);
  if (!w.encounter && !w.hail && !w.dilemma && !w.spoil) {
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

test('a save from before the voyage is brought up to date: stores aboard, the sandbox gone, and it plays on', () => {
  const w = createWorld(sea, 2);
  const { crew: _c, stores: _s, fresh: _f, rations: _r, pace: _p, calm: _m, ...rest } = w;
  const old = { ...rest, letter: null, acts: 1, commission: 'active', fame: 40, homewardNoised: false, ships: w.ships.map((x) => ({ ...x, raid: null, captives: null })) };
  const v10 = encode(2, old as unknown as typeof w).replace(`"version":${SAVE_VERSION}`, '"version":10');
  const back = decode(v10)!;
  assert.equal(back.version, SAVE_VERSION);
  for (const gone of ['letter', 'acts', 'commission', 'fame', 'homewardNoised']) assert.ok(!(gone in back.world), gone);
  assert.ok(back.world.ships.every((x) => !('captives' in x) && !('raid' in x)));
  assert.equal(back.world.crew, 30);
  assert.equal(back.world.rations, 'full');
  advance(sea, back.world, sea.map.adj[back.world.player][0]);
});

test('a fight saved before the chain picks up with none', () => {
  const w = createWorld(sea, 4);
  const fighting = raid(sea, { ...w, player: portNamed(sea.map, 'Havana') });
  const { chain: _c, ...oldFight } = fighting.encounter!.fight;
  const v8 = encode(4, { ...fighting, encounter: { ...fighting.encounter!, fight: oldFight as NonNullable<typeof fighting.encounter>["fight"] } }).replace(`"version":${SAVE_VERSION}`, '"version":8');
  const back = decode(v8)!;
  assert.deepEqual(back.world.encounter!.fight.chain, { last: null, links: 0 });
  const a = legalActions(back.world.encounter!.fight)[0];
  fight(sea, back.world, a);
});
