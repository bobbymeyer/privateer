/** The treasure ship off Cape San Francisco. Run with `npm test`. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { raise } from './journey.ts';
import { portNamed } from './map.ts';
import { attack } from './meet.ts';
import { ASLEEP_HULL, PLATE_CARGO, PLATE_ROUTE, WARNED_HULL, coastAwake, overhaul } from './treasure.ts';
import { createSea, createWorld, type WorldState } from './world.ts';
import { TARGETS } from '../setup.ts';

const sea = createSea();
const { map } = sea;
const cape = map.landmarks.cacafuego;
/** Bound from Callao, one step off the cape. */
const offCape = (over: Partial<WorldState> = {}): WorldState => ({
  ...createWorld(sea, 1),
  player: cape,
  voyage: { at: 'callao', bound: 'cacafuego', visited: ['plymouth', 'valparaiso', 'callao'] },
  ...over,
});

test('she sails alone, a galleon of the South Sea', () => {
  const ship = createWorld(sea, 1).ships.find((x) => x.routeName === PLATE_ROUTE)!;
  assert.equal(ship.kind, 'treasure-ship');
  assert.equal(ship.nation, 'spain');
});

test('raise Cape San Francisco, and the treasure ship comes alongside, asleep', () => {
  const w = raise(sea, offCape());
  assert.equal(w.voyage.at, 'cacafuego');
  assert.equal(w.hail?.plate, 'asleep');
  assert.equal(w.ships.find((x) => x.id === w.hail!.shipId)!.node, cape);
  assert.ok(w.log.some((l) => /takes you for a Spaniard/.test(l.text)));
  const f = attack(w).encounter!.fight;
  assert.equal(f.target.hull, TARGETS['treasure-ship'].hull + ASLEEP_HULL);
  assert.equal(f.target.cargo, TARGETS['treasure-ship'].cargo + PLATE_CARGO);
  assert.ok(f.target.takenWhole, 'she strikes, and her silver comes whole');
  assert.ok(!f.target.fixed, 'but she can still run');
});

test('raid the coast on the way, and she is warned', () => {
  const valparaiso = portNamed(map, 'Valparaíso');
  const s = offCape({ sacked: { [valparaiso]: 999 } });
  assert.ok(coastAwake(sea, s));
  assert.ok(!coastAwake(sea, offCape({ sacked: { [portNamed(map, 'Plymouth')]: 999 } })), 'a raid elsewhere wakes nobody here');
  const w = raise(sea, s);
  assert.equal(w.hail?.plate, 'warned');
  assert.equal(attack(w).encounter!.fight.target.hull, TARGETS['treasure-ship'].hull + WARNED_HULL);
});

test('she comes once; taken already, there is no sail', () => {
  const again = raise(sea, offCape({ voyage: { at: 'callao', bound: 'cacafuego', visited: ['plymouth', 'cacafuego', 'callao'] } }));
  assert.equal(again.hail, null);
  const s = offCape();
  const gone = overhaul(sea, { ...s, ships: s.ships.map((x) => (x.routeName === PLATE_ROUTE ? { ...x, laidUp: s.turn + 50 } : x)) });
  assert.equal(gone.hail, null);
  assert.ok(gone.log.some((l) => /no sail/.test(l.text)));
});
