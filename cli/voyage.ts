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
 * - follows a rumor with a captain's judgement (not the tales everyone
 *   knows, not a prize too strong for her, not far on a prisoner's word), or
 *   every one with --every-rumor, or none with --no-rumors; attacks a rumored
 *   prize on a sound hull;
 * - lies at an island a storm drives her to as at any landmark.
 *
 * - sails on whose money --backer says (crown, gentlemen, own, or all of them in turn);
 * - never fires on a friend's merchant unless --pirate;
 * - at the reckoning, goes to court when the risk is small, gives the Queen a
 *   gift when it isn't and there's the treasure for it, and lies low otherwise;
 *   sets the dead commander's ring aside for her, and sells the other jewels
 *   unless it means to give a gift;
 * - treats with a Portuguese settlement on the coast of Brazil, and buys
 *   brazilwood at Guanabara with what's over a margin;
 * - takes a chronicler with --chronicler;
 * - buys a little truck at Plymouth and deals fairly with the peoples of the
 *   coasts: barters truck for fresh food, punishes the hands' misconduct;
 * - practises on the fishing boat at the Canaries, and sets up the Queen's
 *   arms where nobody holds the land when it has a bundle to spare;
 * - keeps company with Huguenot privateers, and takes their French commission
 *   only with --french.
 *
 *   --hull: what took her hull, by cause; --every-sail: the lookout calls you up for every sail
 *   npm run voyage -- [--ship pinnace|sloop|brigantine|all] [--backer crown|gentlemen|own|all] [--runs 40] [--from 0] [--raid] [--wake] [--pirate] [--no-rumors] [--every-rumor] [--chronicler] [--french] [--trace]
 */

import { threatened } from '../src/rules.ts';
import { SHIPS } from '../src/outfit.ts';
import { continueOn } from '../src/world/course.ts';
import { choices, choose } from '../src/world/dilemmas.ts';
import { choices as legsOf, daysTo, howHome, makeFor } from '../src/world/journey.ts';
import { HOME_LANDMARK, landmark } from '../src/world/landmarks.ts';
import { attack, fight, letPass, raid, raidHere, oddsOf } from '../src/world/meet.ts';
import { score } from '../src/world/score.ts';
import { TRUCK_AT, barter, barterHere, ashore, buy, CHANDLER, daysOf, landmarkHere, marketHere, price, room, shoreHere, trade, type Ware, buySpice, buyWood, spiceHere, spiceRoom, woodHere, woodRoom, mend, yardHere, YARD_COST } from '../src/world/stores.ts';
import { coastAwake, PACIFIC_TOWNS } from '../src/world/treasure.ts';
import { followed } from '../src/world/rumors.ts';
import { BACKER_KEYS, type Backer, courtRisk, outlawed, pardonOf } from '../src/world/reckoning.ts';
import { LANDFALL_WATERS } from '../src/world/landfalls.ts';
const LANDFALL_KEYS = Object.keys(LANDFALL_WATERS);
import { advance, createSea, createWorld, waiting, type WorldState } from '../src/world/world.ts';
import { lookahead } from './bots.ts';
import { armsHere, plantArms } from '../src/world/arms.ts';

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
const RUMORS = !flag('no-rumors');
/** Follow every rumor, as the bot once did, rather than with a captain's judgement. */
const EVERY_RUMOR = flag('every-rumor');
/** What a captain would know is dubious: the passage to Cathay, the French in Florida, the Inca's gold. */
const DUBIOUS = ['northwest', 'river-may', 'arica'];
/** Prizes too strong for a ship: the galleon for a pinnace; the Great Ship, the carrack, the plate fleet and Goa for all but a brigantine. */
const TOO_STRONG: Record<string, string[]> = {
  pinnace: ['cabo-san-lucas', 'macau', 'azores', 'bahama-channel', 'goa'],
  sloop: ['macau', 'azores', 'bahama-channel', 'goa'],
  brigantine: ['bahama-channel', 'goa'],
};
/**
 * A captain's judgement on a rumor: not what everyone knows to be a tale, not
 * a prize the ship can't take, and not on a prisoner's word for a long way
 * out of it; friendly islands and spice are worth a look on anyone's word.
 */
function worthFollowing(w: WorldState, key: string, source: string): boolean {
  if (DUBIOUS.includes(key)) return false;
  if ((TOO_STRONG[w.ship] ?? []).includes(key)) return false;
  if (['solomons', 'banda'].includes(key)) return true;
  return source !== 'prisoner' || w.hull >= w.maxHull * 0.7;
}
const PIRATE = flag('pirate');
const BACKER = arg('backer', 'own');
const CHRONICLER = flag('chronicler');
const FRENCH = flag('french');
/** Chests of truck to carry out from Plymouth. */
const TRUCK = flag('no-truck') ? 0 : 3;
/** Jewels brought home, a voyage at a time; and the chronicler's fate. */
const JEWELS_HOME: number[] = [];
const CHRONICLE = { home: 0, dead: 0, sum: 0 };
/** What rumored prizes paid this ship's runs: payouts, and how many fought. */
const PRIZE_PAY: number[] = [];
const PRIZE_FOUGHT: Record<string, number> = {};
/** A voyage that hasn't ended in this many days is called off. */
const DAYS = 1500;
const HULLBY: Record<string, number> = {};
const DEAD: Record<string, number> = {};
const NOTED = { dead: 0, ran: 0 };

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
    truck: (x) => x.truck >= TRUCK,
  };
  for (const ware of (w.voyage.at === TRUCK_AT ? ['hands', 'water', 'food', 'spares', 'powder', 'truck'] : ['hands', 'water', 'food', 'spares', 'powder']) as Ware[]) {
    for (let i = 0; i < 60 && room(w, ware) && !enough[ware](w) && w.gold - price(w, ware) >= keep; i++) w = buy(sea, w, ware);
  }
  // Spice in the Moluccas and Java, from what's left over a margin: it doubles and more at home.
  const spice = spiceHere(sea, w);
  while (spice && w.spice < spiceRoom(w) && w.gold - spice.cost >= 30) w = buySpice(sea, w);
  return w;
}

/** Brazilwood at Guanabara, from what's over a margin: it trebles at home. */
function cutWood(w: WorldState): WorldState {
  const wood = woodHere(sea, w);
  while (wood && w.wood < woodRoom(w) && w.gold - wood.cost >= 30) w = buyWood(sea, w);
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
        : w.dilemma.kind === 'canoes' ? (open.includes('truck') ? 'truck' : open.includes('trade') ? 'trade' : 'alongside')
        : w.dilemma.kind === 'reef' ? (w.spice > 0 && w.hull > 6 ? 'wait' : 'lighten')
        : w.dilemma.kind === 'gentleman' ? 'try'
        : w.dilemma.kind === 'deserters' ? 'watch'
        : w.dilemma.kind === 'rumor' ? (RUMORS && (EVERY_RUMOR || worthFollowing(w, w.dilemma.key, w.dilemma.source)) ? 'follow' : 'ignore')
        : w.dilemma.kind === 'gold-mutiny' ? 'firm'
        : w.dilemma.kind === 'stores-fire' ? (open.includes('fight') ? 'fight' : 'shut')
        : w.dilemma.kind === 'eve' ? (w.hull >= w.maxHull * 0.8 ? 'press' : 'stand')
        : w.dilemma.kind === 'feast' ? 'deputy'
        : w.dilemma.kind === 'jailed' ? (open.includes('pay') && w.gold > 40 ? 'pay' : 'leave')
        : w.dilemma.kind === 'papers' ? (open.includes('bribe') ? 'bribe' : 'hand')
        : w.dilemma.kind === 'ore' ? 'leave'
        : w.dilemma.kind === 'practice' ? 'practise'
        : w.dilemma.kind === 'misconduct' ? 'punish'
        : w.dilemma.kind === 'huguenots' ? (FRENCH && open.includes('commission') ? 'commission' : 'company')
        : w.dilemma.kind === 'reckoning' ? (outlawed(w) ? (open.includes('gift') && !outlawed({ ...w, infamy: w.infamy - pardonOf(w) }) ? 'gift' : 'low') : courtRisk(w) < 0.3 ? 'court' : w.gold > 100 ? 'gift' : 'low')
        : w.dilemma.kind === 'settlement' ? (w.gold >= 5 ? 'treat' : 'clear')
        : w.dilemma.kind === 'normans' ? (open.includes('buy') && w.gold > 40 ? 'buy' : RUMORS ? 'news' : 'leave')
        : open[0];
      // At the reckoning, the dead commander's ring set aside for the Queen; the rest too, if it means to give a gift.
      if (w.dilemma.kind === 'reckoning') {
        JEWELS_HOME.push(w.jewels.length);
        w = { ...w, jewels: w.jewels.map((j) => ({ ...j, forQueen: j.kind === 'commander' || want === 'gift' })) };
      }
      w = choose(sea, w, want);
    } else if (w.hail) {
      // The treasure ship asleep, or a rumored prize come all this way for: worth it on a hull still a quarter sound. Anything else wants more.
      // Never at odds the master calls hopeless.
      const worth = (!w.hail.neutral || PIRATE) && oddsOf(w, w.hail) !== 'hopeless' && w.hull >= w.maxHull * (w.hail.plate === 'asleep' ? 0.4 : w.hail.prize ? 0.25 : 0.6);
      w = worth ? attack(w) : letPass(w);
    } else if (w.encounter) {
      const f = w.encounter.fight;
      const prize = w.encounter.prize ?? (w.encounter.raid === 'goa' ? 'goa' : null);
      w = fight(sea, w, fightBot(threatened(f.ship, f.target))(f));
      if (prize && !w.encounter) {
        PRIZE_FOUGHT[`${prize} ${w.reckoning!.outcome}`] = (PRIZE_FOUGHT[`${prize} ${w.reckoning!.outcome}`] ?? 0) + 1;
        PRIZE_PAY.push(w.reckoning!.payout);
      }
    }
  }
  return w;
}

/** At a landmark: the shore, the market, a raid. */
function atLandmark(w: WorldState): WorldState {
  w = cutWood(shop(w));
  // Truck for fresh food where there's a people and no market, while it lasts.
  if (barterHere(sea, w) && w.truck > 0 && (w.fresh > 10 || daysOf(w).water < 80)) w = barter(sea, w);
  const shore = shoreHere(sea, w);
  if (shore.includes('water') && daysOf(w).water < 80) w = answer(ashore(sea, w, 'water', advance));
  // On the Spanish coast, water by night when the casks are low: the risk of being seen is better than thirst.
  if (!w.sunk && !waiting(w) && shore.includes('night') && daysOf(w).water < 60) w = answer(ashore(sea, w, 'night', advance));
  if (!w.sunk && shore.includes('forage') && (w.fresh > 15 || daysOf(w).food < 150)) w = answer(ashore(sea, w, 'forage', advance));
  if (!w.sunk && shore.includes('forage') && daysOf(w).food < 100) w = answer(ashore(sea, w, 'forage', advance));
  for (let i = 0; i < 3 && !w.sunk && shore.includes('careen') && w.hull < w.maxHull - 2; i++) w = answer(ashore(sea, w, 'careen', advance));
  // The yard, where a chandler deals with you abroad, from what's over a margin of the purse.
  while (!w.sunk && yardHere(sea, w) && w.hull < w.maxHull && w.gold - YARD_COST >= 30) w = mend(sea, w);
  // The Queen's arms, where nobody holds the land, when there's a bundle of the spares to spare: never the truck, which is fresh food.
  if (!w.sunk && !waiting(w) && armsHere(sea, w) && w.stores.spares > 2) w = answer(plantArms(sea, w, advance));
  const town = raidHere(sea, w);
  // The coast of Chile and Peru left asleep for the treasure ship, unless told to wake it.
  const sleeping = !WAKE && PACIFIC_TOWNS.includes(town?.key ?? '') && !w.voyage.visited.includes('cacafuego');
  if (!w.sunk && RAID && town && !sleeping && w.hull >= w.maxHull * 0.8 && (town.key !== 'goa' || (w.ship === 'brigantine' && w.hull === w.maxHull))) w = answer(raid(sea, w));
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
  score: number;
  verdict: string;
  won: boolean;
  day: number;
  like: string;
  at: string;
  why: string;
  gold: number;
  crew: number;
  took: boolean;
  /** Rumors heard; rumored detours sailed and found true, or false; storm landfalls. */
  heard: number;
  followedTrue: number;
  followedFalse: number;
  landfalls: number;
  /** Places the Queen's arms were set up. */
  arms: number;
  /** Her hull at home, as a share of her best; and the sails that stopped her. */
  hullHome: number;
  stops: number;
}

function sail(ship: string, seed: number, backer: Backer): Result {
  let w = createWorld(sea, seed, ship, backer, CHRONICLER);
  if (flag('every-sail')) w = { ...w, lookout: 'every' };
  let lastAt = '';
  let stops = 0;
  while (!w.sunk && !w.won && w.turn < DAYS) {
    // A landmark newly raised, or an island a storm put her on.
    const here = `${w.voyage.at}|${landmarkHere(sea, w)?.landfall ? w.landfall : ''}`;
    if (here !== lastAt) {
      lastAt = here;
      if (flag('where')) console.log('  ', w.turn, w.voyage.at, 'crew', w.crew, 'food', daysOf(w).food, 'water', daysOf(w).water, 'fresh', w.fresh, 'hull', w.hull, 'gold', w.gold);
      w = atLandmark(w);
      if (flag('where')) console.log('     after: crew', w.crew, 'food', daysOf(w).food, 'water', daysOf(w).water, 'fresh', w.fresh, 'hull', w.hull, 'gold', w.gold);
      if (w.sunk || w.won) break;
      if (!w.voyage.bound) {
        const legs = legsOf(w.voyage, followed(w)).filter((k) => k !== HOME_LANDMARK || landmark(w.voyage.at).next.includes(HOME_LANDMARK));
        // A rumored detour first; else a fork at random.
        const detour = legs.find((k) => landmark(k).detour);
        w = makeFor(w, detour ?? legs[(seed + w.turn) % legs.length]);
      }
    }
    w = ration(w);
    const h0 = w.hull, n0 = w.log.length, f0 = w.tally.fights;
    const out = continueOn(sea, w);
    if (out.world.hail) stops++;
    w = answer(out.world);
    if (w.hull !== h0) {
      const said = w.log.slice(n0).map((l) => l.text).join(' | ');
      const k = w.tally.fights > f0 ? 'fight' : /weed and worm/.test(said) ? 'weed' : /storm/.test(said) ? 'storm' : /pumping|leak/.test(said) ? 'leak' : /reef/.test(said) ? 'reef' : /lightning|fire|worm in her/.test(said) ? 'mishap' : /eve|raid|sack/.test(said) ? 'raid' : 'other:' + said.slice(0, 60);
      HULLBY[k] = (HULLBY[k] ?? 0) + (w.hull - h0);
    }
  }
  const why = w.won ? '' : w.sunk ? (w.log.some((l) => l.text.includes('too few hands')) ? 'too few hands' : 'in a fight') : 'out of time';
  const took = w.log.some((l) => /^\d+ gold into the strongroom/.test(l.text) && w.tally.best?.what === 'the treasure ship from Callao');
  // The voyage keeps its own count of the dead, by what took them; and of the hands of note.
  for (const [k, n] of Object.entries(w.losses)) DEAD[k] = (DEAD[k] ?? 0) + n;
  NOTED.dead += w.hands.filter((h) => h.dead).length;
  const poet = w.hands.find((h) => h.role === 'chronicler');
  if (poet && w.won && !poet.dead) (CHRONICLE.home++, (CHRONICLE.sum += score(w).chronicle));
  if (poet?.dead) CHRONICLE.dead++;
  NOTED.ran += w.hands.filter((h) => h.ran).length;
  if (TRACE) console.log(seed, ship, w.won ? 'HOME' : why, 'day', w.turn, 'gold', w.gold, 'crew', w.crew, took ? 'took her' : '', w.voyage.visited.join('>'));
  const heard = w.rumors.filter((r) => r.followed && w.voyage.visited.includes(r.key));
  return { ship, score: score(w).total, verdict: w.verdict ?? '', won: w.won, day: w.turn, like: score(w).like, at: w.voyage.at, why, gold: w.gold, crew: w.crew, took, followedTrue: heard.filter((r) => r.truth).length, followedFalse: heard.filter((r) => !r.truth).length, heard: w.rumors.length, landfalls: w.seen.filter((k) => LANDFALL_KEYS.includes(k)).length, arms: w.arms.length, hullHome: w.hull / w.maxHull, stops };
}

const count = <T>(xs: T[], key: (x: T) => string) => JSON.stringify(xs.reduce((t, x) => ((t[key(x)] = (t[key(x)] ?? 0) + 1), t), {} as Record<string, number>));
const mean = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : NaN);

console.log(`${RUNS} voyages a ship${RAID ? ', raiding' : ''}${WAKE ? ', waking the coast' : ''}\n`);
for (const ship of SHIP === 'all' ? SHIPS : [SHIP]) for (const backer of (BACKER === 'all' ? BACKER_KEYS : [BACKER]) as Backer[]) {
  const results: Result[] = [];
  for (let seed = FROM; seed < FROM + RUNS; seed++) results.push(sail(ship, seed, backer));
  const won = results.filter((r) => r.won);
  const lost = results.filter((r) => !r.won);
  console.log(`${ship}, ${backer}: home ${won.length} of ${RUNS} (${Math.round((100 * won.length) / RUNS)}%), on day ${mean(won.map((r) => r.day))}, with ${mean(won.map((r) => r.gold))} gold and ${mean(won.map((r) => r.crew))} hands · mean score ${mean(results.map((r) => r.score))}`);
  const third = (x: number) => (x < 1 / 3 ? 'battered' : x < 2 / 3 ? 'worn' : 'sound');
  console.log(`  SUMMARY home ${Math.round((100 * won.length) / RUNS)}% drake ${won.filter((r) => r.like === 'drake').length} score ${mean(results.map((r) => r.score))} hull home ${mean(won.map((r) => 100 * r.hullHome))}% ${count(won, (r) => third(r.hullHome))} sails a voyage ${(results.reduce((t, r) => t + r.stops, 0) / RUNS).toFixed(1)}`);
  console.log('  like', count(won, (r) => r.like), '· at court', count(won, (r) => r.verdict), '· took the treasure ship', results.filter((r) => r.took).length);
  console.log('  lost', count(lost, (r) => r.why), '· last landmark', count(lost, (r) => r.at));
  console.log('  lost to', JSON.stringify(DEAD), `· hands of note dead ${NOTED.dead}, ran ${NOTED.ran}`);
  const sum = (f: (r: Result) => number) => results.reduce((t, r) => t + f(r), 0);
  console.log(`  rumors heard ${sum((r) => r.heard)}, detours sailed ${sum((r) => r.followedTrue + r.followedFalse)} (${sum((r) => r.followedTrue)} true, ${sum((r) => r.followedFalse)} false) · rumored prizes ${JSON.stringify(PRIZE_FOUGHT)}, paying ${mean(PRIZE_PAY.filter((x) => x > 0))} when they paid · storm landfalls ${sum((r) => r.landfalls)} · the Queen's arms set up ${sum((r) => r.arms)}`);
  console.log(`  jewels home ${JEWELS_HOME.reduce((a, b) => a + b, 0)} on ${JEWELS_HOME.length} voyages${CHRONICLER ? ` · the chronicler home ${CHRONICLE.home}, dead ${CHRONICLE.dead}, his account worth ${CHRONICLE.home ? Math.round(CHRONICLE.sum / CHRONICLE.home) : 0}` : ''}`);
  JEWELS_HOME.length = 0;
  CHRONICLE.home = CHRONICLE.dead = CHRONICLE.sum = 0;
  PRIZE_PAY.length = 0;
  for (const k of Object.keys(PRIZE_FOUGHT)) delete PRIZE_FOUGHT[k];
  for (const k of Object.keys(DEAD)) delete DEAD[k];
  NOTED.dead = NOTED.ran = 0;
  if (flag('hull')) console.log('  hull lost to', JSON.stringify(HULLBY));
  for (const k of Object.keys(HULLBY)) delete HULLBY[k];
  void howHome;
  void coastAwake;
}
