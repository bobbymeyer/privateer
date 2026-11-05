/**
 * Events that ask you something: a storm, fever aboard, the water gone
 * foul, weevils in the bread. Each stops the voyage and offers a few
 * choices, and each choice says what it stakes before you make it. The odds
 * are told plainly — a captain of the century knew what a storm could do —
 * so the choice is about what you can afford, not a guess.
 */

import { type Roller, roll } from './random.ts';
import { deaths } from './stores.ts';
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
  | { kind: 'weevils' };

export interface Choice {
  key: string;
  label: string;
  /** What it stakes, told plainly. */
  stakes: string;
  /** Why it can't be chosen, if it can't. */
  barred?: string;
}

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
  }
  return { ...w, rng: r.rng };
}
