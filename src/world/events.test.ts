/** Events at sea: morale and mutiny, storms and omens, islanders, and the monsters. Run with `npm test`. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AFTER_MUTINY, IDLE_DAYS, MORALE_MAX, MORALE_START, OMEN_CHEER, SOUR_EVERY, aDay, spoils, stormChance } from './events.ts';
import { portNamed } from './map.ts';
import { fight, hostile, meeting } from './meet.ts';
import { PROVISION_COST, provision, provisions, serves } from './port.ts';
import { MONSTER_RANGE, moveShip } from './ships.ts';
import { SEA_NAMES } from './seas.ts';
import { advance, createSea, createWorld, type WorldState } from './world.ts';
import { legalActions } from '../rules.ts';

const sea = createSea();
const { map } = sea;
const at = (name: string) => portNamed(map, name);
const quiet = (w: WorldState): WorldState => ({ ...w, ships: [], trail: [] });
/** Open water in the middle of the Atlantic, nobody's and nowhere near a port. */
const midAtlantic = () => map.nodes.filter((n) => n.kind === 'ocean' && Math.abs(n.lon + 35) < 3 && Math.abs(n.lat - 25) < 3)[0].id;

test('a crew starts content, and a prize puts them up and starts their patience again', () => {
  const w = createWorld(sea, 1);
  assert.equal(w.morale, MORALE_START);
  const after = spoils({ ...w, turn: 50, morale: 3 });
  assert.equal(after.morale, 6);
  assert.equal(after.lastSpoils, 50);
  assert.equal(spoils({ ...w, morale: MORALE_MAX - 1 }).morale, MORALE_MAX);
});

test('too long without a prize and the crew sour, a point every so many days', () => {
  const w = quiet({ ...createWorld(sea, 1), player: midAtlantic() });
  let lost = 0;
  // Days with no storm or omen can't be promised; count only the souring.
  for (let day = 1; day <= IDLE_DAYS + 3 * SOUR_EVERY; day++) {
    const before = { ...w, rng: 12345, turn: day, morale: 9 };
    const after = aDay(sea, before);
    if (after.log.some((l) => l.text.includes('grumbling'))) lost++;
  }
  assert.equal(lost, 4, 'on day 30, 40, 50 and 60');
});

test('at nothing, mutiny: a hand of note hanged or deserted, or the strongroom broken open', () => {
  const base = quiet({ ...createWorld(sea, 1), player: midAtlantic(), turn: IDLE_DAYS, lastSpoils: 0, morale: 1 });
  const crewed = aDay(sea, { ...base, outfit: { ...base.outfit, crew: ['gunner', 'pilot'] } });
  assert.equal(crewed.outfit.crew.length, 1);
  assert.equal(crewed.morale, AFTER_MUTINY);
  assert.ok(crewed.log.some((l) => l.text.startsWith('mutiny')));

  const broke = aDay(sea, { ...base, gold: 100 });
  assert.ok(broke.gold <= 70);
  assert.equal(broke.morale, AFTER_MUTINY);
});

test('storms keep their seasons: hurricanes in the Antilles in autumn, the roaring forties always', () => {
  const antilles = map.nodes.find((n) => n.kind === 'ocean' && Math.abs(n.lon + 70) < 3 && Math.abs(n.lat - 18) < 3)!.id;
  const forties = map.nodes.find((n) => n.kind === 'ocean' && n.lat < -45 && Math.abs(n.lon - 60) < 10)!.id;
  const season = sea.pattern.seasonLength;
  assert.ok(stormChance(sea, antilles, 3 * season) > 2 * stormChance(sea, antilles, 0));
  assert.ok(stormChance(sea, forties, 0) > stormChance(sea, midAtlantic(), 0));
});

test('storms come and ask how to meet them, and an omen cheers the crew, over a long voyage', () => {
  let w = quiet({ ...createWorld(sea, 3), player: midAtlantic(), gold: 1000, morale: 5, hull: 10, maxHull: 10 });
  let storms = 0;
  let omens = 0;
  for (let day = 1; day < 600; day++) {
    const before = { ...w, turn: day, lastSpoils: day, hull: 10, morale: 5, dilemma: null };
    w = aDay(sea, before);
    if (w.dilemma?.kind === 'storm') storms++;
    if (w.morale === 5 + OMEN_CHEER) omens++;
  }
  assert.ok(storms >= 3 && storms <= 20, `storms ${storms}`);
  assert.ok(omens >= 5 && omens <= 30, `omens ${omens}`);
});

test('islanders in Hawaii and across the Pacific trade provisions, not drink or ships', () => {
  for (const name of ['Kealakekua', 'Matavai', 'Nuku’alofa', 'Nuku Hiva', 'Rapa Nui']) assert.equal(map.nodes[at(name)].port!.nation, 'native', name);
  const w = quiet({ ...createWorld(sea, 1), player: at('Kealakekua'), hull: 5, morale: 4, gold: 10 });
  assert.equal(serves(sea, w), false);
  assert.ok(provisions(sea, w));
  const fed = provision(sea, w);
  assert.equal(fed.gold, 10 - PROVISION_COST);
  assert.equal(fed.morale, 7);
  assert.equal(fed.hull, 7);
  assert.throws(() => provision(sea, fed), /today/);
});

test('sometimes the canoes come out to fight instead, and beating them off sacks nothing', () => {
  const port = at('Kealakekua');
  const off = map.adj[port][0];
  let fights = 0;
  let trades = 0;
  for (let seed = 0; seed < 40; seed++) {
    const w = quiet({ ...createWorld(sea, seed), player: off });
    const there = advance(sea, w, port);
    if (!there.encounter) {
      trades++;
      continue;
    }
    fights++;
    assert.equal(there.encounter.kind, 'canoes');
    assert.equal(there.encounter.nation, 'native');
    assert.ok(there.encounter.forced);
    let s: WorldState = { ...there, hull: 99, maxHull: 99, encounter: { ...there.encounter, fight: { ...there.encounter.fight, ship: { ...there.encounter.fight.ship, hull: 99, maxHull: 99 } } } };
    while (s.encounter) s = fight(sea, s, legalActions(s.encounter.fight)[0]);
    assert.equal(s.sacked[port], undefined);
    assert.equal(s.standing.native, undefined, 'no grudge for a fight they started');
  }
  assert.ok(fights >= 4 && trades >= 15, `fights ${fights}, trades ${trades}`);
});

test('a monster keeps each sea, attacks whoever it meets, and wanders with the current but not far', () => {
  const w = createWorld(sea, 1);
  const monsters = w.ships.filter((s) => s.kind === 'monster');
  assert.equal(monsters.length, SEA_NAMES.length);
  assert.deepEqual(monsters.map((m) => m.routeName).sort(), SEA_NAMES.map((s) => s.name).sort());
  for (const m of monsters) assert.ok(hostile(w, m));

  for (const m0 of monsters) {
    const r = { rng: 7 };
    const m = { ...m0 };
    const seen = new Set<number>();
    for (let t = 0; t < 400; t++) {
      moveShip(sea, r, m, t, -1);
      seen.add(m.node);
      assert.ok(map.distTo(m.home)[m.node] <= MONSTER_RANGE + 6, `${m.routeName} strays only a little past its range before turning back`);
    }
    // Monsters keep to the lanes like everyone: a thin network in some seas.
    assert.ok(seen.size > 5, `${m.routeName} wanders`);
  }

  const met = meeting(sea, { ...w, ships: [{ ...monsters[0] }], trail: [[]], player: monsters[0].node });
  assert.equal(met.encounter?.kind, 'monster');
  assert.ok(met.encounter?.forced);
});

test('under sail, a storm or a mutiny brings you to; a fair day does not', async () => {
  const { sailToward } = await import('./course.ts');
  const { choices, choose } = await import('./dilemmas.ts');
  const far = at('Table Bay');
  let halts = 0;
  for (let seed = 0; seed < 6 && halts < 2; seed++) {
    let w = quiet({ ...createWorld(sea, seed), player: at('Plymouth') });
    for (let day = 0; day < 200 && w.player !== far; day++) {
      const before = w;
      const out = sailToward(sea, w, far);
      w = out.world;
      const fresh = w.log.slice(before.log.length);
      if (out.halt === 'news' || out.halt === 'choice') {
        halts++;
        assert.ok(fresh.some((l) => l.stop) || out.world.dilemma);
        // Meet it the first way open, and sail on.
        if (w.dilemma) w = choose(sea, w, choices(w, w.dilemma).find((c) => !c.barred)!.key);
      } else if (out.halt === null) assert.ok(!fresh.some((l) => l.stop), 'news worth stopping for, and she sailed on');
    }
  }
  assert.ok(halts >= 1);
});
