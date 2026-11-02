/** Run with `npm test`. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COLORS } from './colors.ts';
import { PORTS } from './ports.ts';

test('every flag in the game has its colours', () => {
  for (const p of PORTS) assert.ok(COLORS[p.nation], p.nation);
});

test('no two nations fly the same field and border', () => {
  const pairs = Object.values(COLORS).map((c) => `${c.field}/${c.border}`);
  assert.equal(new Set(pairs).size, pairs.length);
});

test('England white edged red, Japan red edged white, the Danes red edged gold', () => {
  assert.deepEqual(COLORS.england, { field: '#ffffff', border: '#c8102e' });
  assert.deepEqual(COLORS.japan, { field: '#c8102e', border: '#ffffff' });
  assert.equal(COLORS.denmark.field, COLORS.japan.field);
  assert.notEqual(COLORS.denmark.border, COLORS.japan.border);
});
