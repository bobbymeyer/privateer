/** What a screen reader is told: the chart, a gauge, a card. Run with `npm test`. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cardLabel, chartSummary, gaugeLabel } from './access.ts';
import { PLAYER_CARDS } from '../outfit.ts';
import { createSea, createWorld } from '../world/world.ts';

const sea = createSea();

test('the chart in words: where you are, where bound and how far, where you have been', () => {
  const w = { ...createWorld(sea, 1, 'sloop', 'own'), voyage: { at: 'plymouth', bound: 'canaries', visited: ['plymouth'] } };
  const said = chartSummary(sea, w);
  assert.match(said, /at Plymouth/);
  assert.match(said, /bound for the Canaries, \d+ days/);
  assert.match(said, /raised so far: Plymouth/);
  assert.match(chartSummary(sea, { ...w, voyage: { ...w.voyage, bound: null } }), /no course set/);
});

test('a gauge says its number, and when it is low', () => {
  assert.equal(gaugeLabel('hull', 12, 14), 'hull 12 of 14');
  assert.equal(gaugeLabel('hull', 3, 14, true), 'hull 3 of 14, low');
});

test('a card in full: whose, what kind, its words, and what it would do now', () => {
  const key = Object.keys(PLAYER_CARDS)[0];
  const card = { id: `${key}#1`, side: 'ship' as const, ...PLAYER_CARDS[key] };
  const said = cardLabel(card, 1, 'out of range now', 2);
  assert.match(said, /^yours, (sail|shot|board|hands)\. /);
  assert.ok(said.includes(card.name) && said.includes(card.text));
  assert.match(said, /plus 2\. out of range now\. picked, resolves first$/);
  assert.match(cardLabel({ ...card, side: 'target' }, null), /^theirs, /);
});
