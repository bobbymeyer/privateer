/** The voyage day by day: the start, continuing on, a sail sighted, a raid, the landmarks' offers. Run with `npm test`. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { legalActions } from '../rules.ts';
import { SHIP_CLASSES, SHIPS, deckSize } from '../outfit.ts';
import { continueOn } from './course.ts';
import { HOME_LANDMARK, LANDMARKS } from './landmarks.ts';
import { attack, fight, hostile, letPass, raid, raidHere, SIGHT_CHANCE, sailSighted, watersAt } from './meet.ts';
import { capacity, marketHere, shoreHere } from './stores.ts';
import { lyingAt, victualled } from './testing.ts';
import { createSea, createWorld, dateOf, type WorldState, waiting } from './world.ts';

const sea = createSea();
const { map } = sea;
const node = (lon: number, lat: number) =>
  map.nodes.filter((n) => !n.port && map.adj[n.id].length).sort((a, b) => Math.hypot(a.lon - lon, a.lat - lat) - Math.hypot(b.lon - lon, b.lat - lat))[0].id;

test('you choose your ship as the trail has you choose a trade: a smaller one, a bigger purse and score', () => {
  const [p, s, b] = SHIPS.map((k) => createWorld(sea, 1, k));
  assert.deepEqual(SHIPS, ['pinnace', 'sloop', 'brigantine']);
  assert.ok(p.gold > s.gold && s.gold > b.gold);
  assert.ok(SHIP_CLASSES.pinnace.multiplier > SHIP_CLASSES.sloop.multiplier && SHIP_CLASSES.sloop.multiplier > SHIP_CLASSES.brigantine.multiplier);
  assert.ok(p.maxHull < s.maxHull && s.maxHull < b.maxHull);
  assert.ok(capacity(p).food < capacity(b).food);
  assert.ok(deckSize('pinnace') < deckSize('brigantine'));
  assert.ok(p.crew < b.crew);
  for (const w of [p, s, b]) assert.equal(w.voyage.at, 'plymouth');
  assert.throws(() => createWorld(sea, 1, 'frigate'), /no such ship/);
  assert.equal(dateOf(0), '1 December 1580');
  assert.equal(dateOf(31), '1 January 1581');
});

test('every landmark says what it offers, and the stores read it', () => {
  for (const l of LANDMARKS) assert.ok(l.offers, l.key);
  const w = createWorld(sea, 1);
  assert.equal(marketHere(sea, w), 'chandler');
  assert.deepEqual(shoreHere(sea, lyingAt(sea, w, 'brazil')), ['water', 'forage', 'careen']);
  assert.equal(marketHere(sea, lyingAt(sea, w, 'ladrones')), 'islanders');
  assert.equal(raidHere(sea, lyingAt(sea, w, 'callao'))?.kind, 'town');
  assert.equal(raidHere(sea, lyingAt(sea, w, 'manila'))?.kind, 'fortress');
  assert.equal(raidHere(sea, lyingAt(sea, w, 'brazil')), null);
  // Lying off it, not just passing over its node on the way somewhere else.
  assert.equal(marketHere(sea, { ...w, player: map.landmarks.ladrones }), null);
});

test('continue on: the ship is bound for the next landmark where the way is one, and asks at a fork', () => {
  let w = victualled(createWorld(sea, 3));
  const out = continueOn(sea, w);
  assert.equal(out.world.voyage.bound, 'canaries');
  assert.equal(out.world.turn, 1);
  assert.throws(() => continueOn(sea, lyingAt(sea, w, 'san-julian')), /divides/);
  // On to the Canaries, stopping for whatever stops her.
  const halts = new Set<string>();
  for (let day = 0; day < 200 && w.voyage.at === 'plymouth'; day++) {
    const step = continueOn(sea, w);
    w = step.world;
    if (step.halt) halts.add(step.halt);
    if (w.dilemma) w = { ...w, dilemma: null };
    if (w.hail) w = letPass(w);
    if (w.encounter) w = { ...w, encounter: null };
    assert.ok(!w.sunk);
  }
  assert.equal(w.voyage.at, 'canaries');
  assert.ok(halts.has('landmark'));
  assert.equal(w.player, map.landmarks.canaries);
});

test('waiting on something, the voyage does not go on', () => {
  const w = createWorld(sea, 1);
  assert.throws(() => continueOn(sea, { ...w, dilemma: { kind: 'storm' } }), /choice/);
  assert.throws(() => continueOn(sea, { ...w, hail: { kind: 'merchant', nation: 'portugal' } }), /sail/);
  assert.ok(waiting({ ...w, hail: { kind: 'merchant', nation: 'portugal' } }));
});

test('a sail sighted, by the waters you are in', () => {
  const sights = (lon: number, lat: number) => {
    const seen: Record<string, number> = {};
    const w = { ...createWorld(sea, 1), player: node(lon, lat) };
    for (let rng = 0; rng < 3000; rng++) {
      const s = sailSighted(sea, { ...w, rng });
      const h = s.hail ?? s.encounter;
      if (h) seen[`${h.nation} ${h.kind}`] = (seen[`${h.nation} ${h.kind}`] ?? 0) + 1;
    }
    return seen;
  };
  const iberia = sights(-12, 38);
  assert.ok(iberia['spain privateer'] && iberia['portugal privateer'] && iberia['barbary corsair'], JSON.stringify(iberia));
  const brazil = sights(-38, -15);
  assert.deepEqual(Object.keys(brazil), ['portugal merchant']);
  const total = Object.values(brazil)[0];
  assert.ok(total > 3000 * SIGHT_CHANCE * 0.7 && total < 3000 * SIGHT_CHANCE * 1.3, `${total} sails in 3000 days`);
  assert.deepEqual(Object.keys(sights(-78, -20)), ['spain merchant']);
  const east = sights(110, 0);
  assert.ok(east['portugal merchant'] && east['portugal treasure-ship']);
  assert.deepEqual(sights(-140, 20), {}, 'the empty Pacific');
  assert.equal(watersAt(sea, { ...createWorld(sea, 1), player: node(-140, 20) }), null);
});

test('a privateer comes at you; a merchant is yours to attack or let pass', () => {
  const w = { ...createWorld(sea, 1), player: node(-12, 38) };
  let fought: WorldState | null = null;
  for (let rng = 0; rng < 3000 && !fought; rng++) {
    const s = sailSighted(sea, { ...w, rng });
    if (s.encounter) fought = s;
  }
  assert.ok(hostile(fought!.encounter!.kind));
  assert.ok(fought!.encounter!.forced);
  assert.equal(fought!.hail, null);
  const brazil = { ...createWorld(sea, 1), player: node(-38, -15) };
  let hailed: WorldState | null = null;
  for (let rng = 0; rng < 3000 && !hailed; rng++) {
    const s = sailSighted(sea, { ...brazil, rng });
    if (s.hail) hailed = s;
  }
  assert.equal(hailed!.encounter, null);
  assert.equal(attack(hailed!).encounter!.kind, 'merchant');
  assert.equal(attack(hailed!).encounter!.forced, false);
  assert.equal(letPass(hailed!).hail, null);
});

test('no sail at a landmark or in port', () => {
  const w = lyingAt(sea, createWorld(sea, 1), 'brazil');
  for (let rng = 0; rng < 500; rng++) {
    const s = sailSighted(sea, { ...w, rng });
    assert.ok(!s.hail && !s.encounter);
  }
});

test('a town on the way is raided once, whatever comes of it; taken, its storehouses and its gold', () => {
  for (let seed = 0; seed < 40; seed++) {
    let w: WorldState = { ...lyingAt(sea, createWorld(sea, 1, 'brigantine'), 'callao'), rng: seed, hull: 40, maxHull: 40, fresh: 50 };
    w = raid(sea, w);
    assert.deepEqual(w.raided, ['callao']);
    assert.equal(raidHere(sea, w), null);
    assert.throws(() => raid(sea, { ...w, encounter: null }), /no town/);
    const gold = w.gold;
    while (w.encounter) w = fight(sea, w, legalActions(w.encounter.fight)[0]);
    if (w.reckoning?.outcome !== 'destroyed') continue;
    assert.ok(w.gold > gold);
    assert.equal(w.fresh, 0, 'the storehouses are fresh food');
    assert.ok(w.reckoning.said.some((t) => /sacked/.test(t)));
    assert.equal(w.tally.sacks, 1);
    return;
  }
  assert.fail('no sack in 40 tries');
});

test('raising Plymouth again ends the run', () => {
  const w = { ...createWorld(sea, 1), player: node(-6, 49.5), voyage: { at: 'sierra-leone', bound: HOME_LANDMARK, visited: ['plymouth', 'canaries', 'cape', 'sierra-leone'] } };
  let s = victualled(w);
  for (let day = 0; day < 30 && !s.won; day++) {
    const out = continueOn(sea, s);
    s = { ...out.world, dilemma: null, hail: null, encounter: null };
  }
  assert.ok(s.won);
  assert.equal(s.ending, 'home');
});
