/**
 * Events that ask you something: a storm, fever aboard, the water gone
 * foul, weevils in the bread. Each stops the voyage and offers a few
 * choices, and each choice says what it stakes before you make it. The odds
 * are told plainly — a captain of the century knew what a storm could do —
 * so the choice is about what you can afford, not a guess.
 */

import { type Roller, roll } from './random.ts';
import { capacity, deaths, topUp } from './stores.ts';
import { DISCONTENT_LOST } from './happenings.ts';
import type { Sea, WorldState } from './world.ts';
import { FEVER_NURSE, FEVER_NURSE_DAYS, FEVER_PRESS, FLUX, FOUL_LOST, WEEVIL_LOST, WEEVIL_SICK, feverDeaths, fluxDeaths } from './weather.ts';

export type Dilemma =
  /** A storm: ride it out, run before it, or lighten ship. */
  | { kind: 'storm' }
  /** Fever aboard: press on, or lie to and nurse the sick. */
  | { kind: 'fever' }
  /** The water gone foul in the casks: drink it, or heave it over. */
  | { kind: 'foul' }
  /** Weevils in the bread: eat it, or heave it over. */
  | { kind: 'weevils' }
  /** A leak below the waterline: fother it with a sail, or pump and press on. */
  | { kind: 'leak' }
  /** A wreck adrift: board her, or sail on. */
  | { kind: 'wreck' }
  /** Islanders' canoes in the Pacific: trade, let them alongside, or warn them off. */
  | { kind: 'canoes' }
  /** Aground on a reef in the Indies: lighten her, or wait for the tide. */
  | { kind: 'reef' }
  /** A gentleman stirring the hands at San Julián, as Doughty did: try him, maroon him, or let it be. */
  | { kind: 'gentleman' }
  /** Hands who want to stay in the islands: let them go, or double the watch. */
  | { kind: 'deserters' };

export interface Choice {
  key: string;
  label: string;
  /** What it stakes, told plainly. */
  stakes: string;
  /** Why it can't be chosen, if it can't. */
  barred?: string;
}

/** A leak pumped and pressed on with. */
export const LEAK_HULL = 2;
/** A wreck boarded: the days, what a strongbox holds, and the sickness. */
export const WRECK_DAYS = 2;
export const WRECK_GOLD = [10, 40] as const;
export const WRECK_SICK = [2, 4] as const;
/** Islanders' canoes: what trinkets cost, and what they bring. */
export const CANOE_COST = 2;
export const CANOE_DAYS = 14;
/** Fast on a reef, waiting for the tide; and what pounding costs. */
export const REEF_DAYS = [1, 2] as const;
export const REEF_HULL = [2, 3] as const;
/** Hands who'd stay in the islands; and who slip away from a doubled watch. */
export const DESERTERS = [2, 4] as const;
export const SLIP_AWAY = [1, 3] as const;

/** Riding out a storm costs this much, spares first and then hull, never the last point. */
export const STORM_HULL = [1, 3] as const;
/** Running before it costs this many days driven off your course. */
export const STORM_RUN = [2, 4] as const;
/** Lightening ship throws over this share of the purse, and no more than JETTISON_CAP. */
export const LIGHTEN = [0.1, 0.25] as const;
export const JETTISON_CAP = 30;

const range = ([a, b]: readonly [number, number]) => `${a} to ${b}`;
const lightenRange = (gold: number) => {
  const share = (k: number) => Math.min(JETTISON_CAP, Math.max(1, Math.round(gold * k)));
  return [share(LIGHTEN[0]), share(LIGHTEN[1])] as const;
};

export function describe(d: Dilemma): { title: string; text: string } {
  switch (d.kind) {
    case 'storm':
      return { title: 'a storm', text: 'the glass is falling and the sea getting up. there is time to choose how to meet it.' };
    case 'fever':
      return { title: 'fever aboard', text: 'a dozen hands in their hammocks, burning and raving. they want lying still, and in the shade.' };
    case 'foul':
      return { title: 'the water gone foul', text: 'green and stinking in the casks, with things alive in it. the hands will drink it if they must.' };
    case 'weevils':
      return { title: 'weevils in the bread', text: 'the biscuit is crawling. the hands knock it on the table to get them out, and grumble.' };
    case 'leak':
      return { title: 'a leak', text: 'water coming in below the waterline faster than the pumps like. the carpenter cannot get at it from inside.' };
    case 'wreck':
      return { title: 'a wreck', text: 'a ship adrift, dismasted, low in the water, and nobody on her deck. whatever killed her crew may still be aboard.' };
    case 'canoes':
      return { title: 'canoes', text: 'the islanders put out to you, a hundred canoes, with coconuts and fish held up. some of them have their eyes on anything iron.' };
    case 'reef':
      return { title: 'aground', text: 'on a reef in the Indies, fast by the bow, with the tide falling. Drake sat a day on one like it, and threw cloves and guns over to float her.' };
    case 'gentleman':
      return { title: 'a gentleman adventurer', text: 'one of the gentlemen who put money in the voyage has been telling the hands you will drown them all, and some of them listen. Drake tried Doughty here, and beheaded him.' };
    case 'deserters':
      return { title: 'hands who would stay', text: 'some of the hands have found the islands kinder than the ship, and mean to stay when she sails.' };
  }
}

export function choices(s: WorldState, d: Dilemma): Choice[] {
  switch (d.kind) {
    case 'storm': {
      const [lo, hi] = lightenRange(s.gold);
      return [
        { key: 'ride', label: 'ride it out', stakes: `${range(STORM_HULL)} damage, spares first (${s.stores.spares} aboard), then hull, never the last` },
        { key: 'run', label: 'run before it', stakes: `no damage, but ${range(STORM_RUN)} days driven off your course` },
        { key: 'lighten', label: 'lighten ship', stakes: `throw ${lo === hi ? lo : `${lo} to ${hi}`} gold over the side, and no damage`, ...(s.gold <= 0 ? { barred: 'nothing aboard to throw over' } : {}) },
      ];
    }
    case 'fever':
      return [
        { key: 'press', label: 'press on', stakes: `${range(FEVER_PRESS)} hands dead of it` },
        { key: 'nurse', label: 'lie to and nurse them', stakes: `${FEVER_NURSE_DAYS} days making no way, and ${range(FEVER_NURSE)} dead` },
      ];
    case 'foul':
      return [
        { key: 'drink', label: 'drink it', stakes: `the flux: ${range(FLUX)} hands dead of it` },
        { key: 'heave', label: 'heave it over', stakes: `lose half the water: ${Math.round(s.stores.water * FOUL_LOST)} rations` },
      ];
    case 'weevils':
      return [
        { key: 'eat', label: 'eat it anyway', stakes: `about one time in ${Math.round(1 / WEEVIL_SICK)}, a hand sickens of it and dies` },
        { key: 'heave', label: 'heave the worst over', stakes: `lose a quarter of the food: ${Math.round(s.stores.food * WEEVIL_LOST)} rations` },
      ];
    case 'leak':
      return [
        { key: 'fother', label: 'fother it', stakes: 'a sail drawn under her bottom over the leak: a bundle of the spares and a day', ...(s.stores.spares <= 0 ? { barred: 'no spare canvas to do it with' } : {}) },
        { key: 'pump', label: 'pump and press on', stakes: `${LEAK_HULL} hull, never the last` },
      ];
    case 'wreck':
      return [
        { key: 'board', label: 'board her', stakes: `${WRECK_DAYS} days. she may have stores, or silver, or nothing, or the sickness that emptied her` },
        { key: 'sail', label: 'sail on', stakes: 'nothing ventured' },
      ];
    case 'canoes':
      return [
        { key: 'trade', label: 'trade with them', stakes: `${CANOE_COST} gold in trinkets: the casks filled, ${CANOE_DAYS} days of fresh food`, ...(s.gold < CANOE_COST ? { barred: 'nothing in the purse to trade' } : {}) },
        { key: 'alongside', label: 'let them come aboard', stakes: 'fruit for nothing, a week of it, but they will take what they can lift' },
        { key: 'warn', label: 'fire a gun over them', stakes: 'a barrel of powder, and they keep off', ...(s.stores.powder <= 0 ? { barred: 'no powder' } : {}) },
      ];
    case 'reef':
      return [
        { key: 'lighten', label: 'lighten her', stakes: s.spice > 0 ? `half the spice over the side: ${Math.ceil(s.spice / 2)} tons` : 'two barrels of powder and a quarter of the food over the side' },
        { key: 'wait', label: 'wait for the tide', stakes: `${range(REEF_DAYS)} days fast, and even odds she pounds: ${range(REEF_HULL)} hull` },
      ];
    case 'gentleman':
      return [
        { key: 'try', label: 'try him, and behead him', stakes: 'a man dead, and nobody will talk of drowning again' },
        { key: 'maroon', label: 'put him ashore', stakes: 'he goes, and his friends may go with him: 1 to 3 hands' },
        { key: 'leave', label: 'let it be', stakes: `even odds that ${range(DISCONTENT_LOST)} hands slip away at the next landmark` },
      ];
    case 'deserters':
      return [
        { key: 'go', label: 'let them go', stakes: `${range(DESERTERS)} hands stay behind` },
        { key: 'watch', label: 'double the watch', stakes: `a day, and even so ${range(SLIP_AWAY)} may slip over the side, one time in three` },
      ];
  }
}

/** Make the choice. Throws if there's nothing to choose, or the choice is barred. */
export function choose(sea: Sea, s: WorldState, key: string): WorldState {
  void sea;
  const d = s.dilemma;
  if (!d) throw new Error('there is nothing to choose');
  const c = choices(s, d).find((x) => x.key === key);
  if (!c) throw new Error(`no choice ${key}`);
  if (c.barred) throw new Error(c.barred);
  const r: Roller = { rng: s.rng };
  let w: WorldState = { ...s, dilemma: null };
  const log = (text: string) => (w = { ...w, log: [...w.log, { turn: w.turn, text }] });
  const between = ([a, b]: readonly [number, number]) => a + Math.floor(roll(r) * (b - a + 1));
  const hands = (n: number) => (n === 1 ? 'a hand' : `${n} hands`);

  switch (`${d.kind}:${key}`) {
    case 'storm:ride': {
      // Spare canvas and timber take the damage first; then the hull.
      const blow = between(STORM_HULL);
      const spent = Math.min(blow, w.stores.spares);
      const lost = Math.min(blow - spent, w.hull - 1);
      w = { ...w, hull: w.hull - lost, stores: { ...w.stores, spares: w.stores.spares - spent } };
      const parts = [spent && `${spent} of the spares`, lost && `${lost} hull`].filter(Boolean).join(' and ');
      log(parts ? `the storm ridden out, at ${parts}` : 'the storm ridden out, with nothing left to lose');
      break;
    }
    case 'storm:lighten': {
      const [lo, hi] = lightenRange(w.gold);
      const lost = Math.min(w.gold, between([lo, hi]));
      w = { ...w, gold: w.gold - lost };
      log(`${lost} thrown over the side, and the ship rides light through the storm`);
      break;
    }
    case 'storm:run': {
      const days = between(STORM_RUN);
      w = { ...w, calm: w.turn + days };
      log(`running before the storm: ${days} days driven off your course`);
      break;
    }
    case 'fever:press':
    case 'fever:nurse': {
      const how = key as 'press' | 'nurse';
      const dead = feverDeaths(w, how, r);
      w = { ...w, crew: w.crew - dead, ...(how === 'nurse' ? { calm: w.turn + FEVER_NURSE_DAYS } : {}) };
      log(`${how === 'nurse' ? 'lying to while the sick are nursed' : 'pressing on through the fever'}: ${dead ? `${hands(dead)} dead of it` : 'nobody lost'}`);
      break;
    }
    case 'foul:drink': {
      const dead = fluxDeaths(w, r);
      w = { ...w, crew: w.crew - dead };
      log(dead ? `the foul water drunk, and the flux: ${hands(dead)} dead of it` : 'the foul water drunk, and nobody the worse');
      break;
    }
    case 'foul:heave':
      w = { ...w, stores: { ...w.stores, water: Math.round(w.stores.water * (1 - FOUL_LOST)) } };
      log('the foul casks heaved over the side');
      break;
    case 'weevils:eat': {
      const dead = Math.min(w.crew, deaths(r, WEEVIL_SICK));
      w = { ...w, crew: w.crew - dead };
      log(dead ? 'the weevils eaten with the bread, and a hand sickened of it and died' : 'the weevils eaten with the bread, and the hands grumbling');
      break;
    }
    case 'weevils:heave':
      w = { ...w, stores: { ...w.stores, food: Math.round(w.stores.food * (1 - WEEVIL_LOST)) } };
      log('the worst of the bread heaved over the side');
      break;
    case 'leak:fother':
      w = { ...w, calm: Math.max(w.calm, w.turn + 1), stores: { ...w.stores, spares: w.stores.spares - 1 } };
      log('a sail fothered under her bottom, and the leak taken up');
      break;
    case 'leak:pump': {
      const lost = Math.min(LEAK_HULL, w.hull - 1);
      w = { ...w, hull: w.hull - lost };
      log(`pumping watch and watch, and pressing on: ${lost} hull`);
      break;
    }
    case 'wreck:board': {
      w = { ...w, calm: Math.max(w.calm, w.turn + WRECK_DAYS) };
      const cap = capacity(w);
      const luck = roll(r);
      if (luck < 0.4) {
        w = { ...w, stores: { food: topUp(w.stores.food, w.crew * 12, cap.food), water: topUp(w.stores.water, w.crew * 10, cap.water), spares: topUp(w.stores.spares, 1, cap.spares), powder: topUp(w.stores.powder, 1, cap.powder) } };
        log('the wreck boarded: biscuit, casks, canvas and powder out of her hold');
      } else if (luck < 0.65) {
        const gold = between(WRECK_GOLD);
        w = { ...w, gold: w.gold + gold };
        log(`the wreck boarded: a strongbox in the great cabin, ${gold} in it`);
      } else if (luck < 0.85) {
        log('the wreck boarded: stripped already, nothing in her but water');
      } else {
        const dead = Math.min(w.crew, between(WRECK_SICK));
        w = { ...w, crew: w.crew - dead };
        log(`the wreck boarded, and the sickness that emptied her came back with the boarders: ${hands(dead)} dead of it`);
      }
      break;
    }
    case 'wreck:sail':
      log('the wreck left to drift');
      break;
    case 'canoes:trade': {
      const cap = capacity(w);
      w = { ...w, gold: w.gold - CANOE_COST, fresh: 0, stores: { ...w.stores, water: Math.max(w.stores.water, cap.water), food: topUp(w.stores.food, w.crew * CANOE_DAYS, cap.food) } };
      log('beads and knives for coconuts, fish and fresh water');
      break;
    }
    case 'canoes:alongside': {
      const cap = capacity(w);
      w = { ...w, fresh: 0, stores: { ...w.stores, food: topUp(w.stores.food, w.crew * 7, cap.food) } };
      if (w.stores.spares > 0) {
        w = { ...w, stores: { ...w.stores, spares: w.stores.spares - 1 } };
        log('fruit for all hands, and a bundle of the spares gone over the side into a canoe');
      } else {
        const gone = Math.min(w.gold, 5);
        w = { ...w, gold: w.gold - gone };
        log(`fruit for all hands, and ${gone} gone from the cabin before they were off`);
      }
      break;
    }
    case 'canoes:warn':
      w = { ...w, stores: { ...w.stores, powder: w.stores.powder - 1 } };
      log('a gun fired over the canoes, and they turn back for the beach');
      break;
    case 'reef:lighten':
      if (w.spice > 0) {
        const over = Math.ceil(w.spice / 2);
        w = { ...w, spice: w.spice - over };
        log(`${over} tons of spice over the side, and she floats off`);
      } else {
        w = { ...w, stores: { ...w.stores, powder: Math.max(0, w.stores.powder - 2), food: Math.round(w.stores.food * 0.75) } };
        log('powder and food over the side, and she floats off');
      }
      break;
    case 'reef:wait': {
      const days = between(REEF_DAYS);
      w = { ...w, calm: Math.max(w.calm, w.turn + days) };
      if (roll(r) < 0.5) {
        const lost = Math.min(between(REEF_HULL), w.hull - 1);
        w = { ...w, hull: w.hull - lost };
        log(`${days} days fast on the reef, pounding: ${lost} hull, and then the tide lifts her`);
      } else log(`${days} days fast on the reef, and the tide lifts her off unhurt`);
      break;
    }
    case 'gentleman:try':
      w = { ...w, crew: w.crew - 1 };
      log('the gentleman tried before the company and beheaded on the beach. nobody talks of drowning now');
      break;
    case 'gentleman:maroon': {
      const friends = Math.min(w.crew - 1, between([0, 2]));
      w = { ...w, crew: w.crew - 1 - friends };
      log(`the gentleman put ashore with his chest${friends ? `, and ${hands(friends)} went with him` : ', alone'}`);
      break;
    }
    case 'gentleman:leave':
      w = { ...w, seen: [...w.seen, 'discontent'] };
      log('you let it be, and the grumbling goes on below');
      break;
    case 'deserters:go': {
      const lost = Math.min(w.crew, between(DESERTERS));
      w = { ...w, crew: w.crew - lost };
      log(`${hands(lost)} paid off to stay in the islands`);
      break;
    }
    case 'deserters:watch': {
      w = { ...w, calm: Math.max(w.calm, w.turn + 1) };
      if (roll(r) < 1 / 3) {
        const lost = Math.min(w.crew, between(SLIP_AWAY));
        w = { ...w, crew: w.crew - lost };
        log(`the watch doubled, and still ${hands(lost)} slipped over the side in the night`);
      } else log('the watch doubled, and every hand aboard when she sails');
      break;
    }
  }
  return { ...w, rng: r.rng };
}
