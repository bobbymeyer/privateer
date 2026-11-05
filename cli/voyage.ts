/**
 * Whole voyages, sailed by a captain bot, to see whether each ship can come
 * home and how. The captain:
 *
 * - fits out at Plymouth's chandler: hands, water, food, then spares and
 *   powder with what's left;
 * - takes a fork at random, never turning back;
 * - rations by the leg ahead, and waters, forages and careens where there's
 *   a shore; buys where there's a chandler, trades with islanders;
 * - attacks merchants and the treasure ship, and raids the towns on the way
 *   with --raid (leaving the coast asleep for the silver unless --wake);
 * - fights by one-step lookahead, and runs when outgunned;
 * - meets a storm by riding it out on a sound hull, fever by nursing, foul
 *   water and weevils by heaving them over while there's plenty.
 *
 *   npm run voyage -- [--ship pinnace|sloop|brigantine|all] [--runs 40] [--from 0] [--raid] [--wake] [--trace]
 */

import { threatened } from '../src/rules.ts';
import { SHIPS } from '../src/outfit.ts';
import { continueOn } from '../src/world/course.ts';
import { choices, choose } from '../src/world/dilemmas.ts';
import { choices as legsOf, daysTo, howHome, makeFor } from '../src/world/journey.ts';
import { HOME_LANDMARK, landmark } from '../src/world/landmarks.ts';
import { attack, fight, letPass, raid, raidHere } from '../src/world/meet.ts';
import { score } from '../src/world/score.ts';
import { ashore, buy, CHANDLER, daysOf, marketHere, price, room, shoreHere, trade, type Ware, buySpice, spiceHere, spiceRoom } from '../src/world/stores.ts';
import { coastAwake, PACIFIC_TOWNS } from '../src/world/treasure.ts';
import { advance, createSea, createWorld, type WorldState } from '../src/world/world.ts';
import { lookahead } from './bots.ts';

const flag = (name: string) => process.argv.includes(`--${name}`);
const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const RUNS = Number(arg('runs', '40'));
const FROM = Number(arg('from', '0'));
const SHIP = arg('ship', 'all');
const RAID = flag('raid');
const WAKE = flag('wake');
const TRACE = flag('trace');
/** A voyage that hasn't ended in this many days is called off. */
const DAYS = 1500;
const DEAD: Record<string, number> = {};

const sea = createSea();
const fightBot = (outgunned: boolean) => lookahead({ hull: 0.6, damage: 0.4, fled: outgunned ? 100 : 0 });

/** Buy at a chandler: water and food to about four months, hands to her complement, then spares and powder, keeping a reserve once rich. */
function shop(w: WorldState): WorldState {
  if (marketHere(sea, w) === 'islanders' && (w.fresh > 10 || daysOf(w).water < 60)) {
    try {
      return trade(sea, w);
    } catch {
      return w;
    }
  }
  if (marketHere(sea, w) !== 'chandler') return w;
  const keep = w.voyage.visited.includes('cacafuego') ? Math.max(0, w.gold - 20) : 0;
  const enough: Record<Ware, (x: WorldState) => boolean> = {
    water: (x) => daysOf(x).water >= 120,
    food: (x) => daysOf(x).food >= 175,
    hands: (x) => !room(x, 'hands'),
    spares: (x) => x.stores.spares >= 4,
    powder: (x) => x.stores.powder >= 6,
  };
  for (const ware of ['hands', 'water', 'food', 'spares', 'powder'] as Ware[]) {
    for (let i = 0; i < 60 && room(w, ware) && !enough[ware](w) && w.gold - price(w, ware) >= keep; i++) w = buy(sea, w, ware);
  }
  // Spice in the Moluccas and Java, from what's left over a margin: it doubles and more at home.
  const spice = spiceHere(sea, w);
  while (spice && w.spice < spiceRoom(w) && w.gold - spice.cost >= 30) w = buySpice(sea, w);
  void CHANDLER;
  return w;
}

/** Answer whatever's waiting: an event, a sail, a fight. */
function answer(w: WorldState): WorldState {
  for (let guard = 0; guard < 50 && (w.dilemma || w.hail || w.encounter); guard++) {
    if (w.dilemma) {
      const open = choices(w, w.dilemma).filter((c) => !c.barred).map((c) => c.key);
      const want =
        w.dilemma.kind === 'storm' ? (w.hull > 4 || w.stores.spares > 0 ? 'ride' : open.includes('lighten') ? 'lighten' : 'run')
        : w.dilemma.kind === 'fever' ? 'nurse'
        : w.dilemma.kind === 'foul' ? (daysOf(w).water > 30 ? 'heave' : 'drink')
        : w.dilemma.kind === 'weevils' ? (daysOf(w).food > 60 ? 'heave' : 'eat')
        : w.dilemma.kind === 'leak' ? (open.includes('fother') ? 'fother' : 'pump')
        : w.dilemma.kind === 'wreck' ? (w.crew > 15 ? 'board' : 'sail')
        : w.dilemma.kind === 'canoes' ? (open.includes('trade') ? 'trade' : 'alongside')
        : w.dilemma.kind === 'reef' ? (w.spice > 0 && w.hull > 6 ? 'wait' : 'lighten')
        : w.dilemma.kind === 'gentleman' ? 'try'
        : w.dilemma.kind === 'deserters' ? 'watch'
        : open[0];
      w = choose(sea, w, want);
    } else if (w.hail) {
      const worth = w.hull >= w.maxHull * (w.hail.plate === 'asleep' ? 0.4 : 0.6);
      w = worth ? attack(w) : letPass(w);
    } else if (w.encounter) {
      const f = w.encounter.fight;
      w = fight(sea, w, fightBot(threatened(f.ship, f.target))(f));
    }
  }
  return w;
}

/** At a landmark: the shore, the market, a raid. */
function atLandmark(w: WorldState): WorldState {
  w = shop(w);
  const shore = shoreHere(sea, w);
  if (shore.includes('water') && daysOf(w).water < 80) w = answer(ashore(sea, w, 'water', advance));
  if (!w.sunk && shore.includes('forage') && (w.fresh > 15 || daysOf(w).food < 150)) w = answer(ashore(sea, w, 'forage', advance));
  if (!w.sunk && shore.includes('forage') && daysOf(w).food < 100) w = answer(ashore(sea, w, 'forage', advance));
  for (let i = 0; i < 3 && !w.sunk && shore.includes('careen') && w.hull < w.maxHull - 2; i++) w = answer(ashore(sea, w, 'careen', advance));
  const town = raidHere(sea, w);
  // The coast of Chile and Peru left asleep for the treasure ship, unless told to wake it.
  const sleeping = !WAKE && PACIFIC_TOWNS.includes(town?.key ?? '') && !w.voyage.visited.includes('cacafuego');
  if (!w.sunk && RAID && town && !sleeping && w.hull >= w.maxHull * 0.8) w = answer(raid(sea, w));
  return w;
}

/** Rations by the leg ahead: short when food or water won't see it out with a margin. */
function ration(w: WorldState): WorldState {
  if (!w.voyage.bound) return w;
  const need = daysTo(sea, w, w.voyage.bound) + 15;
  const full = daysOf({ ...w, rations: 'full' });
  const short = daysOf({ ...w, rations: 'short' });
  const rations = Math.min(full.food, full.water) >= need ? 'full' : Math.min(short.food, short.water) >= need ? 'short' : 'starving';
  return rations === w.rations ? w : { ...w, rations };
}

interface Result {
  ship: string;
  won: boolean;
  day: number;
  like: string;
  at: string;
  why: string;
  gold: number;
  crew: number;
  took: boolean;
}

function sail(ship: string, seed: number): Result {
  let w = createWorld(sea, seed, ship);
  let lastAt = '';
  while (!w.sunk && !w.won && w.turn < DAYS) {
    if (w.voyage.at !== lastAt) {
      lastAt = w.voyage.at;
      if (flag('where')) console.log('  ', w.turn, w.voyage.at, 'crew', w.crew, 'food', daysOf(w).food, 'water', daysOf(w).water, 'fresh', w.fresh, 'hull', w.hull, 'gold', w.gold);
      w = atLandmark(w);
      if (flag('where')) console.log('     after: crew', w.crew, 'food', daysOf(w).food, 'water', daysOf(w).water, 'fresh', w.fresh, 'hull', w.hull, 'gold', w.gold);
      if (w.sunk || w.won) break;
      if (!w.voyage.bound) {
        const legs = legsOf(w.voyage).filter((k) => k !== HOME_LANDMARK || landmark(w.voyage.at).next.includes(HOME_LANDMARK));
        w = makeFor(w, legs[(seed + w.turn) % legs.length]);
      }
    }
    w = ration(w);
    w = answer(continueOn(sea, w).world);
  }
  const why = w.won ? '' : w.sunk ? (w.log.some((l) => l.text.includes('too few hands')) ? 'too few hands' : 'in a fight') : 'out of time';
  const took = w.log.some((l) => /^\d+ gold into the strongroom/.test(l.text) && w.tally.best?.what === 'the treasure ship from Callao');
  for (const l of w.log) {
    const m = /^(a hand|\d+ hands) (?:dead of ([a-z ]+)|killed|lost over)/.exec(l.text) ?? /(a hand|\d+ hands) (dead of it|killed|sickened)/.exec(l.text);
    if (m) { const n = m[1] === 'a hand' ? 1 : Number(m[1].split(' ')[0]); const k = (m[2] ?? 'fights/events').replace(/ and .*/, ''); DEAD[k] = (DEAD[k] ?? 0) + n; }
  }
  if (TRACE) console.log(seed, ship, w.won ? 'HOME' : why, 'day', w.turn, 'gold', w.gold, 'crew', w.crew, took ? 'took her' : '', w.voyage.visited.join('>'));
  return { ship, won: w.won, day: w.turn, like: score(w).like, at: w.voyage.at, why, gold: w.gold, crew: w.crew, took };
}

const count = <T>(xs: T[], key: (x: T) => string) => JSON.stringify(xs.reduce((t, x) => ((t[key(x)] = (t[key(x)] ?? 0) + 1), t), {} as Record<string, number>));
const mean = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : NaN);

console.log(`${RUNS} voyages a ship${RAID ? ', raiding' : ''}${WAKE ? ', waking the coast' : ''}\n`);
for (const ship of SHIP === 'all' ? SHIPS : [SHIP]) {
  const results: Result[] = [];
  for (let seed = FROM; seed < FROM + RUNS; seed++) results.push(sail(ship, seed));
  const won = results.filter((r) => r.won);
  const lost = results.filter((r) => !r.won);
  console.log(`${ship}: home ${won.length} of ${RUNS} (${Math.round((100 * won.length) / RUNS)}%), on day ${mean(won.map((r) => r.day))}, with ${mean(won.map((r) => r.gold))} gold and ${mean(won.map((r) => r.crew))} hands`);
  console.log('  like', count(won, (r) => r.like), '· took the treasure ship', results.filter((r) => r.took).length);
  console.log('  lost', count(lost, (r) => r.why), '· last landmark', count(lost, (r) => r.at));
  console.log('  dead of', JSON.stringify(DEAD));
  for (const k of Object.keys(DEAD)) delete DEAD[k];
  void howHome;
  void coastAwake;
}
