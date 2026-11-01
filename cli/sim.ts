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

import { type Action, type EncounterState, type Outcome, act, legalActions } from '../src/rules.ts';
import { TARGETS, encounterWith } from '../src/setup.ts';
import type { ShipKind } from '../src/world/ships.ts';

interface Weights {
  /** Per point of your hull still standing. */
  hull: number;
  /** Per point of damage on the target: progress toward the bounty. */
  damage: number;
  /** Added to the payout when you get away. Negative: would rather not. */
  fled: number;
}

type Bot = { name: string; choose: (s: EncounterState) => Action };

function score(s: EncounterState, w: Weights): number {
  if (s.outcome === 'sunk') return -20;
  if (s.outcome === 'fled') return s.payout + w.fled;
  if (s.outcome) return s.payout;
  // Still fighting: what is aboard, plus what the position is worth. Damage
  // cards waiting in the deck count for most of a hull point each — they
  // will mostly land, but one per hand can be dodged.
  const pending = (side: 'ship' | 'target') =>
    [...s.deck, ...s.hand].filter((c) => c.damage && c.side === side).length;
  const hull = s.ship.hull - 0.7 * pending('ship');
  const dealt = s.target.maxHull - s.target.hull + 0.7 * pending('target');
  return s.plunder + w.hull * hull + w.damage * dealt + 0.2 * s.target.cargo;
}

function lookahead(w: Weights): Bot['choose'] {
  return (s) => {
    let best = legalActions(s)[0];
    let bestScore = -Infinity;
    for (const a of legalActions(s)) {
      const v = score(act(s, a), w);
      if (v > bestScore) [best, bestScore] = [a, v];
    }
    return best;
  };
}

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
const target = (targetFlag >= 0 ? process.argv[targetFlag + 1] : 'merchant') as ShipKind;
if (!TARGETS[target]) throw new Error(`no target ${target}; try ${Object.keys(TARGETS).join(', ')}`);
const flag = process.argv.indexOf('--runs');
const runs = flag >= 0 ? Number(process.argv[flag + 1]) : 2000;
const outcomes: Outcome[] = ['fled', 'escaped', 'destroyed', 'sunk', 'parted'];

console.log(`${runs} encounters per bot against a ${TARGETS[target].name}, seeds 0..${runs - 1}\n`);
console.log(['bot'.padEnd(22), 'payout', 'rounds', ...outcomes.map((o) => o.padStart(9))].join(' '));

for (const bot of bots) {
  let payout = 0;
  let rounds = 0;
  const counts = Object.fromEntries(outcomes.map((o) => [o, 0])) as Record<Outcome, number>;
  for (let seed = 0; seed < runs; seed++) {
    let s = encounterWith(target, seed);
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
