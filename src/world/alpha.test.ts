/** Outfitting, ports, islands, the win, and setting a course. Run with `npm test`. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CREW, SHIP_CLASSES, START_OUTFIT, UPGRADES, cardsOf, deckOf } from '../outfit.ts';
import { nextStep, plotCourse, sailToward } from './course.ts';
import { portNamed } from './map.ts';
import { bribe, bribeCost, buyShip, buyUpgrade, dismiss, recruit, serves } from './port.ts';
import { ISLANDS, CHARTING_BOUNTY, GOAL, STANDING_DECAY, type WorldState, advance, atIsland, createSea, createWorld } from './world.ts';
import { buyRound } from './bar.ts';
import { repair } from './meet.ts';
import { victualled } from './testing.ts';

const sea = createSea();
const { map } = sea;
const at = (name: string) => portNamed(map, name);
/** An empty sea, so nothing comes alongside. */
const quiet = (w: WorldState): WorldState => victualled({ ...w, ships: [], trail: [] });
const rich = (w: WorldState, gold = 500): WorldState => ({ ...w, gold });

test('your deck is your ship, its refits and your crew', () => {
  const bare = deckOf(START_OUTFIT).length;
  assert.equal(bare, 15);
  const kitted = { ...START_OUTFIT, ship: 'sloop', upgrades: ['guns'], crew: ['gunner', 'marksmen'] };
  const cards = cardsOf(kitted);
  assert.equal(cards['raking-fire'], 2 + 1 + 1);
  assert.equal(cards['double-shot'], 1);
  assert.equal(cards.marksmen, 2);
  // sloop +1, guns +1, gunner +2 (double-shot, reload), marksmen +2
  assert.equal(deckOf(kitted).length, bare + 1 + 1 + 2 + 2);
});

test('hiring, buying a ship and refitting change the deck, the hull and the sight', () => {
  let w = rich(createWorld(sea, 1));
  w = recruit(sea, w, 'navigator');
  assert.equal(w.sight, 2);
  w = recruit(sea, w, 'gunner');
  assert.throws(() => recruit(sea, w, 'surgeon'), /no berth/);
  assert.throws(() => recruit(sea, w, 'gunner'), /already/);
  w = buyShip(sea, w, 'brigantine');
  assert.equal(w.maxHull, SHIP_CLASSES.brigantine.hull);
  assert.equal(w.hull, w.maxHull, 'a new ship comes whole');
  w = buyUpgrade(sea, w, 'sheathing');
  assert.equal(w.maxHull, SHIP_CLASSES.brigantine.hull + UPGRADES.sheathing.hull!);
  assert.throws(() => buyUpgrade(sea, w, 'sheathing'), /no room/);
  w = recruit(sea, w, 'surgeon');
  assert.equal(w.gold, 500 - CREW.navigator.cost - CREW.gunner.cost - SHIP_CLASSES.brigantine.cost - UPGRADES.sheathing.cost - CREW.surgeon.cost);
  w = dismiss(w, 'navigator');
  assert.equal(w.sight, 1);
});

test('a port of a nation that wants you sells you nothing — until you pay', () => {
  let w = rich({ ...createWorld(sea, 1), player: at('Havana'), standing: { spain: -2 } });
  assert.equal(serves(sea, w), false);
  assert.throws(() => buyRound(sea, w), /won't serve/);
  assert.throws(() => repair(sea, { ...w, hull: 1 }), /won't deal/);
  assert.throws(() => recruit(sea, w, 'pilot'), /won't deal/);
  assert.equal(bribeCost(w, 'spain'), 20);
  w = bribe(sea, w);
  w = bribe(sea, w);
  assert.equal(w.standing.spain, 0);
  assert.equal(w.gold, 500 - 20 - 10);
  assert.ok(serves(sea, w));
  // Independent harbours deal with anyone.
  assert.ok(serves(sea, { ...w, player: at('Aceh'), standing: { spain: -9 } }));
});

test('grudges fade', () => {
  let w = quiet({ ...createWorld(sea, 1), standing: { spain: -3, france: 1 } });
  for (let i = 0; i < STANDING_DECAY; i++) w = advance(sea, w, w.player);
  assert.deepEqual(w.standing, { spain: -2, france: 0 });
});

test('a run hides uncharted islands, out in open ocean', () => {
  const w = createWorld(sea, 1);
  assert.equal(w.islands.length, ISLANDS);
  for (const isle of w.islands) {
    const n = map.nodes[isle.node];
    assert.equal(n.kind, 'ocean');
    assert.equal(n.waters, null);
    assert.equal(isle.found, false);
  }
  assert.notDeepEqual(createWorld(sea, 2).islands, w.islands, 'a different run, different islands');
});

test('sighting an island pays, and it is an anchorage after', () => {
  const w = quiet(createWorld(sea, 1));
  const isle = w.islands[0].node;
  const offshore = map.adj[isle][0];
  const sighted = advance(sea, { ...w, player: map.adj[offshore].find((n) => n !== isle) ?? offshore }, offshore);
  assert.ok(sighted.islands[0].found);
  assert.equal(sighted.gold, w.gold + CHARTING_BOUNTY);
  // A castaway on it, maybe: left on his beach, for this.
  const anchored = advance(sea, { ...sighted, dilemma: null, hull: 2 }, isle);
  assert.ok(atIsland(anchored));
  assert.equal(anchored.hull, 3, 'mending a point a day');
});

test('raising Plymouth again, bound home, ends the run; just sailing past it does not', () => {
  const w = quiet(createWorld(sea, 1));
  const plymouth = at('Plymouth');
  const off = map.adj[plymouth][0];
  // Just out of Plymouth and straight back: it's where you started, not home.
  assert.equal(advance(sea, { ...w, player: off }, plymouth).won, false);
  // Turned back from the Cape Verde islands: home, the run is over.
  const turned = { ...w, player: off, voyage: { at: 'cape-verde', bound: 'plymouth-home', visited: ['plymouth', 'canaries', 'cape-verde'] } };
  const home = advance(sea, turned, plymouth);
  assert.equal(home.won, true);
  assert.equal(home.ending, 'home');
  assert.throws(() => advance(sea, home, plymouth), /won/);
});

test('a course sails a day at a time to where you set it', () => {
  let w = quiet(createWorld(sea, 1));
  const dest = at('Lisbon');
  const course = plotCourse(sea, w, dest);
  assert.equal(course[0], w.player);
  assert.equal(course.at(-1), dest);
  assert.equal(course.length - 1, map.distTo(dest)[w.player]);
  let days = 0;
  for (;;) {
    const { world, halt } = sailToward(sea, w, dest);
    w = world;
    days++;
    if (halt) {
      assert.ok(halt === 'arrived' || halt === 'sighted', halt);
      if (halt === 'arrived') break;
    }
    assert.ok(days < 100);
  }
  assert.equal(w.player, dest);
  assert.equal(nextStep(sea, w, dest), null);
});

test('a course stops for a ship', () => {
  // Turn 1: the galeones (slow) don't move on odd days. Lay them on tomorrow's step.
  let w = advance(sea, createWorld(sea, 4), createWorld(sea, 4).player);
  const dest = at('Lisbon');
  const tomorrow = nextStep(sea, w, dest)!;
  const fleet = w.ships.find((s) => s.routeName === 'galeones')!;
  w = { ...w, ships: w.ships.map((s) => (s.id === fleet.id ? { ...s, node: tomorrow } : s)) };
  const { world, halt } = sailToward(sea, w, dest);
  assert.equal(halt, 'hail');
  assert.equal(world.hail?.shipId, fleet.id);
});
