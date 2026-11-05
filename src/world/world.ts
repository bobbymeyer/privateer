/**
 * The voyage's state, and a day of it. Pure: the same seed and the same
 * choices give the same voyage, so a run can be saved, replayed and tested.
 *
 * Nothing else sails. The sea is the chart and its lanes; the ship keeps to
 * them from landmark to landmark. What happens on the way — the weather, the
 * sickness, a sail sighted — is rolled for each day as it comes.
 */

import type { RngState } from '../rng.ts';
import { SHIP_CLASSES } from '../outfit.ts';
import { buildMap, type NodeId, portNamed, type SeaMap } from './map.ts';
import { type Roller, roll } from './random.ts';
import type { Dilemma } from './dilemmas.ts';
import { aDay } from './events.ts';
import { type Hail, type Meeting, type Reckoning, sailSighted } from './meet.ts';
import { type FightRecord, NO_TALLY, type Tally } from './record.ts';
import { START_VOYAGE, type Voyage, raise } from './journey.ts';
import { type Pace, type Rations, type Stores, startCrew, startStores } from './stores.ts';

/** The chart: the lanes, and where each landmark lies on them. The same for every run. */
export interface Sea {
  map: SeaMap;
}

export interface WorldState {
  rng: RngState;
  /** Days since you set out. */
  turn: number;
  player: NodeId;
  /** The ship you chose at Plymouth: see SHIP_CLASSES. */
  ship: string;
  hull: number;
  maxHull: number;
  /** Hands aboard. Too few and she can't be sailed. */
  crew: number;
  /** Provisions and water in rations, spares in bundles, powder in barrels. See stores.ts. */
  stores: Stores;
  /** Days since fresh food: past six weeks, the scurvy kills. */
  fresh: number;
  rations: Rations;
  pace: Pace;
  /** Becalmed, anchored against the williwaws, or driven before a storm: no way made until this turn. */
  calm: number;
  gold: number;
  /** The landmark you last raised, the one you're bound for, and every one raised. */
  voyage: Voyage;
  /** An event waiting on your choice: a storm, fever, foul water. While there is one, the voyage waits. */
  dilemma: Dilemma | null;
  /** A sail sighted, waiting on your choice: attack, or let her pass. */
  hail: Hail | null;
  /** The fight at hand. */
  encounter: Meeting | null;
  /** How the last fight ended. */
  reckoning: Reckoning | null;
  /** The Spanish towns you've raided, by landmark: each once. A raid on the coast of Chile and Peru warns the treasure ship. */
  raided: string[];
  /** Tons of spice in the hold, cloves or pepper, to sell on the quay at home. */
  spice: number;
  /** What has happened that happens once a voyage, and grievances carried to the next landmark. See happenings.ts. */
  seen: string[];
  /** Home: the run is won. */
  won: boolean;
  /** Lost: sunk, or too few hands to work her. The run is over. */
  sunk: boolean;
  ending: 'home' | null;
  /** The run's fights and prizes, counted. */
  tally: Tally;
  /** The last fight, told: what the end of a run shows. */
  lastFight: FightRecord | null;
  log: LogEntry[];
}

/** A line of the log. `stop`: worth stopping for, when you're under sail. */
export interface LogEntry {
  turn: number;
  text: string;
  stop?: boolean;
}

let built: Sea | null = null;

/** The chart is the same every run: built once, then shared. */
export function createSea(): Sea {
  if (!built) built = { map: buildMap() };
  return built;
}

/** The day you set out: 1 December 1580, three months after Drake came home. */
export const SET_OUT = Date.UTC(1580, 11, 1);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** The date on a day of the voyage: `14 March 1581`. */
export function dateOf(turn: number): string {
  const d = new Date(SET_OUT + turn * 86400000);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** A new voyage, in the ship you chose, at Plymouth with her purse. */
export function createWorld(sea: Sea, seed: number, ship = 'pinnace'): WorldState {
  const c = SHIP_CLASSES[ship];
  if (!c) throw new Error(`no such ship: ${ship}`);
  const r: Roller = { rng: (seed ^ 0x0ce4) >>> 0 };
  roll(r);
  return {
    rng: r.rng,
    turn: 0,
    player: portNamed(sea.map, 'Plymouth'),
    ship,
    hull: c.hull,
    maxHull: c.hull,
    crew: startCrew(ship),
    stores: startStores(ship),
    fresh: 0,
    rations: 'full',
    pace: 'steady',
    calm: 0,
    gold: c.purse,
    voyage: START_VOYAGE,
    dilemma: null,
    hail: null,
    encounter: null,
    reckoning: null,
    raided: [],
    spice: 0,
    seen: [],
    won: false,
    sunk: false,
    ending: null,
    tally: NO_TALLY,
    lastFight: null,
    log: [],
  };
}

/** Something waiting on you: the voyage doesn't go on until it's answered. */
export const waiting = (s: WorldState) => !!(s.dilemma || s.hail || s.encounter);

/**
 * A day: you sail to `to` (a neighbour on the lanes, or where you are), and
 * the day happens — the weather, the stores, a landmark raised, a sail.
 */
export function advance(sea: Sea, s: WorldState, to: NodeId): WorldState {
  if (s.sunk) throw new Error('the ship is lost; the voyage is over');
  if (s.won) throw new Error('you are home');
  if (s.encounter) throw new Error('there is a fight to finish first');
  if (s.hail) throw new Error('a sail is in sight: attack, or let her pass');
  if (s.dilemma) throw new Error('there is a choice to make first');
  if (to !== s.player && !sea.map.adj[s.player].includes(to)) throw new Error(`node ${to} is not next to ${s.player}`);
  let next: WorldState = { ...s, turn: s.turn + 1, player: to };
  next = aDay(sea, next);
  if (next.sunk) return next;
  next = raise(sea, next);
  if (next.won || next.hail) return next;
  return sailSighted(sea, next);
}
