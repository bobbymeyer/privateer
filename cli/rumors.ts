/**
 * How much a rumor is worth, by its age, its source, and what you know of the
 * sea. For each seed: let the world run a few turns, hear a rumor about a
 * random ship, let it sail on, then ask the prediction where it is.
 *
 *   npm run rumors
 *   npm run rumors -- --runs 2000
 *
 * Columns:
 *   hit    the ship is on the single likeliest node
 *   area   nodes in the search area (the fewest holding 70% of the cloud)
 *   inside the ship really is inside the search area — should sit near 70%
 */

import { type Roller, pick } from '../src/world/random.ts';
import { predict, searchArea } from '../src/world/rumors.ts';
import { KNOW_ALL, KNOW_NOTHING, type SeaKnowledge } from '../src/world/sea.ts';
import { advance, createSea, createWorld, hearRumor } from '../src/world/world.ts';

const flag = process.argv.indexOf('--runs');
const runs = flag >= 0 ? Number(process.argv[flag + 1]) : 600;

const KNOW: [string, SeaKnowledge][] = [
  ['nothing', KNOW_NOTHING],
  ['currents', { current: () => true, wind: () => false }],
  ['winds', { current: () => false, wind: () => true }],
  ['both', KNOW_ALL],
];
const AGES = [0, 2, 4, 6, 8];

for (const reliability of [0.9, 0.5]) {
  console.log(`\nreliability ${reliability}, ${runs} rumors\n`);
  console.log(['knowing'.padEnd(10), ...AGES.map((a) => `age ${a}`.padEnd(20))].join(''));
  console.log(['', ...AGES.map(() => 'hit  area inside'.padEnd(20))].join('').padStart(10));

  // `n`: samples where the ship was still on the map to be found.
  const rows = KNOW.map(() => AGES.map(() => ({ n: 0, hit: 0, area: 0, inside: 0 })));
  for (let seed = 0; seed < runs; seed++) {
    const sea = createSea();
    let w = createWorld(sea, seed);
    for (let i = 0; i < 6; i++) w = advance(sea, w, w.player);
    const r: Roller = { rng: seed * 7919 + 1 };
    const target = pick(r, w.ships);
    w = hearRumor(sea, w, target.id, reliability);
    const rumor = w.rumors.at(-1)!;
    for (let age = 0; age <= AGES.at(-1)!; age++) {
      const col = AGES.indexOf(age);
      if (col >= 0) {
        const truth = w.ships[target.id].node;
        KNOW.forEach(([, know], row) => {
          const p = predict(sea, rumor, w.turn, know, w.player);
          const area = searchArea(p);
          const cell = rows[row][col];
          cell.n++;
          if (p.indexOf(Math.max(...p)) === truth) cell.hit++;
          cell.area += area.length;
          if (area.includes(truth)) cell.inside++;
        });
      }
      w = advance(sea, w, w.player);
    }
  }
  const pct = (k: number, n: number) => `${Math.round((100 * k) / n)}%`.padStart(4);
  KNOW.forEach(([name], row) => {
    console.log([name.padEnd(10), ...rows[row].map((c) => `${pct(c.hit, c.n)} ${(c.area / c.n).toFixed(1).padStart(4)} ${pct(c.inside, c.n)}`.padEnd(20))].join(''));
  });
}
