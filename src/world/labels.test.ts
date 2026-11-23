/** The chart's names: none on another, none on another's point. Run with `npm test`. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HOME_LANDMARK, LANDMARKS } from './landmarks.ts';
import { type LabelIn, LABEL_FONT, boxOf, layoutLabels, overlaps, shortName } from './labels.ts';
import { createSea } from './world.ts';

const sea = createSea();
const BOUNDS: [number, number, number, number] = [-180, -72, 180, 60];
/** Every landmark the chart can show, detours and landfalls too: the most crowded the chart can be. */
const every: LabelIn[] = LANDMARKS.filter((l) => l.key !== HOME_LANDMARK && l.key !== 'strait-east').map((l) => {
  const n = sea.map.nodes[sea.map.landmarks[l.key]];
  return { key: l.key, x: n.lon, y: -n.lat, name: l.name, short: shortName(l.name), priority: 0 };
});
/** Degrees a screen pixel covers, at a chart this many pixels wide. */
const at = (width: number) => 360 / Math.max(320, width);

function noneCollide(labels: LabelIn[], px: number, points: LabelIn[] = labels) {
  const out = layoutLabels(labels, px, BOUNDS, LABEL_FONT, points);
  const boxes = out.map((o) => boxOf(o.x, o.y, o.text, o.anchor, px, LABEL_FONT));
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) assert.ok(!overlaps(boxes[i], boxes[j]), `${out[i].text} on ${out[j].text}`);
  // Nor on another landmark's point.
  for (const [i, o] of out.entries()) {
    for (const l of points) {
      if (l.key === o.key) continue;
      const p = { x0: l.x - 3.5 * px, x1: l.x + 3.5 * px, y0: l.y - 3.5 * px, y1: l.y + 3.5 * px };
      assert.ok(!overlaps(boxes[i], p), `${o.text} on the point of ${l.name}`);
    }
  }
  return out;
}

test('at desktop width, no name falls on another, and the Strait and the Horn are both named', () => {
  const out = noneCollide(every, at(1100));
  const keys = out.map((o) => o.key);
  assert.ok(keys.includes('strait') && keys.includes('horn'), keys.join(' '));
  assert.ok(keys.includes('valparaiso') && keys.includes('mocha'));
  assert.ok(out.length >= every.length - 4, `${out.length} of ${every.length} named`);
});

test('at a phone’s width, none collide, and where you are is named', () => {
  const px = at(358);
  // At San Julián, bound nowhere yet: the way so far named, the Strait and the Horn ahead; every other point drawn, unnamed.
  const been = ['plymouth', 'canaries', 'cape-verde', 'brazil', 'plate', 'san-julian'];
  // Where you are and might go next first, then the way so far, latest first: as the chart orders them.
  const near = every.filter((l) => [...been, 'strait', 'horn'].includes(l.key)).map((l) => ({ ...l, priority: ['san-julian', 'strait', 'horn'].includes(l.key) ? 3 : 2 + been.indexOf(l.key) / 100 }));
  const out = noneCollide(near, px, every);
  // Where you are is named. The Strait and the Horn lie a few pixels apart in the chart's corner on a phone: they're named only where there's room, and the fork's buttons name both.
  assert.ok(out.some((o) => o.key === 'san-julian'));
});

test('a shorter name when the long one won’t fit', () => {
  assert.equal(shortName('round the Horn'), 'Horn');
  assert.equal(shortName('the Strait of Magellan'), 'Strait of Magellan');
  assert.equal(shortName('Ternate, in the Moluccas'), 'Ternate');
  assert.equal(shortName('off Cape San Francisco'), 'Cape San Francisco');
  assert.equal(shortName('the Banda islands'), 'Banda');
});
