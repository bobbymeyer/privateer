/** Run with `npm test`. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { legalActions } from '../rules.ts';
import { ports } from './map.ts';
import { PARTED_DAYS, REFIT_DAYS, REPAIR_COST, fight, repair } from './meet.ts';
import { advance, createSea, createWorld, type WorldState } from './world.ts';

const sea = createSea();
const { map } = sea;

/**
 * A world on turn 1 with the galeones (slow: they don't move on odd turns)
 * lying one step off Plymouth, in open water.
 */
function setUp(seed = 1) {
  let w = advance(sea, createWorld(sea, seed), createWorld(sea, seed).player);
  const step = map.adj[w.player].find((n) => !map.nodes[n].port)!;
  const fleet = w.ships.find((s) => s.routeName === 'galeones')!;
  w = { ...w, ships: w.ships.map((s) => (s.id === fleet.id ? { ...s, node: step } : s)) };
  return { w, step, fleet };
}

const fightOut = (w: WorldState) => {
  while (w.encounter) w = fight(sea, w, legalActions(w.encounter.fight)[0]);
  return w;
};

test('sharing a node with a ship at sea starts the encounter', () => {
  const { w, step, fleet } = setUp();
  const met = advance(sea, w, step);
  assert.equal(met.encounter?.shipId, fleet.id);
  assert.equal(met.encounter?.kind, 'treasure-fleet');
  assert.equal(met.encounter?.fight.ship.hull, w.hull, 'you sail in as you are');
});

test('the world waits while the fight is on', () => {
  const { w, step } = setUp();
  const met = advance(sea, w, step);
  assert.throws(() => advance(sea, met, step), /fight to finish/);
});

test('there are no encounters in port', () => {
  const { w, fleet } = setUp();
  const inPort = { ...w, ships: w.ships.map((s) => (s.id === fleet.id ? { ...s, node: w.player } : s)) };
  assert.equal(advance(sea, inPort, w.player).encounter, null);
  assert.ok(ports(map).includes(w.player));
});

test('a fight is settled into the world', () => {
  for (let seed = 1; seed < 12; seed++) {
    const { w, step, fleet } = setUp(seed);
    const after = fightOut(advance(sea, w, step));
    const r = after.reckoning!;
    assert.equal(r.shipId, fleet.id);
    assert.equal(after.gold, w.gold + r.payout);
    assert.equal(after.sunk, r.outcome === 'sunk');
    assert.equal(r.nation, 'spain');
    assert.equal((after.standing.spain ?? 0) < 0, r.attacked, 'Spain remembers an attack, and only an attack');
    if (r.outcome === 'destroyed') {
      const gone = after.ships[fleet.id];
      assert.equal(gone.node, gone.home);
      assert.equal(gone.laidUp, after.turn + REFIT_DAYS);
    }
    if (r.outcome === 'fled' || r.outcome === 'escaped') {
      assert.equal(after.parted[fleet.id], after.turn + PARTED_DAYS);
      // Lying alongside, they leave you be.
      assert.equal(advance(sea, after, after.player).encounter?.shipId === fleet.id, false);
    }
    if (r.outcome === 'sunk') assert.throws(() => advance(sea, after, after.player), /run is over/);
  }
});

test('damage is carried out of the fight and mended in port, for gold', () => {
  const { w } = setUp();
  // As far as the purse goes: four points' worth.
  const hurt = { ...w, hull: 2, gold: 4 * REPAIR_COST };
  const mended = repair(sea, hurt);
  assert.equal(mended.hull, 6);
  assert.equal(mended.gold, 0);
  assert.throws(() => repair(sea, { ...hurt, player: map.adj[w.player].find((n) => !map.nodes[n].port)! }), /in port/);
});
