/** The treasure ship off Cape San Francisco. Run with `npm test`. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TARGETS } from '../setup.ts';
import { raise } from './journey.ts';
import { attack, letPass } from './meet.ts';
import { ASLEEP_HULL, PLATE_CARGO, WARNED_HULL, coastAwake } from './treasure.ts';
import { createSea, createWorld, type WorldState } from './world.ts';

const sea = createSea();
const cape = sea.map.landmarks.cacafuego;
/** Bound from Callao, arriving off the cape. */
const offCape = (over: Partial<WorldState> = {}): WorldState => ({
  ...createWorld(sea, 1),
  player: cape,
  voyage: { at: 'callao', bound: 'cacafuego', visited: ['plymouth', 'valparaiso', 'callao'] },
  ...over,
});

test('raise Cape San Francisco, and the treasure ship comes alongside, asleep', () => {
  const w = raise(sea, offCape());
  assert.equal(w.voyage.at, 'cacafuego');
  assert.deepEqual(w.hail, { kind: 'treasure-ship', nation: 'spain', plate: 'asleep' });
  assert.ok(w.log.some((l) => /takes you for a Spaniard/.test(l.text)));
  const f = attack(w).encounter!.fight;
  assert.equal(f.target.hull, TARGETS['treasure-ship'].hull + ASLEEP_HULL);
  assert.equal(f.target.cargo, TARGETS['treasure-ship'].cargo + PLATE_CARGO);
  assert.ok(f.target.takenWhole, 'she strikes, and her silver comes whole');
  assert.ok(!f.target.fixed, 'but she can still run');
  assert.ok(attack(w).encounter!.plate);
  assert.match(letPass(w).log.at(-1)!.text, /treasure ship/);
});

test('raid the coast on the way, and she is warned', () => {
  const s = offCape({ raided: ['valparaiso'] });
  assert.ok(coastAwake(s));
  assert.ok(!coastAwake(offCape({ raided: ['guatulco', 'manila'] })), 'a raid elsewhere wakes nobody here');
  const w = raise(sea, s);
  assert.equal(w.hail?.plate, 'warned');
  assert.equal(attack(w).encounter!.fight.target.hull, TARGETS['treasure-ship'].hull + WARNED_HULL);
});

test('she comes once', () => {
  const again = raise(sea, offCape({ voyage: { at: 'callao', bound: 'cacafuego', visited: ['plymouth', 'cacafuego', 'callao'] } }));
  assert.equal(again.hail, null);
});
