/**
 * The world between encounters: you, the other ships, the turn, and what you
 * have heard. Pure, like the encounter rules: state in, state out.
 *
 * The sea itself — map, currents, wind — is fixed by the seed, so it is
 * built once by `createSea` and passed alongside rather than copied each turn.
 */

import { SEA_NAMES } from './seas.ts';
import type { RngState } from '../rng.ts';
import { buildMap, type NodeId, portNamed, ports } from './map.ts';
import { type Nation, PORTS, adjective, navyOf } from './ports.ts';
import { type Rumor, FADED, makeRumor, markerStrength } from './rumors.ts';
import { buildPattern, type Chart, CURRENT_SEEN, chartKnowledge, type SeaKnowledge, seasonOf, windSeen } from './sea.ts';
import { type FleetEntry, type Pursuit, type Sea, type Ship, type Standing, mayEnter, moveShip, spawnShips } from './ships.ts';
import { type War, atWar, drift, isEnemy, openingWars } from './wars.ts';
import { type Roller, roll } from './random.ts';
import { type Outfit, START_OUTFIT, maxHullOf } from '../outfit.ts';
import { type Hail, type Meeting, REFIT_DAYS, type Reckoning, YOUR_NATION, landfall, meeting } from './meet.ts';
import { MORALE_START, aDay } from './events.ts';
import { type Dilemma, castaway } from './dilemmas.ts';
import { type Letter, intelligence, issue, letterDay } from './letters.ts';
import { type FightRecord, NO_TALLY, type Tally } from './record.ts';

export interface WorldState {
  rng: RngState;
  turn: number;
  player: NodeId;
  ships: Ship[];
  rumors: Rumor[];
  nextRumor: number;
  /** In the purse. */
  gold: number;
  /** How many steps out you can see the water. The crew will extend it. */
  sight: number;
  /** What you have seen of the sea, node by node. See `chartKnowledge`. */
  chart: Chart;
  /** Where each ship has been, the day before first: what the bar's news is made of. */
  trail: NodeId[][];
  /** Rounds bought in this port tonight. Each one finds the drinkers less sober. */
  rounds: number;
  /** Your hull, carried from fight to fight; mended in port. */
  hull: number;
  maxHull: number;
  /** The fight at hand. While there is one, the world waits. */
  encounter: Meeting | null;
  /** How the last fight ended. */
  reckoning: Reckoning | null;
  /** Ships you've parted from, and the turn until which they leave you be. */
  parted: Record<number, number>;
  /** You went down. The run is over. */
  sunk: boolean;
  /** How each nation regards you. Attack its ships and it falls; below zero, its guard ships hunt you. It drifts back toward zero. */
  standing: Standing;
  /** Your ship, its refits, your crew: what your deck is made of. */
  outfit: Outfit;
  /** Uncharted islands, a few to a run, out where nobody sails. */
  islands: { node: NodeId; found: boolean }[];
  /** The run is won: home to London with a score, or retired, a rich pirate, to a haven. */
  won: boolean;
  ending: 'home' | 'retired' | null;
  /** A ship alongside, waiting on your choice. While there is one, the world waits. */
  hail: Hail | null;
  /** You fired on an English ship. England wants you, and London will hang you, until you're pardoned. */
  pirate: boolean;
  /** Ports sacked, and the turn until which they have nothing for anybody. */
  sacked: Record<NodeId, number>;
  /** Nations whose towns you've raided, and the turn until which their guard ships hunt twice as far. */
  alarm: Partial<Record<Nation, number>>;
  /** Who is at war with whom. Opens differently each run, drifts by the season, and you can start a war. */
  wars: War[];
  /** How close your attacks on a nation at peace with England have brought the two to war. At CASUS_BELLI, it's war. */
  tension: Partial<Record<Nation, number>>;
  /** The crew's patience, out of ten. At nothing, mutiny. See events.ts. */
  morale: number;
  /** The day the last prize was taken: the crew count from it. */
  lastSpoils: number;
  /** A prize's stores, waiting on your choice of one card to keep, or none. While there is one, the world waits. */
  spoil: { kind: string; offers: string[] } | null;
  /** The letter of marque in hand: this act's task. Null between acts' end and home, or once revoked. */
  letter: Letter | null;
  /** Letters done. */
  acts: number;
  /**
   * active: sailing under a letter. done: all three done, bound home.
   * revoked: no letter, and a pirate. legacy: a run from before letters,
   * won the old way, with GOAL home to London.
   */
  commission: 'active' | 'done' | 'revoked' | 'legacy';
  /** The run's fights and prizes, counted. */
  tally: Tally;
  /** The last fight, told: what the end of a run shows. */
  lastFight: FightRecord | null;
  /** Towns that turned out a raid short of a sack, on `since`: on their guard till `until`, shut to raiding till `shutUntil`, `level` steps on it, with `cargo` left in the treasury then. */
  guarded: Record<NodeId, { since: number; until: number; shutUntil: number; level: number; cargo: number }>;
  /** An event waiting on your choice: a storm, the crew's shares, a castaway. While there is one, the world waits. */
  dilemma: Dilemma | null;
  /** The crew have been promised a share of the next prize. */
  promised: boolean;
  /** Everything your prizes have paid, all told: how well your name is known. See `renown`. */
  fame: number;
  /** Word is out that you're homeward bound with a fortune. Said once a run. */
  homewardNoised: boolean;
  /** What happened that you'd hear about: navies driving off intruders, and the like. */
  log: LogEntry[];
}

/** A line of news. `stop`: worth heaving to for, when you're under sail — a storm, a mutiny, a war. */
export interface LogEntry {
  turn: number;
  text: string;
  stop?: boolean;
}

/**
 * The Barbary and Sallee rovers who go raiding for captives: Algiers,
 * Tunis, Tripoli and Salé. They raid the open towns of whoever they're at
 * war with — as far as Baltimore and Iceland, as they did — and sail home
 * with captives. Take one laden and the captives go free.
 */
export const CORSAIR_PORTS = ['Algiers', 'Salé', 'Tunis', 'Tripoli'];
/** A town the corsairs have raided has nothing for anybody this long. */
export const CORSAIR_SACK_DAYS = 60;
/** Home with captives, a corsair lies in port this long before going out again. */
export const CORSAIR_REST = 20;

/**
 * Renown: how well your name is known, by what your prizes have paid all
 * told. Each step, hunters and privateers come a quarter farther for you,
 * and come better found.
 */
export const RENOWN = [60, 120, 200];
export const REACH_PER_RENOWN = 0.25;
/** Hull a hostile warship carries over the usual, per step of renown. */
export const HULL_PER_RENOWN = 2;
export const renown = (s: { fame: number }) => RENOWN.filter((f) => s.fame >= f).length;
/** Bound for London with the score, and no pirate. */
export const homeward = (s: WorldState) => !s.pirate && (s.commission === 'done' || (s.commission === 'legacy' && s.gold >= GOAL));

/** Days of each ship's wake that are remembered. */
export const TRAIL = 12;
export const START_GOLD = 20;
/** The score you need home in London to win. */
export const GOAL = 150;
export const HOME = 'London';
/** Every this many days, each nation's standing drifts a point back toward zero. */
export const STANDING_DECAY = 60;
/** Uncharted islands in a run, and what the Crown pays for charting one. */
export const ISLANDS = 8;
export const CHARTING_BOUNTY = 15;

/** What you can see from where you are: the water `sight` steps out, its current and this season's wind. */
export function observe(sea: Sea, chart: Chart, from: NodeId, sight: number, turn: number): Chart {
  const out = chart.slice();
  const bits = CURRENT_SEEN | windSeen(seasonOf(sea.pattern, turn));
  const depth = new Map<NodeId, number>([[from, 0]]);
  const queue = [from];
  for (let i = 0; i < queue.length; i++) {
    const n = queue[i];
    out[n] |= bits;
    if (depth.get(n)! >= sight) continue;
    for (const m of sea.map.adj[n]) if (!depth.has(m)) (depth.set(m, depth.get(n)! + 1), queue.push(m));
  }
  return out;
}

/** The player's knowledge of the sea, for predictions. */
export const knowledge = (s: WorldState): SeaKnowledge => chartKnowledge(s.chart);

/**
 * Where the powers keep guard ships that will come after you. Out where
 * control is weak — not in Europe, whose home waters their navies keep.
 */
export const HUNTER_STATIONS = ['Havana', 'Cartagena', 'San Juan', 'Callao', 'Panama', 'Goa', 'Malacca', 'Manila', 'Mozambique', 'Algiers'];

/**
 * Where enemy privateers fit out: Dunkirkers, Saint-Malo and La Rochelle
 * corsairs, Dutch Sea Beggars, Salé rovers, Algerines, Portuguese and
 * Spanish privateers out of Lisbon, Havana and Cartagena. They come for you whenever their nation is at war
 * with England.
 */
export const PRIVATEER_PORTS = ['Dunkirk', 'Saint-Malo', 'La Rochelle', 'Amsterdam', 'Salé', 'Algiers', 'Lisbon', 'Havana', 'Cartagena'];

/** A merchant out of every port, a guard ship at every station, and the great courses. */
export const DEFAULT_FLEET: FleetEntry[] = [
  ...PORTS.filter((p) => p.nation !== 'native').map((p): FleetEntry => ({ kind: 'merchant', home: p.name })),
  ...HUNTER_STATIONS.map((home): FleetEntry => ({ kind: 'hunter', home })),
  ...PRIVATEER_PORTS.map((home): FleetEntry => ({ kind: 'privateer', home })),
  ...CORSAIR_PORTS.map((home): FleetEntry => ({ kind: 'corsair', home })),
  { kind: 'treasure-fleet', route: 'flota' },
  { kind: 'treasure-fleet', route: 'galeones' },
  { kind: 'treasure-fleet', route: 'south sea fleet' },
  { kind: 'treasure-ship', route: 'manila galleon' },
  { kind: 'treasure-ship', route: 'carreira' },
  { kind: 'armada', route: 'barlovento' },
  { kind: 'armada', route: 'mar océano' },
  ...SEA_NAMES.map((sea): FleetEntry => ({ kind: 'monster', at: sea.at, sea: sea.name })),
];

let built: Sea | null = null;

/** The sea is the same every run — built once, then shared. */
export function createSea(): Sea {
  if (!built) {
    const map = buildMap();
    built = { map, pattern: buildPattern(map) };
  }
  return built;
}

/** Drake fitted out at Plymouth. */
export const START = 'Plymouth';

/**
 * Where this run's uncharted islands lie: open ocean, nobody's waters, far
 * from every port and from each other.
 */
function placeIslands(sea: Sea, r: Roller): NodeId[] {
  const { map } = sea;
  const harbours = ports(map);
  // Off the beaten track, but on a lane: you only find what you sail past.
  const candidates = map.nodes.filter((n) => n.kind === 'ocean' && n.waters === null && Math.abs(n.lat) < 55 && map.adj[n.id].length);
  const placed: NodeId[] = [];
  for (let tries = 0; placed.length < ISLANDS && tries < 500; tries++) {
    const n = candidates[Math.floor(roll(r) * candidates.length)].id;
    const farFromPorts = harbours.every((p) => map.distTo(p)[n] >= 8);
    const farFromOthers = placed.every((q) => map.distTo(q)[n] >= 15);
    if (farFromPorts && farFromOthers) placed.push(n);
  }
  return placed;
}

export function createWorld(sea: Sea, seed: number, fleet = DEFAULT_FLEET): WorldState {
  const player = portNamed(sea.map, START);
  const ships = spawnShips(sea, fleet);
  const r: Roller = { rng: (seed ^ 0x0ce4) >>> 0 };
  const islands = placeIslands(sea, r).map((node) => ({ node, found: false }));
  const wars = openingWars(r);
  const world: WorldState = {
    rng: r.rng,
    turn: 0,
    player,
    ships,
    rumors: [],
    nextRumor: 0,
    gold: START_GOLD,
    sight: 1,
    chart: observe(sea, new Uint8Array(sea.map.nodes.length), player, 1, 0),
    trail: ships.map(() => []),
    rounds: 0,
    hull: maxHullOf(START_OUTFIT),
    maxHull: maxHullOf(START_OUTFIT),
    encounter: null,
    reckoning: null,
    parted: {},
    sunk: false,
    standing: {},
    log: [],
    outfit: START_OUTFIT,
    islands,
    won: false,
    ending: null,
    hail: null,
    pirate: false,
    sacked: {},
    alarm: {},
    wars,
    tension: {},
    morale: MORALE_START,
    lastSpoils: 0,
    fame: 0,
    homewardNoised: false,
    spoil: null,
    dilemma: null,
    promised: false,
    guarded: {},
    letter: null,
    acts: 0,
    commission: 'active',
    tally: NO_TALLY,
    lastFight: null,
  };
  const r1: Roller = { rng: world.rng };
  const letter = issue(sea, world, 1, r1);
  return intelligence(sea, { ...world, rng: r1.rng, letter }, letter);
}

/** You sail to `to` (a neighbour, or where you are), then everyone else moves. */
export function advance(sea: Sea, s: WorldState, to: NodeId): WorldState {
  if (s.sunk) throw new Error('you went down; the run is over');
  if (s.won) throw new Error('you are home and the run is won');
  if (s.encounter) throw new Error('there is a fight to finish first');
  if (s.hail) throw new Error('a ship is alongside: attack, or let her pass');
  if (s.spoil) throw new Error("the prize's stores are waiting: take a card, or leave them");
  if (s.dilemma) throw new Error('there is a choice to make first');
  if (to !== s.player && !sea.map.adj[s.player].includes(to)) {
    throw new Error(`node ${to} is not next to ${s.player}`);
  }
  const r: Roller = { rng: s.rng };
  const ships = s.ships.map((ship) => ({ ...ship }));
  for (const ship of ships) moveShip(sea, r, ship, s.turn, to, pursuitOf(s, sea));

  // Countries protect their waters: a foreign guard ship found inside them
  // is driven off by the navy and laid up at home.
  const log = [...s.log];
  for (const ship of ships) {
    const owner = sea.map.nodes[ship.node].waters;
    if (ship.laidUp > s.turn || mayEnter(sea.map, ship, ship.node) || !owner) continue;
    log.push({ turn: s.turn + 1, text: `${navyOf(owner)} drove off a ${adjective(ship.nation)} guard ship` });
    Object.assign(ship, { node: ship.home, laidUp: s.turn + 1 + REFIT_DAYS, dest: null });
  }
  const turn = s.turn + 1;

  // Corsairs: a town raided, or captives brought home.
  let sacked = s.sacked;
  for (const ship of ships) {
    if (ship.kind !== 'corsair' || ship.laidUp > turn) continue;
    if (!ship.captives && ship.raid != null && ship.node === ship.raid) {
      const port = sea.map.nodes[ship.node].port!;
      sacked = { ...sacked, [ship.node]: turn + CORSAIR_SACK_DAYS };
      log.push({ turn, text: `${adjective(ship.nation)} corsairs raided ${port.name} and carried off captives`, ...(port.nation === YOUR_NATION ? { stop: true } : {}) });
      Object.assign(ship, { captives: port.nation, raid: null, dest: ship.home });
    } else if (ship.captives && ship.node === ship.home) {
      Object.assign(ship, { captives: null, laidUp: turn + CORSAIR_REST, dest: null });
    }
  }

  // Islands: sighted within sight, paid for once; an anchorage after.
  let gold = s.gold;
  let hull = s.hull;
  const near = sea.map.distTo(to);
  let found = false;
  const islands = s.islands.map((isle) => {
    if (isle.found || near[isle.node] > s.sight) return isle;
    gold += CHARTING_BOUNTY;
    log.push({ turn, text: `you sighted land nobody has charted, and the Crown will pay ${CHARTING_BOUNTY} for it` });
    found = true;
    return { ...isle, found: true };
  });
  if (atIsland({ ...s, islands }, to)) hull = Math.min(s.maxHull, hull + 1);

  // Grudges fade, and so does the strain your attacks have put on a peace.
  const fading = turn % STANDING_DECAY === 0;
  const standing = fading
    ? Object.fromEntries(Object.entries(s.standing).map(([n, v]) => [n, s.pirate && n === YOUR_NATION ? v! : v! - Math.sign(v!)]))
    : s.standing;
  const tension = fading ? Object.fromEntries(Object.entries(s.tension).map(([n, v]) => [n, Math.max(0, v! - 1)])) : s.tension;

  // A season of diplomacy.
  let wars = s.wars;
  if (turn % sea.pattern.seasonLength === 0) {
    const d = drift(s.wars, r);
    wars = d.wars;
    for (const text of d.news) log.push({ turn, text, stop: true });
  }

  let next: WorldState = {
    ...s,
    sacked,
    rng: r.rng,
    turn,
    player: to,
    ships,
    // Faded markers are dropped; what they said is no longer worth acting on.
    // Faded markers are dropped — but for the Admiralty's latest word of the plate ship, kept till fresher comes.
    rumors: s.rumors.filter((rumor) => markerStrength(rumor, turn) >= FADED || isLatestWord(s, rumor)),
    chart: observe(sea, s.chart, to, s.sight, turn),
    trail: s.ships.map((ship, i) => [ship.node, ...s.trail[i]].slice(0, TRAIL)),
    rounds: 0,
    log,
    islands,
    gold,
    hull,
    standing,
    tension,
    wars,
  };
  // Land nobody has charted, and maybe somebody on it.
  if (found) {
    const r2: Roller = { rng: next.rng };
    const d = castaway(next, r2);
    next = { ...next, rng: r2.rng, ...(d ? { dilemma: d } : {}) };
  }
  next = aDay(sea, next);
  // Homeward bound with the score, and word gets out.
  if (homeward(next) && !next.homewardNoised) {
    next = { ...next, homewardNoised: true, log: [...next.log, { turn, text: `word is out that you're homeward bound with ${next.gold}: every enemy privateer is putting to sea for you`, stop: true }] };
  }
  // Home with a score — and no noose waiting.
  next = letterDay(sea, next);
  if (sea.map.nodes[to].port?.name === HOME && homeward(next)) {
    return { ...next, won: true, ending: 'home', log: [...log, { turn, text: `home to London with ${gold}: the run is won` }] };
  }
  if (to !== s.player) next = landfall(sea, next);
  return meeting(sea, next);
}

/** The newest rumor of the plate ship your letter names: it stays on the chart till fresher word replaces it. */
export function isLatestWord(s: WorldState, rumor: Rumor): boolean {
  const t = s.letter?.task;
  if (t?.kind !== 'take' || rumor.shipId !== t.shipId) return false;
  return !s.rumors.some((r) => r.shipId === t.shipId && r.id > rumor.id);
}

/** What pursuers make of you: who wants you, who's alarmed, who's at war with England. */
export function pursuitOf(s: WorldState, sea: Sea): Pursuit {
  return {
    reach: 1 + REACH_PER_RENOWN * renown(s),
    homeward: homeward(s),
    prey: (n) =>
      ports(sea.map).filter((p) => {
        const port = sea.map.nodes[p].port!;
        return !port.fort && port.nation !== 'native' && atWar(s.wars, n, port.nation) && (s.sacked[p] ?? -1) < s.turn;
      }),
    standing: s.standing,
    alarmed: (n) => (s.alarm[n] ?? -1) > s.turn,
    enemy: (n) => isEnemy(s.wars, n),
  };
}

/** A charted island you're lying at: no ship troubles you there, and the hull mends a point a day. */
export const atIsland = (s: WorldState, node = s.player) => s.islands.some((i) => i.found && i.node === node);

/**
 * A rumor about a ship, true as of now. From interrogation after a fight, or
 * bought in port; the caller decides which ship and how reliable the source.
 */
export function hearRumor(sea: Sea, s: WorldState, shipId: number, reliability: number): WorldState {
  const ship = s.ships.find((x) => x.id === shipId);
  if (!ship) throw new Error(`no ship ${shipId}`);
  const r: Roller = { rng: s.rng };
  const rumor = makeRumor(sea, r, s.nextRumor, ship, s.turn, reliability);
  return { ...s, rng: r.rng, rumors: [...s.rumors, rumor], nextRumor: s.nextRumor + 1 };
}

/** Gold in, from a prize. */
export const earn = (s: WorldState, amount: number): WorldState => ({ ...s, gold: s.gold + amount });
