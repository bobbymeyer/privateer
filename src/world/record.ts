/**
 * What a run did, kept as it goes: a tally of its fights and prizes, and
 * the last fight told round by round. The end of a run shows both, so a
 * loss says how it was lost, and the logbook keeps the tally.
 */

import { describeEvent } from '../describe.ts';
import type { EncounterState } from '../rules.ts';
import type { Nation } from './ports.ts';
import { adjective, article } from './ports.ts';
import type { TargetKind } from '../setup.ts';

export interface Tally {
  fights: number;
  /** Ships taken or sunk, monsters killed, canoes beaten off. */
  taken: number;
  sacks: number;
  /** You got away. */
  fled: number;
  /** She got away. */
  escaped: number;
  /** The best single prize: what it paid, and what it was. */
  best: { payout: number; what: string } | null;
}

export const NO_TALLY: Tally = { fights: 0, taken: 0, sacks: 0, fled: 0, escaped: 0, best: null };

export interface FightRecord {
  /** Who: `a Spanish hunter`, `the raid on Maracaibo`. */
  what: string;
  kind: TargetKind;
  nation: Nation;
  outcome: string;
  rounds: number;
  /** Your hull going in, and coming out. */
  hullIn: number;
  hullOut: number;
  maxHull: number;
  /** Hers, at the end. */
  theirHull: number;
  theirMax: number;
  /** Wounds against you still in the deck or the hand when it ended: what was dragging you down. */
  woundsOnYou: number;
  /** The last rounds, a line per card played and per effect, oldest first. */
  lastRounds: { round: number; lines: string[] }[];
}

/** How many of the last rounds to keep. */
export const ROUNDS_KEPT = 3;

/** Who she was, in words. */
export function whatOf(kind: TargetKind, nation: Nation, place: string | null, sea: string | null): string {
  if (kind === 'monster') return `the monster of the ${sea ?? 'sea'}`;
  if (kind === 'canoes') return `war canoes off ${place}`;
  if (place) return `the raid on ${place}`;
  const flag = adjective(nation);
  return `${article(flag)} ${flag} ${kind === 'hunter' ? 'guard ship' : kind.replace('-', ' ')}`;
}

/** The fight just ended, as a record: how it went, and its last rounds told. */
export function recordFight(f: EncounterState, what: string, kind: TargetKind, nation: Nation, hullIn: number): FightRecord {
  const rounds: Map<number, string[]> = new Map();
  for (const e of f.events) {
    if (e.type !== 'played' && e.type !== 'effect' && e.type !== 'chain' && e.type !== 'ended') continue;
    const line = e.type === 'effect' ? `  ${describeEvent(e)}` : describeEvent(e);
    if (!line) continue;
    if (!rounds.has(e.round)) rounds.set(e.round, []);
    rounds.get(e.round)!.push(line);
  }
  const kept = [...rounds.entries()].slice(-ROUNDS_KEPT).map(([round, lines]) => ({ round, lines }));
  return {
    what,
    kind,
    nation,
    outcome: f.outcome ?? 'parted',
    rounds: f.round,
    hullIn,
    hullOut: f.ship.hull,
    maxHull: f.ship.maxHull,
    theirHull: f.target.hull,
    theirMax: f.target.maxHull,
    woundsOnYou: [...f.deck, ...f.hand].filter((c) => c.damage && c.side === 'ship').length,
    lastRounds: kept,
  };
}

/** The tally, after a fight. */
export function tallied(t: Tally, outcome: string, payout: number, what: string, sack: boolean): Tally {
  const best = payout > (t.best?.payout ?? 0) && outcome !== 'sunk' ? { payout, what } : t.best;
  return {
    fights: t.fights + 1,
    taken: t.taken + (outcome === 'destroyed' && !sack ? 1 : 0),
    sacks: t.sacks + (outcome === 'destroyed' && sack ? 1 : 0),
    fled: t.fled + (outcome === 'fled' ? 1 : 0),
    escaped: t.escaped + (outcome === 'escaped' ? 1 : 0),
    best,
  };
}
