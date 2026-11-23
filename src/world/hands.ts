/**
 * The hands of note: Oregon Trail's named party, at sea. Six of the crew
 * have names — the master, the gunner, the carpenter, the surgeon, the
 * boatswain, and the ship's boy — and each does one small thing while he
 * lives. They are counted among the hands, not over them: when hands die, a
 * named one may be among them, and the log says who, and of what.
 *
 * And the graves they leave: a run's dead are written down when it ends
 * (graves.ts keeps them in the browser), and a later voyage passing the
 * place finds them. That is the only thing one voyage leaves another.
 *
 * Pure, like the rest of the world: the graves are handed in, and nothing
 * here touches storage.
 */

import type { RngState } from '../rng.ts';
import { HOME_LANDMARK, landmark } from './landmarks.ts';
import type { NodeId } from './map.ts';
import { type Roller, roll } from './random.ts';
import { type LogEntry, type Sea, type WorldState, newLines } from './world.ts';

export type Role = 'master' | 'gunner' | 'carpenter' | 'surgeon' | 'boatswain' | 'boy';
export const ROLES: Role[] = ['master', 'gunner', 'carpenter', 'surgeon', 'boatswain', 'boy'];

/** What each is called, and the one thing he does while he lives. */
export const ROLE: Record<Role, { title: string; does: string }> = {
  master: { title: 'the master', does: 'warns you before a leg the stores won’t see out, and finds a breath of wind in a calm' },
  gunner: { title: 'the gunner', does: 'makes a barrel of powder serve a shot more' },
  carpenter: { title: 'the carpenter', does: 'mends a point more careening' },
  surgeon: { title: 'the surgeon', does: 'often saves one of those the fever or the flux would take' },
  boatswain: { title: 'the boatswain', does: 'keeps the hands aboard: fewer desert, and a grievance comes to a head less often' },
  boy: { title: 'the ship’s boy', does: 'nothing, which is the point; he sings out when he sights a sail' },
};

export interface Death {
  turn: number;
  /** Where: the landmark, or the sea bound for one. */
  node: NodeId;
  place: string;
  /** Of what, as the log says it: `the flux`, `scurvy`, `a shot in the fight`. */
  cause: string;
}

export interface Named {
  role: Role;
  name: string;
  /** When and where and of what; or, if he left the ship alive, `ran`. */
  dead?: Death;
  ran?: boolean;
}

// Names a Devon or Cornish crew of 1580 might answer to.
const GIVEN = ['Thomas', 'John', 'William', 'Richard', 'Robert', 'Henry', 'Edward', 'Nicholas', 'Hugh', 'Roger', 'Gregory', 'Lawrence', 'Ambrose', 'Christopher', 'Peter', 'Simon', 'Giles', 'Walter', 'George', 'Humphrey', 'Arthur', 'Ralph'];
const BOYS = ['Will', 'Jack', 'Kit', 'Tom', 'Dick', 'Hal', 'Ned', 'Robin', 'Davy', 'Wat'];
const SURNAMES = [
  'Moone', 'Pike', 'Hawkes', 'Tucker', 'Pollard', 'Penrose', 'Ashe', 'Hext', 'Luxton', 'Huxham', 'Sparke', 'Cocke', 'Bryer', 'Cooke', 'Lane', 'Mallet',
  'Nance', 'Roskilly', 'Skinner', 'Worth', 'Fry', 'Carder', 'Tozer', 'Squance', 'Gribble', 'Pascoe', 'Trounce', 'Jago', 'Bolitho', 'Vosper', 'Cann', 'Northcott',
];

/** The hands of note for a new voyage, from its seed. */
export function muster(rng: RngState): Named[] {
  const r: Roller = { rng: (rng ^ 0x5a11) >>> 0 };
  const take = <T>(xs: T[], used: Set<T>): T => {
    for (let guard = 0; guard < 50; guard++) {
      const x = xs[Math.floor(roll(r) * xs.length)];
      if (!used.has(x)) return used.add(x), x;
    }
    return xs[0];
  };
  const given = new Set<string>();
  const sur = new Set<string>();
  return ROLES.map((role) => ({ role, name: `${take(role === 'boy' ? BOYS : GIVEN, given)} ${take(SURNAMES, sur)}` }));
}

/** Whether the hand of note in `role` is aboard and alive. */
export const alive = (s: { hands: Named[] }, role: Role) => s.hands.some((h) => h.role === role && !h.dead && !h.ran);
/** His name, with his place: `Thomas Moone, the gunner`. */
export const called = (h: Named) => `${h.name}, ${ROLE[h.role].title}`;
export const nameOf = (s: { hands: Named[] }, role: Role) => s.hands.find((h) => h.role === role)?.name ?? '';

/** Where the ship is, in words, for a death: at a landmark, or at sea bound for one. */
export function placeOf(sea: Sea, s: WorldState): string {
  if (sea.map.landmarks[s.voyage.at] === s.player) return landmark(s.voyage.at).name;
  const bound = s.voyage.bound;
  if (bound && bound !== HOME_LANDMARK) return `at sea, bound for ${landmark(bound).name}`;
  return `at sea, off ${landmark(s.voyage.at).name}`;
}

// --- Who died, and of what -----------------------------------------------------

/**
 * What carried hands off, read from what the log said of it; or that they
 * left alive (`left`), or that it was someone else's fate and none of the
 * hands of note could be among them (`none`: the gentleman beheaded).
 */
export function causeOf(entries: LogEntry[]): { cause: string; left: boolean; none?: boolean } {
  for (const e of entries) if (e.fold) return { cause: e.fold.kind, left: false };
  const lines = entries.map((e) => e.text);
  for (const line of lines) {
    if (/beheaded|put ashore with his chest/.test(line)) return { cause: 'the gentleman', left: /ashore/.test(line), none: true };
    if (/dead of it/.test(line)) {
      const what = line.match(/flux|fever|sickness|poison/)?.[0] ?? 'sickness';
      return { cause: what === 'flux' || what === 'sickness' ? `the ${what}` : what, left: false };
    }
    if (/sickened of it and died/.test(line)) return { cause: 'bad bread', left: false };
    const of = line.match(/dead of ((?:the )?[a-z]+)/);
    if (of && of[1] !== 'his') return { cause: of[1], left: false };
  }
  const text = lines.join(' · ');
  if (/killed|went down|sunk/.test(text)) return { cause: 'killed in the fight', left: false };
  if (/over the side in the night|lost over the side/.test(text)) return { cause: 'lost over the side', left: false };
  if (/poison/.test(text)) return { cause: 'poison', left: false };
  if (/slipped|slip away|stay|paid off|went with him|cut off|ashore with|gone in the night|deserted|maroon|left behind/.test(text)) return { cause: '', left: true };
  return { cause: 'the sea', left: false };
}

/** How much likelier than any other hand each role is to be among the dead, by what killed them. */
function exposure(role: Role, cause: string): number {
  if (role === 'gunner' && cause === 'killed in the fight') return 2;
  if (role === 'surgeon' && (cause === 'the flux' || cause === 'fever' || cause === 'the sickness')) return 2;
  if (role === 'boy' && cause === 'lost over the side') return 2;
  return 1;
}

/**
 * After a day, a choice or a fight: if hands were lost, were any of note
 * among them? Each named hand goes with a chance of his share of the dead
 * (more for the one most exposed to it), never more of them than died, and
 * the log says who and of what. Hands who left alive leave the same way, and
 * a ship gone down takes everyone with her. Also keeps the run's count of
 * the dead, by cause.
 */
export function mourn(sea: Sea, before: WorldState, after: WorldState): WorldState {
  const lost = before.crew - after.crew;
  if (lost <= 0 && !(after.sunk && !before.sunk)) return after;
  const { cause, left, none } = causeOf(newLines(before, after));
  const r: Roller = { rng: after.rng };
  const place = placeOf(sea, after);
  const drowned = after.sunk && after.reckoning?.outcome === 'sunk';
  let gone = 0;
  const said: LogEntry[] = [];
  const hands = after.hands.map((h) => {
    if (h.dead || h.ran) return h;
    if (drowned) return { ...h, dead: { turn: after.turn, node: after.player, place, cause: 'went down with the ship' } };
    if (gone >= lost || none) return h;
    const chance = Math.min(1, (lost / Math.max(1, before.crew)) * exposure(h.role, cause));
    if (roll(r) >= chance) return h;
    gone++;
    if (left) {
      said.push({ turn: after.turn, text: `${called(h)}, gone with them` });
      return { ...h, ran: true };
    }
    said.push({ turn: after.turn, text: `${called(h)}, dead of ${cause === 'killed in the fight' ? 'his wounds' : cause}`, stop: true });
    return { ...h, dead: { turn: after.turn, node: after.player, place, cause } };
  });
  const as = left ? 'ran' : cause;
  const losses = lost > 0 ? { ...after.losses, [as]: (after.losses[as] ?? 0) + lost } : after.losses;
  return { ...after, rng: r.rng, hands, losses, log: [...after.log, ...said] };
}

// --- Graves ----------------------------------------------------------------------

export interface Grave {
  /** The run and the hand: a run's graves are written once. */
  id: string;
  node: NodeId;
  place: string;
  name: string;
  /** `the gunner`, or for a ship lost, `lost with her hands`. */
  title: string;
  date: string;
  cause: string;
  epitaph: string;
}

/** Epitaphs a Protestant crew of the 1580s might cut on a board, or say over the side. */
export const EPITAPHS = [
  'Blessed are the dead which die in the Lord.',
  'As I am, so shall ye be.',
  'Into thy hands, O Lord.',
  'He served his turn.',
  'Memento mori.',
  'The sea hath him.',
  'Here he lies, far from Devon.',
  'Man that is born of woman hath but a short time.',
];

/** The run's dead, as graves: the hands of note who died, and the ship if she was lost (`place`: where, in words). */
export function gravesOf(s: WorldState, seed: number, date: (turn: number) => string, shipName: string, place: string): Grave[] {
  const graves: Grave[] = s.hands
    .filter((h) => h.dead && h.dead.cause !== 'went down with the ship')
    .map((h, i) => ({ id: `${seed}:${h.role}:${h.dead!.turn}`, node: h.dead!.node, place: h.dead!.place, name: h.name, title: ROLE[h.role].title, date: date(h.dead!.turn), cause: h.dead!.cause, epitaph: EPITAPHS[(seed + i * 3) % EPITAPHS.length] }));
  if (s.sunk) graves.push({ id: `${seed}:ship:${s.turn}`, node: s.player, place, name: `a ${shipName}`, title: 'lost with her hands', date: date(s.turn), cause: s.reckoning?.outcome === 'sunk' ? 'a fight' : 'too few hands to work her', epitaph: EPITAPHS[seed % EPITAPHS.length] });
  return graves;
}

/** At sea, or ashore at a landmark: where a grave lies decides what's found there. */
const atSea = (place: string) => place.startsWith('at sea');

/** How near a grave the ship must pass to find it: the lanes are narrow, and a voyage keeps to them. */
export const GRAVE_NEAR = 1;

/**
 * Graves from voyages before, found as you pass them: a line in the log,
 * once each a run. Ashore at a landmark it's a board on the beach; at sea,
 * it's the place a man was given to the deep.
 */
export function visitGraves(sea: Sea, s: WorldState, graves: Grave[]): WorldState {
  if (!graves.length) return s;
  const d = sea.map.distTo(s.player);
  const found = graves.filter((g) => !s.seen.includes(`grave:${g.id}`) && d[g.node] <= GRAVE_NEAR);
  if (!found.length) return s;
  const lines: LogEntry[] = found.map((g) => {
    const where = g.title === 'lost with her hands' ? `where ${g.name} was lost, ${g.place}` : atSea(g.place) ? 'the sea where a man was buried' : `a grave on the shore at ${g.place}`;
    return { turn: s.turn, text: `${where}: ${g.name}, ${g.title}, ${g.date}, of ${g.cause}. “${g.epitaph}”` };
  });
  return { ...s, seen: [...s.seen, ...found.map((g) => `grave:${g.id}`)], log: [...s.log, ...lines] };
}
