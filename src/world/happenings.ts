/**
 * What happens on the way, Oregon Trail's way: a table of happenings, each
 * with where it can happen and how often. Most are small and pass with a
 * line in the log — seals off Patagonia, fog, rats in the bread room, a fire
 * in the galley. Some happen once a voyage, at a place: crossing the line,
 * the Southern Cross. Some ask you something, and become a dilemma (see
 * dilemmas.ts): a leak, a wreck, islanders' canoes, a reef in the Indies.
 * And some come when you raise a landmark: the Doughty business at San
 * Julián, hands who'd rather stay in the islands.
 *
 * Called by `aDay` at sea, after the weather, and by `raise` on arriving.
 */

import { type Roller, pick, roll } from './random.ts';
import { capacity, topUp } from './stores.ts';
import type { Sea, WorldState } from './world.ts';
import { alive, nameOf } from './hands.ts';

type Where = (sea: Sea, s: WorldState) => boolean;
const at = (sea: Sea, s: WorldState) => sea.map.nodes[s.player];
const tropic: Where = (sea, s) => Math.abs(at(sea, s).lat) < 23.5;
const anywhere: Where = () => true;
/** Off Patagonia: the coast from the Plate to the Strait. */
const patagonia: Where = (sea, s) => at(sea, s).lat < -38 && at(sea, s).lon > -75 && at(sea, s).lon < -55;
const iceSeas: Where = (sea, s) => at(sea, s).lat < -50;
const highLatitudes: Where = (sea, s) => Math.abs(at(sea, s).lat) > 42;
/** The horse latitudes of the Atlantic, where the wind dies between the westerlies and the trades. */
const horseLatitudes: Where = (sea, s) => Math.abs(at(sea, s).lat) > 25 && Math.abs(at(sea, s).lat) < 35 && at(sea, s).lon > -60 && at(sea, s).lon < -10;
/** The open Pacific, among its islands. */
const pacificIslands: Where = (sea, s) => {
  const { lat, lon } = at(sea, s);
  return lat > -25 && lat < 20 && (lon > 130 || lon < -140);
};
/** The reefs of the Indies, between the Moluccas and Java. */
const indies: Where = (sea, s) => {
  const { lat, lon } = at(sea, s);
  return lat > -10 && lat < 6 && lon > 110 && lon < 135;
};
/** The coast of Chile and Peru, Spain's soft underbelly. */
const pacificCoast: Where = (sea, s) => {
  const { lat, lon } = at(sea, s);
  return lon > -86 && lon < -68 && lat > -45 && lat < 5;
};
/** Spanish waters, where patrols ask for papers: off Spain, and the coast of Chile and Peru. */
const spanishWaters: Where = (sea, s) => {
  const { lat, lon } = at(sea, s);
  return (lon > -20 && lon < 10 && lat > 25 && lat < 46) || pacificCoast(sea, s);
};
/** Days without a prize before the hands start to think of Spanish gold on their own account. */
export const PRIZELESS_DAYS = 90;

/** Bound through the Strait: no wrecks drifting there, nothing but rock. */
const openSea: Where = (sea, s) => !(Math.abs(at(sea, s).lat) > 50 && at(sea, s).lon > -76 && at(sea, s).lon < -66);

export interface Happening {
  key: string;
  where: Where;
  /** On a day at sea, there: this often. */
  chance: number;
  /** Once a voyage. */
  once?: boolean;
  /** What it does, and what the log says; or an event that asks. */
  happen: (s: WorldState, r: Roller, cap: ReturnType<typeof capacity>) => WorldState;
}

const said = (s: WorldState, text: string, stop = false): WorldState => ({ ...s, log: [...s.log, { turn: s.turn, text, ...(stop ? { stop } : {}) }] });
const lose = (s: WorldState, days: number): WorldState => ({ ...s, calm: Math.max(s.calm, s.turn + days) });
const ask = (s: WorldState, kind: NonNullable<WorldState['dilemma']>['kind'], text: string): WorldState => (s.dilemma ? s : said({ ...s, dilemma: { kind } as WorldState['dilemma'] }, text, true));

/** The sea, and nothing else: lines that cost nothing, so the days aren't all alike. */
const THE_SEA: Record<string, string[]> = {
  tropic: [
    'a waterspout to leeward, and gone',
    'dolphins under the bow all the forenoon watch',
    'the pitch soft in the seams, and the decks wetted twice a day',
    'flying fish skittering off the bow wave',
  ],
  cold: [
    'a whale blowing close aboard, and the hands at the rail',
    "Saint Elmo's fire at the mastheads in the middle watch",
    'albatrosses following, that nobody will shoot',
    'a long grey swell out of the west, and the ship labouring',
  ],
  any: [
    'a fair wind, and the log heaved at seven knots',
    'the hands at their sail-mending on the waist',
    'a day like the last, and the one before',
    'the bosun flogging a man for sleeping on watch',
  ],
};

export const HAPPENINGS: Happening[] = [
  // --- Once, at a place ------------------------------------------------------
  {
    key: 'the-line', once: true, chance: 1,
    // The first day south of the equator: everybody sets out from the north.
    where: (sea, s) => at(sea, s).lat < 0,
    happen: (s) => said(s, 'crossing the line: the old hands duck the new ones over the side, and there is wine for all', true),
  },
  {
    key: 'southern-cross', once: true, chance: 1,
    where: (sea, s) => at(sea, s).lat < -15,
    happen: (s) => said(s, 'the Southern Cross over the bow for the first time, and the north star gone under'),
  },

  // --- Small things ------------------------------------------------------------
  {
    key: 'seals', chance: 1 / 6, where: patagonia,
    happen: (s, r, cap) => {
      const days = 10 + Math.floor(roll(r) * 15);
      return said({ ...s, fresh: 0, stores: { ...s.stores, food: topUp(s.stores.food, s.crew * days, cap.food) } }, `seals and penguins on an islet, clubbed by the hundred: ${days} days of fresh meat`);
    },
  },
  {
    key: 'ice', chance: 1 / 6, where: iceSeas,
    happen: (s) => said(lose(s, 1), 'ice in the rigging, and the hands beating it off with belaying pins: a day lost'),
  },
  {
    key: 'fog', chance: 1 / 25, where: highLatitudes,
    // The master, while he lives, feels his way through it, sounding, one time in two.
    happen: (s, r) =>
      alive(s, 'master') && roll(r) < 0.5
        ? said(s, `fog, thick as wool, and ${nameOf(s, 'master')} feels his way through it, sounding`)
        : said(lose(s, 1), 'fog, thick as wool: hove to, sounding, and a day lost'),
  },
  {
    key: 'horse-latitudes', chance: 1 / 30, where: horseLatitudes,
    happen: (s, r) => {
      const days = Math.max(1, 1 + Math.floor(roll(r) * 3) - (alive(s, 'master') ? 1 : 0));
      return said(lose(s, days), `becalmed in the horse latitudes, ${days} ${days === 1 ? 'day' : 'days'} with the sails slatting`);
    },
  },
  {
    key: 'galley-fire', chance: 1 / 250, where: anywhere,
    happen: (s) =>
      s.stores.spares > 0
        ? said({ ...s, stores: { ...s.stores, spares: s.stores.spares - 1 } }, 'fire in the galley, put out with wet canvas: a bundle of the spares burned', true)
        : said({ ...s, hull: Math.max(1, s.hull - 1) }, 'fire in the galley, put out at last: the deck charred, a point of hull', true),
  },
  {
    key: 'rats', chance: 1 / 150, where: anywhere,
    happen: (s) => said({ ...s, stores: { ...s.stores, food: Math.round(s.stores.food * 0.9) } }, 'rats in the bread room: a tenth of the biscuit spoiled'),
  },
  {
    key: 'lightning', chance: 1 / 300, where: (sea, s) => tropic(sea, s) || highLatitudes(sea, s),
    happen: (s) => said({ ...s, hull: Math.max(1, s.hull - 1) }, 'lightning down the mainmast, and the topmast sprung: a point of hull', true),
  },
  {
    key: 'flotsam', chance: 1 / 200, where: openSea,
    happen: (s, _r, cap) => said({ ...s, stores: { ...s.stores, water: topUp(s.stores.water, s.crew * 5, cap.water) } }, 'casks adrift from some wreck, and two of them sweet water'),
  },
  {
    key: 'shipworm', chance: 1 / 150, where: tropic,
    happen: (s) => said({ ...s, hull: Math.max(1, s.hull - 1) }, 'the worm in her planking: the carpenter finds it soft as cheese below the waterline, a point of hull'),
  },
  {
    key: 'the-sea', chance: 1 / 12, where: anywhere,
    happen: (s) => s, // said in `happeningsDay`, which knows the region
  },

  // --- Things that ask -----------------------------------------------------------
  { key: 'leak', chance: 1 / 160, where: anywhere, happen: (s) => ask(s, 'leak', 'a leak below the waterline, and the pumps going') },
  { key: 'wreck', chance: 1 / 220, where: openSea, happen: (s) => ask(s, 'wreck', 'a wreck drifting, dismasted, nobody on her deck') },
  { key: 'canoes', chance: 1 / 30, where: pacificIslands, happen: (s) => ask(s, 'canoes', 'canoes putting out from an island, a hundred of them') },
  { key: 'reef', chance: 1 / 30, where: indies, happen: (s) => ask(s, 'reef', 'aground on a reef, with the tide falling') },
  {
    key: 'gold-mutiny', chance: 1 / 40, once: true,
    where: (sea, s) => pacificCoast(sea, s) && s.turn - s.lastPrize > PRIZELESS_DAYS,
    happen: (s) => ask(s, 'gold-mutiny', 'a party of the hands armed, and talking of Spanish gold'),
  },
  { key: 'stores-fire', chance: 1 / 300, where: anywhere, happen: (s) => ask(s, 'stores-fire', 'fire in the bread room') },
  { key: 'patrol-papers', chance: 1 / 200, where: spanishWaters, happen: (s) => (s.dilemma ? s : said({ ...s, dilemma: { kind: 'papers', at: null } }, 'a Spanish patrol, and she wants your papers', true)) },
];

/** A day at sea's happenings, after the weather. At most one asks. */
export function happeningsDay(sea: Sea, s: WorldState, r: Roller): WorldState {
  let w = s;
  const cap = capacity(w);
  for (const h of HAPPENINGS) {
    if (h.once && w.seen.includes(h.key)) continue;
    if (!h.where(sea, w) || roll(r) >= h.chance) continue;
    if (h.key === 'the-sea') {
      const lines = tropic(sea, w) ? THE_SEA.tropic : highLatitudes(sea, w) ? THE_SEA.cold : THE_SEA.any;
      w = said(w, pick(r, lines));
      continue;
    }
    w = h.happen(w, r, cap);
    if (h.once) w = { ...w, seen: [...w.seen, h.key] };
  }
  return w;
}

// --- On raising a landmark -------------------------------------------------------

/** Islands where hands are tempted to stay: the girls, the fruit, the idleness. */
export const TEMPTING = ['ladrones', 'ternate', 'java'];
export const TEMPTED_CHANCE = 0.35;
/** Rulers who might ask you ashore to feast: the Sultan of Ternate, the King of Bantam, the islanders' chief. */
export const FEASTING = ['ternate', 'java', 'solomons'];
export const FEAST_CHANCE = 0.5;
/** Ports with a lock-up and a governor to keep it, abroad. */
export const JAILING = ['ternate', 'java'];
export const JAILED_CHANCE = 0.2;
/** Iberian islands where they search a stranger's papers. */
export const SEARCHING = ['canaries', 'cape-verde'];
export const SEARCHED_CHANCE = 0.25;
/** Remote shores with shining rock on them; and the islands a storm drives you onto (landfalls.ts). Once a voyage. */
export const ORE_SHORES = ['nova-albion', 'solomons', 'strait'];
export const ORE_CHANCE = 0.3;

/** Left be, the gentleman's grumbling costs this many hands at the next landmark, this often. */
export const DISCONTENT_CHANCE = 0.5;
export const DISCONTENT_LOST = [2, 5] as const;

/** What happens on raising a landmark: the Doughty business at San Julián, the islands' temptations, a grievance come to a head. */
export function arriving(s: WorldState, key: string): WorldState {
  const r: Roller = { rng: s.rng };
  let w = s;
  if (w.seen.includes('discontent')) {
    w = { ...w, seen: w.seen.filter((x) => x !== 'discontent') };
    // A gentleman who put money in has friends aboard who did too: it always comes to a head.
    // The gentlemen's friends always bring it to a head; the boatswain, while he lives, keeps it down half the time.
    if (roll(r) < (w.backer === 'gentlemen' ? 1 : DISCONTENT_CHANCE) * (alive(w, 'boatswain') ? 0.5 : 1)) {
      const lost = Math.min(w.crew, DISCONTENT_LOST[0] + Math.floor(roll(r) * (DISCONTENT_LOST[1] - DISCONTENT_LOST[0] + 1)));
      w = said({ ...w, crew: w.crew - lost }, `the gentleman's friends slipped away in the night: ${lost} hands gone`, true);
    } else w = said(w, 'the grumbling has died down, for now');
  }
  if (key === 'san-julian' && !w.seen.includes('gentleman')) {
    w = ask({ ...w, seen: [...w.seen, 'gentleman'] }, 'gentleman', 'a gentleman adventurer stirring the hands against you, as Doughty did');
  } else if (TEMPTING.includes(key) && roll(r) < TEMPTED_CHANCE) {
    w = ask(w, 'deserters', 'some of the hands want to stay in the islands');
  }
  // One asking thing at a time: whichever comes first of the rest.
  const put = (dilemma: NonNullable<WorldState['dilemma']>, text: string) => (w = w.dilemma ? w : said({ ...w, dilemma }, text, true));
  if (FEASTING.includes(key) && roll(r) < FEAST_CHANCE) put({ kind: 'feast', at: key }, 'an invitation to feast ashore');
  if (JAILING.includes(key) && roll(r) < JAILED_CHANCE) put({ kind: 'jailed', at: key }, 'some of the hands in the lock-up after a brawl ashore');
  if (SEARCHING.includes(key) && roll(r) < SEARCHED_CHANCE) put({ kind: 'papers', at: key }, 'officers come aboard to search your papers');
  if (ORE_SHORES.includes(key) && !w.seen.includes('ore-found') && roll(r) < ORE_CHANCE) {
    put({ kind: 'ore' }, 'shining ore on the beach');
    w = { ...w, seen: [...w.seen, 'ore-found'] };
  }
  return { ...w, rng: r.rng };
}
