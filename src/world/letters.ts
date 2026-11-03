/**
 * Letters of marque: what a run is made of. A run is three of them, each
 * an act — a nation, a region, a task, a deadline and a reward — and the
 * last is a set piece: a treasure ship the Crown wants taken.
 *
 *   I.   near home: take two of their ships in the Narrow Seas or off the
 *        Barbary coast;
 *   II.  farther out: sack one of their towns on the Spanish Main, the coast
 *        of Brazil, or in the Indies;
 *   III. take the plate ship: a Spanish treasure ship, named, with sure word
 *        of where she is, sailing stronger and richer than ever.
 *
 * A letter makes its nation fair game while it lasts, whatever the war table
 * says: that is what a letter of reprisal was. Finish one and the reward is
 * paid and the next comes by the packet. Miss a deadline and the Admiralty
 * grants more time once, grudgingly; miss it again and the letter is
 * revoked, and whatever you take after is piracy. All three, and home to
 * London, is the run won; the gold you bring is the score.
 */

import { type NodeId, ports } from './map.ts';
import { type Nation, adjective, nationName } from './ports.ts';
import { type Roller, pick } from './random.ts';
import { makeRumor } from './rumors.ts';
import type { Sea } from './ships.ts';
import { isEnemy } from './wars.ts';
import type { WorldState } from './world.ts';

/** A box of longitude and latitude: west, south, east, north. */
export type Box = [number, number, number, number];

export interface Region {
  name: string;
  box: Box;
  /** Whose ships and towns a letter for this region may name. */
  nations: Nation[];
}

export const REGIONS: Record<string, Region> = {
  'narrow-seas': { name: 'the Narrow Seas', box: [-12, 43, 10, 60], nations: ['france', 'netherlands', 'spain'] },
  barbary: { name: 'the Barbary coast', box: [-20, 25, 20, 40], nations: ['barbary', 'morocco'] },
  main: { name: 'the Spanish Main', box: [-100, 5, -55, 30], nations: ['spain', 'france', 'netherlands'] },
  brazil: { name: 'the coast of Brazil', box: [-55, -35, -30, 2], nations: ['portugal', 'netherlands'] },
  indies: { name: 'the Indies', box: [40, -15, 130, 25], nations: ['portugal', 'netherlands'] },
};

const NEAR = ['narrow-seas', 'barbary'];
const FAR = ['main', 'brazil', 'indies'];

export type Task =
  /** Take `count` of the nation's ships in the region. */
  | { kind: 'prizes'; count: number }
  /** Sack one of the nation's towns in the region. */
  | { kind: 'sack' }
  /** Take this ship: the act's set piece. */
  | { kind: 'take'; shipId: number };

export interface Letter {
  /** 1, 2 or 3. */
  act: number;
  nation: Nation;
  /** A key of REGIONS; null for the set piece, which goes where its ship goes. */
  region: string | null;
  task: Task;
  /** How far along: prizes taken so far. */
  progress: number;
  issued: number;
  deadline: number;
  reward: number;
  /** The Admiralty has granted more time once already. */
  renewed: boolean;
}

export const ACTS = 3;
/** Days each act is given, and what each pays. */
export const DAYS = [120, 160, 220];
export const REWARD = [25, 45, 80];
/** Prizes the first act wants. */
export const PRIZES = 2;
/** More time, once: this share of the act's days again. */
export const EXTENSION = 0.5;
/** And what asking for it costs with England. */
export const LATE_STANDING = 2;
/** The set piece sails stronger and richer than her sisters. */
export const PLATE_HULL = 0;
export const PLATE_CARGO = 25;

export const inBox = (box: Box, lon: number, lat: number) => lon >= box[0] && lon <= box[2] && lat >= box[1] && lat <= box[3];
export const inRegion = (sea: Sea, region: string, node: NodeId) => {
  const n = sea.map.nodes[node];
  return inBox(REGIONS[region].box, n.lon, n.lat);
};

/** A region's ports of a nation: where its ships come and go, and towns to sack. */
const portsOf = (sea: Sea, region: string, nation: Nation, open = false) =>
  ports(sea.map).filter((p) => inRegion(sea, region, p) && sea.map.nodes[p].port!.nation === nation && (!open || !sea.map.nodes[p].port!.fort));

/**
 * The letter for an act. The nation is one England is at war with if the
 * region has one, else any of the region's; a town to sack must be an open
 * one; the set piece is a Spanish treasure ship that's at sea.
 */
export function issue(sea: Sea, s: WorldState, act: number, r: Roller): Letter {
  const base = { act, progress: 0, issued: s.turn, deadline: s.turn + DAYS[act - 1], reward: REWARD[act - 1], renewed: false };
  if (act === ACTS) {
    const plate = s.ships.filter((x) => (x.kind === 'treasure-ship' || x.kind === 'treasure-fleet') && x.nation === 'spain');
    const ship = pick(r, plate.filter((x) => x.laidUp <= s.turn).length ? plate.filter((x) => x.laidUp <= s.turn) : plate);
    return { ...base, nation: 'spain', region: null, task: { kind: 'take', shipId: ship.id } };
  }
  // Prizes need traffic: a nation with two ports in the region at least. A sack needs an open town.
  const options = (act === 1 ? NEAR : FAR).flatMap((key) =>
    REGIONS[key].nations.filter((n) => (act === 1 ? portsOf(sea, key, n).length >= 2 : portsOf(sea, key, n, true).length > 0)).map((nation) => ({ key, nation })),
  );
  const atWar = options.filter((o) => isEnemy(s.wars, o.nation));
  const { key, nation } = pick(r, atWar.length ? atWar : options);
  return { ...base, nation, region: key, task: act === 1 ? { kind: 'prizes', count: PRIZES } : { kind: 'sack' } };
}

/** The letter's nation is fair game while it lasts, at war or not. */
export const reprisal = (s: WorldState, nation: Nation) => !!s.letter && s.letter.nation === nation;

/** A letter and its terms, in words. */
export function describeLetter(sea: Sea, s: WorldState, l: Letter): { title: string; task: string; terms: string } {
  const flag = adjective(l.nation);
  const where = l.region ? REGIONS[l.region].name : null;
  const task =
    l.task.kind === 'prizes'
      ? `take ${l.task.count} ${flag} ships in ${where}: ${l.progress} of ${l.task.count} so far`
      : l.task.kind === 'sack'
        ? `sack a ${flag} town in ${where}`
        : `take the ${(s.ships.find((x) => x.id === (l.task as { shipId: number }).shipId)?.routeName ?? 'treasure')} ${s.ships.find((x) => x.id === (l.task as { shipId: number }).shipId)?.kind.replace('-', ' ') ?? 'ship'}, the plate ship, wherever she is`;
  const left = l.deadline - s.turn;
  return {
    title: `letter ${['', 'one', 'two', 'three'][l.act]} of ${ACTS}: against ${nationName(l.nation)}`,
    task,
    terms: `${l.reward} on its return · ${left > 0 ? `${left} days left` : 'due'}${l.renewed ? ' · already extended once' : ''}`,
  };
}

/** Whether a prize or a sack, just settled, counts toward the letter. */
export function counts(sea: Sea, l: Letter, what: { shipId: number; port: NodeId | null; nation: Nation; at: NodeId; taken: boolean }): boolean {
  if (!what.taken || what.nation !== l.nation) return false;
  if (l.task.kind === 'take') return what.shipId === l.task.shipId;
  if (l.task.kind === 'sack') return what.port !== null && inRegion(sea, l.region!, what.port);
  return what.port === null && inRegion(sea, l.region!, what.at);
}

/** A prize or a sack that counts: progress, and if that finishes the act, the reward and the next letter. */
export function advanceLetter(sea: Sea, s: WorldState): WorldState {
  const l = s.letter!;
  const progress = l.progress + 1;
  const done = l.task.kind !== 'prizes' || progress >= l.task.count;
  if (!done) return { ...s, letter: { ...l, progress }, log: [...s.log, { turn: s.turn, text: `a prize for your letter: ${progress} of ${(l.task as { count: number }).count}` }] };
  const paid: WorldState = { ...s, gold: s.gold + l.reward, acts: s.acts + 1 };
  const log = [...s.log, { turn: s.turn, text: `letter ${['', 'one', 'two', 'three'][l.act]} done, and ${l.reward} from the Crown`, stop: true }];
  if (l.act === ACTS) {
    return { ...paid, letter: null, commission: 'done', log: [...log, { turn: s.turn, text: 'all three letters done: home to London, and the run is won', stop: true }] };
  }
  const r: Roller = { rng: s.rng };
  const next = issue(sea, paid, l.act + 1, r);
  const w: WorldState = { ...paid, rng: r.rng, letter: next, log: [...log, { turn: s.turn, text: `a new letter by the packet: ${describeLetter(sea, paid, next).task}`, stop: true }] };
  return intelligence(sea, w, next);
}

/** Word of the plate ship comes this often while you hunt her, from the Admiralty's agents. */
export const WORD_EVERY = 30;
/** And a letter for prizes comes with word of this many of the nation's ships in the region. */
export const INTELLIGENCE = 2;

/**
 * What the Admiralty knows when it sends a letter: where the plate ship
 * is, or where a couple of the nation's ships are in the region.
 */
export function intelligence(sea: Sea, s: WorldState, l: Letter): WorldState {
  if (l.task.kind === 'take') return sureWord(sea, s, l.task.shipId);
  if (l.task.kind !== 'prizes') return s;
  const r: Roller = { rng: s.rng };
  let w = s;
  const there = s.ships.filter((x) => x.nation === l.nation && x.laidUp <= s.turn && x.kind !== 'hunter' && inRegion(sea, l.region!, x.node));
  for (let i = 0; i < INTELLIGENCE && there.length; i++) {
    const ship = there.splice(there.indexOf(pick(r, there)), 1)[0];
    w = { ...w, rumors: [...w.rumors, makeRumor(sea, r, w.nextRumor, ship, s.turn, 0.8)], nextRumor: w.nextRumor + 1 };
  }
  return { ...w, rng: r.rng };
}

/** Sure word of the plate ship: where she is today, from the Admiralty's own agents. */
export function sureWord(sea: Sea, s: WorldState, shipId: number): WorldState {
  const ship = s.ships.find((x) => x.id === shipId)!;
  const r: Roller = { rng: s.rng };
  const rumor = makeRumor(sea, r, s.nextRumor, ship, s.turn, 1);
  return { ...s, rng: r.rng, rumors: [...s.rumors, rumor], nextRumor: s.nextRumor + 1 };
}

/** A day under a letter: word of the plate ship now and then, and the deadline. */
export function letterDay(sea: Sea, s: WorldState): WorldState {
  const l = s.letter;
  if (l?.task.kind === 'take' && s.turn > l.issued && (s.turn - l.issued) % WORD_EVERY === 0) {
    s = { ...sureWord(sea, s, l.task.shipId), log: [...s.log, { turn: s.turn, text: 'fresh word of the plate ship from the Admiralty' }] };
  }
  return checkDeadline(s);
}

/** The deadline: more time once, at a price, then the letter's revoked. */
export function checkDeadline(s: WorldState): WorldState {
  const l = s.letter;
  if (!l || s.turn <= l.deadline) return s;
  if (!l.renewed) {
    const more = Math.round(DAYS[l.act - 1] * EXTENSION);
    return {
      ...s,
      letter: { ...l, deadline: l.deadline + more, renewed: true },
      standing: { ...s.standing, england: (s.standing.england ?? 0) - LATE_STANDING },
      log: [...s.log, { turn: s.turn, text: `your letter is overdue: the Admiralty grants ${more} days more, and won't forget it`, stop: true }],
    };
  }
  return {
    ...s,
    letter: null,
    commission: 'revoked',
    pirate: true,
    standing: { ...s.standing, england: Math.min(s.standing.england ?? 0, -3) },
    log: [...s.log, { turn: s.turn, text: "your letter is revoked: whatever you take now is piracy, and England will hang you for it. a pirate's haven will have you, rich", stop: true }],
  };
}

/** Revoked for piracy: an English ship fired on ends the commission. */
export const revoke = (s: WorldState): WorldState => (s.commission === 'active' ? { ...s, letter: null, commission: 'revoked' } : s);

