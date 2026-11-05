/**
 * Run bots through thousands of encounters and print how they come out. This
 * is the tool for tuning numbers.
 *
 * Every decision is a pick, so every bot works the same way: try each of the
 * six ordered keeps one step ahead, score the result, take the best. Bots
 * differ only in what they value — how much hull is worth, and whether
 * getting away counts as winning.
 *
 *   npm run sim                  2000 encounters per bot
 *   npm run sim -- --runs 10000
 */

import { type Action, CLOSE, type EncounterState, FAR, type Outcome, act, legalActions } from '../src/rules.ts';
import { lookahead } from './bots.ts';
import { TARGETS, encounterWith } from '../src/setup.ts';
import type { TargetKind } from '../src/setup.ts';
import { SHIP_CLASSES, deckOf } from '../src/outfit.ts';

type Bot = { name: string; choose: (s: EncounterState) => Action };

const bots: Bot[] = [
  { name: 'balanced', choose: lookahead({ hull: 0.6, damage: 0.4, fled: 0 }) },
  { name: 'careful (hull dear)', choose: lookahead({ hull: 1.5, damage: 0.4, fled: 2 }) },
  { name: 'reckless (hull cheap)', choose: lookahead({ hull: 0.2, damage: 0.6, fled: -5 }) },
  { name: 'never flees', choose: lookahead({ hull: 0.6, damage: 0.4, fled: -100 }) },
  // Runs the moment a flee card will work: what to do in front of an armada.
  { name: 'runs when it can', choose: lookahead({ hull: 0.6, damage: 0.4, fled: 100 }) },
  {
    name: 'random keeps',
    choose: (s) => {
      const all = legalActions(s);
      return all[(s.round * 7 + s.deck.length) % all.length];
    },
  },
];

const targetFlag = process.argv.indexOf('--target');
const target = (targetFlag >= 0 ? process.argv[targetFlag + 1] : 'merchant') as TargetKind;
if (!TARGETS[target]) throw new Error(`no target ${target}; try ${Object.keys(TARGETS).join(', ')}`);
// --ship sails a ship class with its own deck and hull; --hull overrides the hull alone.
const shipFlag = process.argv.indexOf('--ship');
const ship = shipFlag >= 0 ? process.argv[shipFlag + 1] : 'pinnace';
if (!SHIP_CLASSES[ship]) throw new Error(`no ship ${ship}; try ${Object.keys(SHIP_CLASSES).join(', ')}`);
const deck = deckOf(ship);
const hullFlag = process.argv.indexOf('--hull');
const hull = hullFlag >= 0 ? Number(process.argv[hullFlag + 1]) : SHIP_CLASSES[ship].hull;
const rangeFlag = process.argv.indexOf('--range');
const startAt = rangeFlag >= 0 && process.argv[rangeFlag + 1] === 'far' ? FAR : CLOSE;
const flag = process.argv.indexOf('--runs');
const runs = flag >= 0 ? Number(process.argv[flag + 1]) : 2000;
const outcomes: Outcome[] = ['fled', 'escaped', 'destroyed', 'sunk', 'parted'];

console.log(`${runs} encounters per bot, a ${ship} (hull ${hull}, ${deck.length} cards) against a ${TARGETS[target].name}\n`);
console.log(['bot'.padEnd(22), 'payout', 'rounds', ...outcomes.map((o) => o.padStart(9))].join(' '));

for (const bot of bots) {
  let payout = 0;
  let rounds = 0;
  const counts = Object.fromEntries(outcomes.map((o) => [o, 0])) as Record<Outcome, number>;
  for (let seed = 0; seed < runs; seed++) {
    let s = encounterWith(target, seed, { hull, maxHull: hull }, deck, {}, startAt);
    while (!s.outcome) s = act(s, bot.choose(s));
    payout += s.payout;
    rounds += s.round;
    counts[s.outcome!]++;
  }
  const pct = (n: number) => `${((100 * n) / runs).toFixed(1)}%`.padStart(9);
  console.log([
    bot.name.padEnd(22),
    (payout / runs).toFixed(2).padStart(6),
    (rounds / runs).toFixed(1).padStart(6),
    ...outcomes.map((o) => pct(counts[o])),
  ].join(' '));
}
