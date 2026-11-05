/**
 * Events that ask you something. A storm, a crew wanting their shares, a
 * castaway on a beach: each stops the world and offers a few choices, and
 * each choice says what it stakes before you make it. The odds are told
 * plainly — a captain of the century knew what a storm could do — so the
 * choice is about what you can afford, not a guess.
 */

import { CREW, SHIP_CLASSES } from '../outfit.ts';
import { type Roller, pick, roll } from './random.ts';
import { legWeight } from './sea.ts';
import type { Sea } from './ships.ts';
import { cheer } from './events.ts';
import { refit } from './port.ts';
import { type WorldState, advance } from './world.ts';
import { FEVER_NURSE, FEVER_NURSE_DAYS, FEVER_PRESS, FLUX, FOUL_LOST, WEEVIL_LOST, feverDeaths, fluxDeaths } from './weather.ts';

export type Dilemma =
  /** A storm: ride it out, run before it, or lighten ship. */
  | { kind: 'storm' }
  /** The crew want their shares: pay, promise, or stand firm. */
  | { kind: 'shares'; cost: number }
  /** A man on the beach of an island nobody has charted, who says he's a `role`. */
  | { kind: 'castaway'; role: string }
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

/** Riding out a storm costs this much hull, never the last point. */
export const STORM_HULL = [1, 3] as const;
/** Running before it carries you this many days downwind. */
export const STORM_RUN = [2, 4] as const;
/** Lightening ship throws over this share of the purse, and no more than JETTISON_CAP. */
export const LIGHTEN = [0.1, 0.25] as const;
export const JETTISON_CAP = 30;
/** The crew ask for their shares when their morale falls this low. */
export const SHARES_AT = 3;
/** Promised shares: the crew's cut of the next prize. */
export const PROMISED_SHARE = 0.25;
/** A castaway who isn't what he says: one in this many. */
export const CASTAWAY_LIAR = 0.25;
/** Land sighted, and a man on the beach: this often. */
export const CASTAWAY_CHANCE = 0.5;

const range = ([a, b]: readonly [number, number]) => `${a} to ${b}`;
const lightenRange = (gold: number) => {
  const share = (k: number) => Math.min(JETTISON_CAP, Math.max(1, Math.round(gold * k)));
  return [share(LIGHTEN[0]), share(LIGHTEN[1])] as const;
};

/** The crew's shares: a tenth of the purse, and never less than 5. */
export const sharesCost = (gold: number) => Math.max(5, Math.round(gold * 0.1));

export function describe(d: Dilemma): { title: string; text: string } {
  switch (d.kind) {
    case 'storm':
      return { title: 'a storm', text: 'the glass is falling and the sea getting up. there is time to choose how to meet it.' };
    case 'shares':
      return { title: 'the crew want their shares', text: 'the hands have had nothing for weeks, and they have sent a man aft to say so.' };
    case 'castaway':
      return { title: 'a man on the beach', text: `there's a man on the beach waving a shirt. he says he's a ${CREW[d.role].name}, cast away from a ship that went down.` };
    case 'fever':
      return { title: 'fever aboard', text: 'a dozen hands in their hammocks, burning and raving. the surgeon, if you have one, wants them still and in the shade.' };
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
        { key: 'ride', label: 'ride it out', stakes: `lose ${range(STORM_HULL)} hull, never the last` },
        { key: 'run', label: 'run before it', stakes: `no damage, but driven ${range(STORM_RUN)} days downwind, off your course` },
        { key: 'lighten', label: 'lighten ship', stakes: `throw ${lo === hi ? lo : `${lo} to ${hi}`} gold over the side, and no damage`, ...(s.gold <= 0 ? { barred: 'nothing aboard to throw over' } : {}) },
      ];
    }
    case 'shares':
      return [
        { key: 'pay', label: 'pay them', stakes: `${d.cost} gold, and morale up 3`, ...(s.gold < d.cost ? { barred: 'not enough in the purse' } : {}) },
        { key: 'promise', label: 'promise them the next prize', stakes: `morale up 1 now, and a quarter of the next prize is theirs` },
        { key: 'refuse', label: 'stand firm', stakes: 'even odds: they back down (morale up 1), or they go forward grumbling (morale down 1)' },
      ];
    case 'castaway': {
      const full = s.outfit.crew.length >= SHIP_CLASSES[s.outfit.ship].berths;
      return [
        { key: 'take', label: 'take him aboard', stakes: `a ${CREW[d.role].name} for nothing, but one in four is a liar and a Jonah: no hand, and morale down 2`, ...(full ? { barred: 'no berth for him' } : {}) },
        { key: 'leave', label: 'leave him', stakes: 'sail on' },
      ];
    }
    case 'fever': {
      const half = s.outfit.crew.includes('surgeon') ? ', halved by your surgeon' : '';
      return [
        { key: 'press', label: 'press on', stakes: `${range(FEVER_PRESS)} hands dead of it${half}` },
        { key: 'nurse', label: 'lie to and nurse them', stakes: `${FEVER_NURSE_DAYS} days making no way, and ${range(FEVER_NURSE)} dead${half}` },
      ];
    }
    case 'foul':
      return [
        { key: 'drink', label: 'drink it', stakes: `the flux: ${range(FLUX)} hands dead of it${s.outfit.crew.includes('surgeon') ? ', halved by your surgeon' : ''}` },
        { key: 'heave', label: 'heave it over', stakes: `lose half the water: ${Math.round(s.stores.water * FOUL_LOST)} rations` },
      ];
    case 'weevils':
      return [
        { key: 'eat', label: 'eat it anyway', stakes: 'morale down 1' },
        { key: 'heave', label: 'heave the worst over', stakes: `lose a quarter of the food: ${Math.round(s.stores.food * WEEVIL_LOST)} rations` },
      ];
  }
}

/** Make the choice. Throws if there's nothing to choose, or the choice is barred. */
export function choose(sea: Sea, s: WorldState, key: string): WorldState {
  const d = s.dilemma;
  if (!d) throw new Error('there is nothing to choose');
  const c = choices(s, d).find((x) => x.key === key);
  if (!c) throw new Error(`no choice ${key}`);
  if (c.barred) throw new Error(c.barred);
  const r: Roller = { rng: s.rng };
  let w: WorldState = { ...s, dilemma: null };
  const log = (text: string) => (w = { ...w, log: [...w.log, { turn: w.turn, text }] });
  const between = ([a, b]: readonly [number, number]) => a + Math.floor(roll(r) * (b - a + 1));

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
    case 'storm:run':
      w = { ...w, rng: r.rng };
      return runBefore(sea, w, between(STORM_RUN), r);
    case 'shares:pay':
      w = cheer({ ...w, gold: w.gold - (d as { cost: number }).cost }, 3);
      log(`shares paid out, ${(d as { cost: number }).cost}, and the crew in better heart`);
      break;
    case 'shares:promise':
      w = cheer({ ...w, promised: true }, 1);
      log('the crew are promised a quarter of the next prize');
      break;
    case 'shares:refuse':
      if (roll(r) < 0.5) {
        w = cheer(w, 1);
        log('you stood firm, and the crew backed down');
      } else {
        w = { ...w, morale: w.morale - 1 };
        log('you stood firm, and the crew went forward grumbling');
      }
      break;
    case 'castaway:take': {
      const role = (d as { role: string }).role;
      if (roll(r) < CASTAWAY_LIAR) {
        w = { ...w, morale: w.morale - 2 };
        log(`the castaway was no ${CREW[role].name}, and the hands call him a Jonah`);
      } else {
        w = refit(w, { ...w.outfit, crew: [...w.outfit.crew, role] });
        log(`the castaway was a ${CREW[role].name} after all, and signs on`);
      }
      break;
    }
    case 'castaway:leave':
      log('you left the castaway on his beach');
      break;
    case 'fever:press':
    case 'fever:nurse': {
      const how = key as 'press' | 'nurse';
      const dead = feverDeaths(w, how, r);
      w = { ...w, crew: w.crew - dead, ...(how === 'nurse' ? { calm: w.turn + FEVER_NURSE_DAYS } : {}) };
      log(`${how === 'nurse' ? 'lying to while the sick are nursed' : 'pressing on through the fever'}: ${dead ? `${dead === 1 ? 'a hand' : `${dead} hands`} dead of it` : 'nobody lost'}`);
      break;
    }
    case 'foul:drink': {
      const dead = fluxDeaths(w, r);
      w = { ...w, crew: w.crew - dead };
      log(dead ? `the foul water drunk, and the flux: ${dead === 1 ? 'a hand' : `${dead} hands`} dead of it` : 'the foul water drunk, and nobody the worse');
      break;
    }
    case 'foul:heave':
      w = { ...w, stores: { ...w.stores, water: Math.round(w.stores.water * (1 - FOUL_LOST)) } };
      log('the foul casks heaved over the side');
      break;
    case 'weevils:eat':
      w = { ...w, morale: w.morale - 1 };
      log('the weevils eaten with the bread, and the hands grumbling');
      break;
    case 'weevils:heave':
      w = { ...w, stores: { ...w.stores, food: Math.round(w.stores.food * (1 - WEEVIL_LOST)) } };
      log('the worst of the bread heaved over the side');
      break;
  }
  return { ...w, rng: r.rng };
}

/** Run before a storm: `days` days, each the leg the wind and current most favour, till something stops you. */
function runBefore(sea: Sea, s: WorldState, days: number, r: Roller): WorldState {
  let w = { ...s, log: [...s.log, { turn: s.turn, text: `running before the storm, ${days} days downwind` }] };
  for (let i = 0; i < days; i++) {
    const out = sea.map.adj[w.player];
    if (!out.length) break;
    const weights = out.map((m) => legWeight(sea.map, sea.pattern, w.player, m, w.turn));
    const best = Math.max(...weights);
    w = advance(sea, w, pick(r, out.filter((_, k) => weights[k] === best)));
    if (w.encounter || w.hail || w.spoil || w.dilemma || w.sunk || w.won) break;
  }
  return w;
}

/** A man on the beach, maybe, at land just sighted: one who says he's a hand you haven't got. */
export function castaway(s: WorldState, r: Roller): Dilemma | null {
  const roles = Object.keys(CREW).filter((k) => !s.outfit.crew.includes(k));
  if (!roles.length || roll(r) >= CASTAWAY_CHANCE) return null;
  return { kind: 'castaway', role: pick(r, roles) };
}
