/** Run with `npm test`. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ROSES, SEA_NAMES, fade, rhumbs, windRose } from './woodcut.ts';

test('a wind rose has sixteen points, each cut in two halves', () => {
  const r = windRose(40);
  assert.equal(r.ink.match(/M0,0/g)!.length, 16);
  assert.equal(r.paper.match(/M0,0/g)!.length, 16);
  assert.ok(r.ring < 40);
});

test('the sea names and roses are on the chart', () => {
  for (const s of SEA_NAMES) assert.ok(Math.abs(s.at[0]) <= 180 && Math.abs(s.at[1]) <= 72, s.name);
  for (const [lon, lat] of ROSES) assert.ok(Math.abs(lon) <= 180 && Math.abs(lat) <= 72);
  assert.equal(rhumbs(10).length, 32);
});

test('water lines fade from ink toward the sea', () => {
  const ink: [number, number, number] = [0, 0, 0];
  const sea: [number, number, number] = [200, 200, 200];
  const near = Number(fade(ink, sea, 1, 4).match(/\d+/)![0]);
  const far = Number(fade(ink, sea, 4, 4).match(/\d+/)![0]);
  assert.ok(near < far && far < 200);
});
