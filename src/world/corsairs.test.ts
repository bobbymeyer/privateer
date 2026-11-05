/** The Barbary corsairs: out of their ports to cruise where the shipping is, and home between. Run with `npm test`. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { portNamed } from './map.ts';
import { CORSAIR_REACH, corsairGround } from './ships.ts';
import { CORSAIR_PORTS, advance, createSea, createWorld, type WorldState } from './world.ts';
import { victualled } from './testing.ts';

const sea = createSea();
const { map } = sea;
const at = (name: string) => portNamed(map, name);

test('corsairs fit out of the Barbary ports and cruise off ports within reach', () => {
  const w = createWorld(sea, 1);
  const corsairs = w.ships.filter((s) => s.kind === 'corsair');
  assert.equal(corsairs.length, CORSAIR_PORTS.length);
  assert.ok(corsairs.every((c) => c.nation === 'barbary' || c.nation === 'morocco'));
  const algiers = corsairs.find((c) => c.home === at('Algiers'))!;
  const seen = new Set<number>();
  for (let i = 0; i < 200; i++) {
    const g = corsairGround(map, { rng: i * 31 + 7 }, algiers);
    assert.ok(map.distTo(algiers.home)[g] <= CORSAIR_REACH);
    assert.notEqual(g, algiers.home);
    seen.add(g);
  }
  assert.ok(seen.size > 5, 'they range about');
});

test('corsairs keep to the sea: no town is raided, and they come and go', () => {
  let w: WorldState = victualled({ ...createWorld(sea, 4) });
  const homes = new Set(w.ships.filter((s) => s.kind === 'corsair').map((s) => s.home));
  let away = 0;
  for (let day = 0; day < 200; day++) {
    w = advance(sea, { ...w, encounter: null, hail: null, dilemma: null, spoil: null }, w.player);
    away += w.ships.filter((s) => s.kind === 'corsair' && !homes.has(s.node)).length;
  }
  assert.ok(!w.log.some((l) => /raided|captives/.test(l.text)));
  assert.ok(away > 0, 'out cruising');
});
