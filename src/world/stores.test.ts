/** Stores and survival: eating, drinking, the scurvy, the shore and the chandler. Run with `npm test`. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { continueOn } from './course.ts';
import { choose } from './dilemmas.ts';
import {
  CHANDLER, EAT, ISLANDERS_COST, MIN_HANDS, SCURVY_DAYS, ashore, buy, capacity, daysOf, fightCost, marketHere, price, prizeStores, provisionDay, scurvy, shoreHere, startCrew, trade,
} from './stores.ts';
import { lyingAt } from './testing.ts';
import { advance, createSea, createWorld, type WorldState } from './world.ts';

const sea = createSea();
const { map } = sea;
/** A node out in the open Atlantic, no port, no landmark. */
const open = () => map.nodes.find((n) => n.kind === 'ocean' && !n.port && Math.abs(n.lat - 45) < 2 && Math.abs(n.lon + 30) < 2)!.id;
const fresh = (over: Partial<WorldState> = {}): WorldState => ({ ...createWorld(sea, 1), ...over });

test('a new run sails from Plymouth two thirds manned, with two months of food and a month of water', () => {
  const w = fresh();
  assert.equal(w.crew, startCrew('pinnace'));
  assert.equal(w.crew, 20);
  assert.ok(w.crew < capacity(w).food / 180);
  assert.equal(daysOf(w).food, 60);
  assert.equal(daysOf(w).water, 30);
  assert.equal(w.rations, 'full');
  assert.equal(w.pace, 'steady');
});

test('a day eats and drinks a ration a hand, short rations less, and water goes faster in the tropics', () => {
  const r = { rng: 1 };
  const north = fresh({ player: open() });
  const day = provisionDay(sea, north, r);
  assert.equal(day.stores.food, north.stores.food - north.crew);
  assert.equal(day.stores.water, north.stores.water - north.crew);
  assert.equal(day.fresh, 1);
  const short = provisionDay(sea, { ...north, rations: 'short' }, r);
  assert.ok(Math.abs(short.stores.food - (north.stores.food - north.crew * EAT.short)) < 1e-9);
  assert.ok(Math.abs(short.stores.water - (north.stores.water - north.crew * EAT.short)) < 1e-9, 'water rationed too');
  const tropic = map.nodes.find((n) => n.kind === 'ocean' && !n.port && Math.abs(n.lat) < 5)!.id;
  const hot = provisionDay(sea, fresh({ player: tropic }), r);
  assert.ok(north.stores.water - hot.stores.water > north.crew);
});

test('the water gone, the hands die of thirst, and too few hands lose the ship', () => {
  let w = fresh({ player: open(), stores: { food: 1e6, water: 0, spares: 0, powder: 0 } });
  const r = { rng: 7 };
  let days = 0;
  while (!w.sunk && days < 200) {
    w = provisionDay(sea, { ...w, turn: ++days }, r);
  }
  assert.ok(w.sunk, 'lost at last');
  assert.ok(w.crew < MIN_HANDS);
  assert.ok(days < 60, `${days} days without water`);
  assert.ok(w.log.some((l) => /thirst/.test(l.text)));
});

test('scurvy comes on after six weeks without fresh food, and kills', () => {
  const w = fresh({ player: open(), fresh: SCURVY_DAYS - 20, stores: { food: 1e6, water: 1e6, spares: 0, powder: 0 }, crew: 30 });
  assert.equal(scurvy(w), 'none');
  assert.equal(scurvy({ ...w, fresh: SCURVY_DAYS - 5 }), 'coming');
  let v = { ...w, fresh: SCURVY_DAYS + 40 };
  assert.equal(scurvy(v), 'killing');
  const r = { rng: 3 };
  for (let d = 0; d < 30; d++) v = provisionDay(sea, { ...v, turn: d + 1 }, r);
  assert.ok(v.crew < 30, `crew ${v.crew}`);
  assert.ok(v.log.some((l) => /scurvy/.test(l.text)));
});

test('a storm takes the spares before the hull', () => {
  const w = fresh({ player: open(), hull: 10, dilemma: { kind: 'storm' }, stores: { food: 1e6, water: 1e6, spares: 5, powder: 0 } });
  const after = choose(sea, w, 'ride');
  assert.equal(after.hull, 10);
  assert.ok(after.stores.spares < 5);
});

test('at an anchorage you water, forage and careen; at sea, none of it', () => {
  const s = { ...lyingAt(sea, fresh(), 'san-julian'), hull: 5, maxHull: 12, fresh: 30, stores: { food: 100, water: 10, spares: 3, powder: 0 } };
  assert.deepEqual(shoreHere(sea, s), ['water', 'forage', 'careen']);
  assert.deepEqual(shoreHere(sea, { ...s, player: open() }), []);
  const watered = ashore(sea, s, 'water', advance);
  assert.ok(watered.stores.water > s.stores.water + 100);
  assert.ok(watered.turn >= s.turn + 1);
  const fed = ashore(sea, s, 'forage', advance);
  assert.ok(fed.fresh < 10, 'fresh food resets the scurvy');
  const careened = ashore(sea, s, 'careen', advance);
  assert.ok(careened.hull > s.hull);
  assert.ok(careened.stores.spares < s.stores.spares);
  assert.throws(() => ashore(sea, { ...s, player: open() }, 'water', advance), /nothing to water/);
  assert.throws(() => ashore(sea, lyingAt(sea, fresh(), 'strait'), 'forage', advance), /nothing to forage/);
});

test('the chandler at Plymouth sells by the lot, dearer abroad, and no more than she carries', () => {
  const w = fresh({ gold: 100 });
  assert.equal(marketHere(sea, w), 'chandler');
  const bought = buy(sea, w, 'food');
  assert.equal(bought.stores.food, w.stores.food + CHANDLER.food.lot);
  assert.equal(bought.gold, 100 - CHANDLER.food.cost);
  const hands = buy(sea, w, 'hands');
  assert.equal(hands.crew, w.crew + CHANDLER.hands.lot);
  assert.throws(() => buy(sea, { ...w, crew: 30 }, 'hands'), /no room/);
  assert.throws(() => buy(sea, { ...w, gold: 0 }, 'food'), /purse/);
  assert.throws(() => buy(sea, { ...w, stores: capacity(w) }, 'water'), /hold is full/);
  const bantam = lyingAt(sea, w, 'java');
  assert.equal(marketHere(sea, bantam), 'chandler');
  assert.ok(price(bantam, 'food') > price(w, 'food'));
  assert.throws(() => buy(sea, lyingAt(sea, w, 'brazil'), 'food'), /no chandler/);
});

test('islanders trade water and fresh food for a little', () => {
  const w = { ...lyingAt(sea, fresh({ gold: 10, fresh: 60 }), 'ladrones'), stores: { food: 0, water: 0, spares: 0, powder: 0 } };
  assert.equal(marketHere(sea, w), 'islanders');
  const fed = trade(sea, w);
  assert.equal(fed.gold, 10 - ISLANDERS_COST);
  assert.equal(fed.fresh, 0);
  assert.equal(fed.stores.water, capacity(w).water);
  assert.ok(fed.stores.food > 0);
  assert.throws(() => trade(sea, fresh()), /nobody here/);
});

test('pace: easy makes less way, hard makes more', () => {
  const dest = map.landmarks['canaries'];
  const sail = (pace: WorldState['pace']) => {
    let w = fresh({ pace, fresh: -1e6, stores: { food: 1e6, water: 1e6, spares: 99, powder: 0 } });
    for (let d = 0; d < 9; d++) {
      const out = continueOn(sea, { ...w, dilemma: null, hail: null, encounter: null });
      w = { ...out.world, encounter: null, hail: null, dilemma: null };
    }
    return map.distTo(dest)[w.player];
  };
  const [easy, steady, hard] = [sail('easy'), sail('steady'), sail('hard')];
  assert.ok(easy > steady, `easy ${easy}, steady ${steady}`);
  assert.ok(hard < steady, `hard ${hard}, steady ${steady}`);
});

test('a fight spends powder by the shot and hands by the hull lost', () => {
  const w = fresh({ crew: 30, stores: { food: 0, water: 0, spares: 0, powder: 5 } });
  const r = { rng: 1 };
  const after = fightCost(w, 7, 10, r);
  assert.equal(after.stores.powder, 2);
  assert.ok(after.crew >= 30 - 5 && after.crew <= 30 - 4, `crew ${after.crew}`);
  assert.equal(fightCost(w, 30, 0, r).stores.powder, 0, 'never below none');
  assert.deepEqual(fightCost(w, 0, 0, r), w, 'nothing fired, nothing lost');
});

test('a prize fills the hold as far as there is room; a town’s storehouses are fresh, and its well fills the casks', () => {
  const w = fresh({ crew: 20, fresh: 50, stores: { food: 100, water: 100, spares: 0, powder: 0 } });
  const r = { rng: 2 };
  const prize = prizeStores(w, 'merchant', false, r);
  assert.ok(prize.stores.food > 100 && prize.stores.water > 100 && prize.stores.spares > 0);
  assert.equal(prize.fresh, 50, 'biscuit is not fresh food');
  const town = prizeStores(w, 'town', true, r);
  assert.equal(town.fresh, 0);
  assert.equal(town.stores.water, capacity(w).water);
  const full = prizeStores({ ...w, stores: capacity(w) }, 'privateer', false, r);
  assert.deepEqual(full.stores, capacity(w));
});
