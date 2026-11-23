/**
 * Captives: men left ashore who talk, a crew taken, and Englishmen freed.
 *
 * Men who leave the ship alive — deserters, the marooned, hands left in a
 * lock-up or cut off in a raid — may be taken by the Spanish, and they talk.
 * Laudonnière's deserters from Fort Caroline in 1565 told Menéndez where
 * the fort lay and how it was held; the lone survivor of Charlesfort was
 * questioned for everything he knew. Before the treasure ship, word of you
 * goes up the coast ahead and warns her (the same warning a raid gives:
 * `coast-alarm`); after, it's one more thing for Spain's ambassador.
 *
 * A ship lost on a coast Spain holds, her crew too few to work her: the men
 * are taken. Menéndez hanged his Huguenots at Matanzas in 1565 "not as
 * Frenchmen but as heretics", sparing Catholics and the skilled — carpenters,
 * gunners — for the galleys. Oxenham's men were tried at Lima in 1580.
 *
 * And the other way: a Spanish prize or a sacked town sometimes has an
 * Englishman at her oars or in its jail — one of Oxenham's company, taken
 * in 1577 — who joins you, takes a dead man's place, and knows the coast.
 */

import { landmark } from './landmarks.ts';
import { type Named, ROLE, type Role, called } from './hands.ts';
import { watersAt } from './meet.ts';
import { type Roller, pick, roll } from './random.ts';
import { complement } from './stores.ts';
import type { Sea, WorldState } from './world.ts';

/** Landmarks on coasts Spain or Portugal holds: men left there are taken. */
export const IBERIAN = ['canaries', 'cape-verde', 'brazil', 'guanabara', 'valparaiso', 'callao', 'cacafuego', 'guatulco', 'manila', 'macau', 'goa', 'brazil-home', 'azores'];
/** Men left alive on such a coast are taken and talk this often; elsewhere, now and then a Spanish ship picks them up. */
export const TALK_HELD = 0.6;
export const TALK_ELSEWHERE = 0.15;
/** What their talk adds to Spain's grievance, once the treasure ship is past. */
export const TALK_GRIEVANCE = 25;

/** The landmark you're lying at, if you are. */
const at = (sea: Sea, s: WorldState) => (sea.map.landmarks[s.voyage.at] === s.player ? s.voyage.at : null);

/** Hands just left alive ashore: taken, sometimes, and they talk. Called by `mourn` when hands leave the ship. */
export function talk(sea: Sea, s: WorldState, r: Roller): WorldState {
  const here = at(sea, s);
  const chance = here && IBERIAN.includes(here) ? TALK_HELD : here ? TALK_ELSEWHERE : 0;
  if (roll(r) >= chance) return s;
  const where = here ? landmark(here).name : 'the coast';
  const say = (w: WorldState, text: string): WorldState => ({ ...w, log: [...w.log, { turn: w.turn, text }] });
  if (!s.voyage.visited.includes('cacafuego')) {
    if (s.seen.includes('coast-alarm')) return say(s, `the men left at ${where} are taken by the Spanish, and tell what they know`);
    return say({ ...s, seen: [...s.seen, 'coast-alarm'] }, `the men left at ${where} are taken by the Spanish, and they talk: word of you goes up the coast ahead, and the treasure ship will hear of it`);
  }
  return say({ ...s, grievance: s.grievance + TALK_GRIEVANCE }, `the men left at ${where} are taken by the Spanish, and they talk: Spain's ambassador will have their story`);
}

/** Whether the ship is on a coast Spain or Portugal holds: at one of their landmarks, or in waters their ships sail. */
export function spanishCoast(sea: Sea, s: WorldState): boolean {
  const here = at(sea, s);
  if (here) return IBERIAN.includes(here);
  return !!watersAt(sea, s)?.sails.some((x) => !x.neutral && (x.nation === 'spain' || x.nation === 'portugal'));
}

/** Where the taken are tried: Lima for the South Sea, Goa for the East, Seville for the rest. */
export function tribunal(sea: Sea, s: WorldState): string {
  const { lon } = sea.map.nodes[s.player];
  if (lon < -68 && lon > -130) return 'Lima';
  if (lon > 60) return 'Goa';
  return 'Seville';
}

/** The skilled are spared for the galleys: the gunner, the carpenter. The rest hang. */
export const GALLEYS: Role[] = ['gunner', 'carpenter'];

/**
 * The ship lost on a Spanish coast with too few hands to work her: the
 * hands of note who were still aboard are taken. The skilled go to the
 * galleys; the rest hang as heretics. The log says who.
 */
export function taken(sea: Sea, s: WorldState): WorldState {
  if (!spanishCoast(sea, s)) return s;
  const court = tribunal(sea, s);
  const lines: string[] = [];
  const hands: Named[] = s.hands.map((h) => {
    if (h.dead || h.ran) return h;
    if (GALLEYS.includes(h.role)) {
      lines.push(`${called(h)}, sent to the galleys for life`);
      return { ...h, fate: 'galleys' as const };
    }
    lines.push(`${called(h)}, hanged at ${court} as a heretic`);
    return { ...h, dead: { turn: s.turn, node: s.player, place: court, cause: 'the hangman' } };
  });
  const said = [`the ship lost on a Spanish coast, and her men taken: tried at ${court}, the most of them hanged as heretics, the Catholics and the skilled kept for the galleys`, ...lines];
  return { ...s, hands, log: [...s.log, ...said.map((text, i) => ({ turn: s.turn, text, ...(i === 0 ? { stop: true } : {}) }))] };
}

// --- Englishmen freed -------------------------------------------------------------

/** A Spanish or Portuguese prize taken: an Englishman at her oars this often; at Callao, in the Lima prison, oftener. */
export const FREED_CHANCE = 0.12;
export const FREED_AT_CALLAO = 0.5;

const FREED_GIVEN = ['John', 'Thomas', 'William', 'Richard', 'Robert', 'Henry', 'Nicholas', 'Edward'];
const FREED_SURNAMES = ['Butler', 'Ellis', 'Horsewell', 'Sherwell', 'Chester', 'Rogers', 'Lovell', 'Barker', 'Penny', 'Fowler'];

/**
 * After a Spanish or Portuguese prize taken, or a town sacked: an
 * Englishman freed, sometimes, who joins as a hand. If one of the hands of
 * note is gone, he takes that place. Returns whether one was freed, for a
 * rumor of the coast he knows.
 */
export function freed(s: WorldState, raid: string | null, r: Roller): { world: WorldState; freed: boolean } {
  const chance = raid === 'callao' ? FREED_AT_CALLAO : FREED_CHANCE;
  if (roll(r) >= chance) return { world: s, freed: false };
  const name = `${pick(r, FREED_GIVEN)} ${pick(r, FREED_SURNAMES)}`;
  const how = raid === 'callao' ? 'in the prison at Lima’s port, one of Oxenham’s company taken in 1577' : raid ? `in the jail at ${landmark(raid).name}` : 'chained at her oars, an Englishman taken years since';
  const gone = s.hands.find((h) => (h.dead || h.ran || h.fate) && h.role !== 'chronicler' && !s.hands.some((o) => o.role === h.role && !o.dead && !o.ran && !o.fate));
  const crew = Math.min(complement(s), s.crew + 1);
  let w: WorldState = { ...s, crew };
  if (gone) {
    w = { ...w, hands: [...w.hands, { role: gone.role, name, freed: true }] };
    w = { ...w, log: [...w.log, { turn: w.turn, text: `${name}, ${how}, freed: he joins you, and takes the place of ${called(gone)}, as ${ROLE[gone.role].title}`, stop: true }] };
  } else {
    w = { ...w, log: [...w.log, { turn: w.turn, text: `${name}, ${how}, freed: he joins you, and knows the coast`, stop: true }] };
  }
  return { world: w, freed: true };
}
