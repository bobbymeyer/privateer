/** Saving and loading a run. Run with `npm test`. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decode, encode, SAVE_VERSION } from './save.ts';
import { legalActions } from './rules.ts';
import { continueOn } from './world/course.ts';
import { raid } from './world/meet.ts';
import { fight } from './world/meet.ts';
import { lyingAt } from './world/testing.ts';
import { createSea, createWorld, waiting } from './world/world.ts';

const sea = createSea();

test('a run saved and loaded is the same run, and plays on the same', () => {
  let w = createWorld(sea, 11, 'sloop');
  for (let i = 0; i < 20 && !waiting(w); i++) w = continueOn(sea, w).world;
  const back = decode(encode(11, w, '2026-11-05'))!;
  assert.equal(back.seed, 11);
  assert.equal(back.daily, '2026-11-05');
  assert.deepEqual(back.world, w);
  if (!waiting(w)) assert.deepEqual(continueOn(sea, back.world), continueOn(sea, w));
});

test('a run saved mid-fight picks up mid-fight', () => {
  const w = raid(sea, lyingAt(sea, createWorld(sea, 5), 'valparaiso'));
  const back = decode(encode(5, w))!.world;
  const a = legalActions(w.encounter!.fight)[0];
  assert.deepEqual(fight(sea, back, a), fight(sea, w, a));
});

test('nothing saved, garbage, or a save from another version — the old sandbox included: no run', () => {
  assert.equal(decode(null), null);
  assert.equal(decode('{not json'), null);
  const saved = JSON.parse(encode(1, createWorld(sea, 1)));
  assert.equal(decode(JSON.stringify({ ...saved, version: SAVE_VERSION + 1 })), null);
  assert.equal(decode(JSON.stringify({ ...saved, version: 11 })), null);
});
