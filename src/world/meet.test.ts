/** Run with `npm test`. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { legalActions } from '../rules.ts';
import { ports } from './map.ts';
import { PARTED_DAYS, PIRACY_FLOOR, REFIT_DAYS, REPAIR_COST, attack, fight, letPass, repair } from './meet.ts';
import { PARDON_COST, buyPardon, bribe, serves } from './port.ts';
import { GOAL, STANDING_DECAY } from './world.ts';
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

test('a ship that means you no harm comes alongside, and the choice is yours', () => {
  const { w, step, fleet } = setUp();
  const met = advance(sea, w, step);
  assert.equal(met.encounter, null);
  assert.deepEqual(met.hail, { shipId: fleet.id, kind: 'treasure-fleet', nation: 'spain' });
  assert.throws(() => advance(sea, met, step), /alongside/);
});

test('let her pass, and she goes her way', () => {
  const { w, step, fleet } = setUp();
  const passed = letPass(advance(sea, w, step));
  assert.equal(passed.hail, null);
  assert.equal(passed.parted[fleet.id], passed.turn + PARTED_DAYS);
  assert.equal(passed.standing.spain, undefined, 'nobody minds');
  assert.equal(advance(sea, passed, passed.player).hail, null);
});

test('attack her, and her nation remembers whatever comes of it', () => {
  const { w, step } = setUp();
  const fighting = attack(advance(sea, w, step));
  assert.equal(fighting.encounter?.forced, false);
  assert.equal(fighting.encounter?.fight.ship.hull, w.hull, 'you sail in as you are');
  assert.equal(fighting.standing.spain, -1, 'you fired first');
  assert.throws(() => advance(sea, fighting, step), /fight to finish/);
});

test('a guard ship of a nation that wants you attacks on sight', () => {
  let w = advance(sea, createWorld(sea, 1), createWorld(sea, 1).player);
  const step = map.adj[w.player].find((n) => !map.nodes[n].port)!;
  const armada = w.ships.find((s) => s.kind === 'armada')!;
  w = { ...w, standing: { spain: -1 }, ships: w.ships.map((s) => (s.id === armada.id ? { ...s, node: step } : s)) };
  const met = advance(sea, w, step);
  assert.equal(met.hail, null);
  assert.equal(met.encounter?.shipId, armada.id);
  assert.equal(met.encounter?.forced, true);
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
    const alongside = advance(sea, w, step);
    const after = fightOut(attack(alongside));
    const r = after.reckoning!;
    assert.equal(r.shipId, fleet.id);
    // From the gold you had alongside: a day at sea can cost some, in a storm.
    assert.equal(after.gold, alongside.gold + r.payout);
    assert.equal(after.sunk, r.outcome === 'sunk');
    assert.equal(r.nation, 'spain');
    assert.ok(r.attacked);
    assert.equal(after.standing.spain, r.outcome === 'destroyed' ? -2 : -1, 'a point for firing first, another for a sinking');
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

test('fire on an English ship and you are a pirate', () => {
  let w = advance(sea, createWorld(sea, 1), createWorld(sea, 1).player);
  const step = map.adj[w.player].find((n) => !map.nodes[n].port)!;
  const english = w.ships.find((s) => s.kind === 'merchant' && s.nation === 'england')!;
  // Arrived where she was bound, she spends the day there.
  w = { ...w, ships: w.ships.map((s) => (s.id === english.id ? { ...s, node: step, dest: step } : s)) };
  const met = advance(sea, w, step);
  assert.equal(met.hail?.nation, 'england');
  const pirate = fightOut(attack(met));
  assert.ok(pirate.pirate);
  assert.ok((pirate.standing.england ?? 0) <= PIRACY_FLOOR);
  assert.match(pirate.log.at(-1)!.text, /pirate/);

});

test('a pirate: English ports shut, no grudge fades, no bribe works, and London is the gallows — until a pardon', () => {
  const plymouth = createWorld(sea, 1).player;
  let w: WorldState = { ...createWorld(sea, 1), ships: [], trail: [], pirate: true, standing: { england: -3 }, gold: GOAL + PARDON_COST + 50 };
  assert.equal(serves(sea, w), false);
  assert.throws(() => bribe(sea, w), /pardon/);
  // Two months in port: the crew will ask for their shares, and be refused, for this.
  for (let i = 0; i < STANDING_DECAY; i++) w = advance(sea, { ...w, dilemma: null }, w.player);
  w = { ...w, dilemma: null };
  assert.equal(w.standing.england, -3, 'it does not fade');
  // Sail into London rich, but a pirate: no win.
  const london = map.nodes.find((n) => n.port?.name === 'London')!.id;
  const off = map.adj[london][0];
  assert.equal(advance(sea, { ...w, player: off }, london).won, false);
  // A pardon, bought in Plymouth.
  w = buyPardon(sea, { ...w, player: plymouth });
  assert.equal(w.pirate, false);
  assert.equal(w.standing.england, 0);
  assert.equal(w.gold, GOAL + 50);
  assert.ok(serves(sea, w));
  assert.equal(advance(sea, { ...w, player: off }, london).won, true);
});
