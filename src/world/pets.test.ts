/** Monkeys and parrots for London. Run with `npm test`. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PET_COST, PET_ROOM, PET_WORTH, buyPet, petDeathChance, petsDay, petsHere } from './pets.ts';
import { raise } from './journey.ts';
import { createSea, createWorld, type WorldState } from './world.ts';
import { lyingAt } from './testing.ts';

const sea = createSea();
const { map } = sea;
const node = (lon: number, lat: number) =>
  map.nodes.filter((n) => !n.port && map.adj[n.id].length).sort((a, b) => Math.hypot(a.lon - lon, a.lat - lat) - Math.hypot(b.lon - lon, b.lat - lat))[0].id;

test('bought on the coast of Brazil and at Sierra Leone, for gold or truck, a few at a time', () => {
  const at = lyingAt(sea, { ...createWorld(sea, 1), gold: 100, truck: 2 }, 'brazil');
  assert.ok(petsHere(sea, at));
  assert.ok(!petsHere(sea, lyingAt(sea, createWorld(sea, 1), 'canaries')));
  let w = buyPet(sea, at, 'monkey');
  assert.equal(w.monkeys, 1);
  assert.equal(w.gold, 100 - PET_COST.monkey);
  w = buyPet(sea, w, 'parrot', 'truck');
  assert.equal(w.parrots, 1);
  assert.equal(w.truck, 1);
  for (let i = 0; i < PET_ROOM - 2; i++) w = buyPet(sea, w, 'parrot');
  assert.throws(() => buyPet(sea, w, 'parrot'), /no room/);
  assert.throws(() => buyPet(sea, lyingAt(sea, createWorld(sea, 1), 'canaries'), 'parrot'), /no monkeys/);
  const hostile = { ...at, peoples: { ...at.peoples, tupinamba: -3 } };
  assert.throws(() => buyPet(sea, hostile, 'parrot'), /won’t trade/);
});

test('the cold kills them, the monkeys first, and the last one gets a line', () => {
  assert.ok(petDeathChance('monkey', -50) > petDeathChance('parrot', -50));
  assert.ok(petDeathChance('parrot', -50) > petDeathChance('parrot', 5));
  const day = (lat: number, lon: number) => {
    let w: WorldState = { ...createWorld(sea, 1), player: node(lon, lat), monkeys: 3, parrots: 3 };
    const r = { rng: 5 };
    for (let d = 0; d < 60; d++) w = petsDay(sea, w, r);
    return w;
  };
  const tropic = day(5, -30);
  const cold = day(-52, -60);
  assert.ok(tropic.monkeys + tropic.parrots > cold.monkeys + cold.parrots);
  assert.equal(cold.monkeys, 0);
  assert.ok(cold.log.some((l) => /last of the monkeys/.test(l.text)));
});

test('sold in London with the spice', () => {
  const w: WorldState = { ...createWorld(sea, 1), monkeys: 2, parrots: 3, player: map.landmarks['plymouth-home'], voyage: { at: 'sierra-leone', bound: 'plymouth-home', visited: ['plymouth', 'sierra-leone'] } };
  const home = raise(sea, w);
  assert.equal(home.monkeys + home.parrots, 0);
  assert.ok(home.log.some((l) => /2 monkeys and 3 parrots sold in London for/.test(l.text)));
  assert.ok(home.log.some((l) => l.text.includes(`for ${2 * PET_WORTH.monkey + 3 * PET_WORTH.parrot}`)));
});

test('a save from before the pets comes forward with none aboard', async () => {
  const { decode, encode } = await import('../save.ts');
  const { monkeys: _m, parrots: _p, ...old } = createWorld(sea, 1);
  const text = JSON.stringify({ ...JSON.parse(encode(1, old as WorldState)), version: 21 });
  const saved = decode(text)!;
  assert.equal(saved.world.monkeys, 0);
  assert.equal(saved.world.parrots, 0);
});
