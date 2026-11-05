/** The score, and the voyage of the time it's like. Run with `npm test`. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HAND_WORTH, RICH, SHIP_WORTH, score } from './score.ts';
import { SHIP_CLASSES } from '../outfit.ts';
import { createSea, createWorld, type WorldState } from './world.ts';

const sea = createSea();
const base = createWorld(sea, 1);
const home = (over: Partial<WorldState>, visited: string[]): WorldState => ({
  ...base,
  won: true,
  ending: 'home',
  voyage: { at: 'plymouth-home', bound: null, visited: ['plymouth', ...visited, 'plymouth-home'] },
  ...over,
});
const ROUND = ['canaries', 'strait', 'callao', 'ladrones', 'java', 'cape'];

test('treasure, hands and the ship, all told', () => {
  const s = score(home({ gold: 300, crew: 20, hull: 6, maxHull: 12 }, ROUND));
  assert.equal(s.treasure, 300);
  assert.equal(s.hands, 20 * HAND_WORTH);
  assert.equal(s.ship, SHIP_WORTH / 2);
  assert.equal(s.total, (300 + 20 * HAND_WORTH + SHIP_WORTH / 2) * SHIP_CLASSES.pinnace.multiplier);
});

test('round the world, rich, most of the crew home: Drake’s', () => {
  assert.equal(score(home({ gold: RICH, crew: 20 }, ROUND)).like, 'drake');
});

test('rich, but dear in men, or home the way you went: Cavendish’s', () => {
  assert.equal(score(home({ gold: RICH, crew: 10 }, ROUND)).like, 'cavendish');
  assert.equal(score(home({ gold: RICH * 2, crew: 25 }, ['canaries', 'callao', 'strait-east', 'brazil-home'])).like, 'cavendish');
});

test('home without the money: Fenton’s', () => {
  const poor = score(home({ gold: SHIP_CLASSES.pinnace.purse - 10, crew: 25 }, ['canaries', 'brazil']));
  assert.equal(poor.like, 'fenton');
  assert.match(poor.text, /poorer/);
  assert.match(score(home({ gold: RICH - 1, crew: 25 }, ROUND)).text, /little to show/);
});

test('lost: Oxenham’s, and nothing scored', () => {
  const lost = score({ ...base, sunk: true, gold: 500 });
  assert.equal(lost.like, 'oxenham');
  assert.equal(lost.total, 0);
});

test('a smaller ship counts for more: the score times her multiplier', () => {
  const at = (ship: string) => score(home({ ship, gold: 100, crew: 10, hull: 10, maxHull: 10 }, ROUND));
  const raw = 100 + 10 * HAND_WORTH + SHIP_WORTH;
  assert.equal(at('pinnace').total, raw * 2);
  assert.equal(at('sloop').total, raw * 1.5);
  assert.equal(at('brigantine').total, raw);
});
