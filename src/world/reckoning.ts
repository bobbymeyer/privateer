/**
 * Whose money you sail on, how lawful the voyage is, and the reckoning when
 * you come home. The voyage doesn't end on the quay at Plymouth.
 *
 * **Backers.** Most voyages were paid for privately, "putting nearly all of
 * the risk on the shoulders of the explorers"; the Crown put in ships and
 * money when it suited it, as Elizabeth did in Drake's. You choose at the
 * start:
 *
 * | backer | at the start | at home |
 * | the Crown | more money, and spares and powder | the Queen's third; her favour shields you at court, but she wants a clean commission |
 * | gentlemen adventurers | the most money | half of what comes home over your own purse, nothing if less; their friends aboard make trouble |
 * | your own stake | nothing more | you keep it all |
 *
 * **Privateer or pirate.** Spain's and Portugal's ships and towns are fair
 * game: one crown since 1580, and at war with England in all but name. A
 * French, Hanseatic or Dutch merchant isn't. She's richer than her guns
 * suggest, and taking her is piracy: `infamy`, twice over under a Crown
 * commission. What you take from Spain is lawful, but it mounts up as
 * Spain's `grievance`, and the ambassador will want it back.
 *
 * **The reckoning.** Coming into Plymouth: the spice sold, the backers' shares
 * paid, and then Spain's ambassador — Mendoza, who demanded Drake's head in
 * 1580 — wants restitution, and with infamy the Admiralty asks questions.
 * Show yourself at court for the fame of it, at a risk of being disowned
 * and made to give the silver back; lie low; or give the Queen a gift from
 * the treasure, and go to court under her favour. A great name for piracy
 * and no favour, and the prize is seized and you're named a pirate.
 */

import { SHIP_CLASSES } from '../outfit.ts';
import type { WorldState } from './world.ts';
import { favourOf, proofOfService, sellJewels, toHerTaste } from './jewels.ts';

export type Backer = 'crown' | 'gentlemen' | 'own';

export interface BackerDef {
  name: string;
  /** What it puts in, by ship: more gold to fit out with, and stores on top. */
  gold: (ship: string) => number;
  spares: number;
  powder: number;
  /** What it means, in a line. */
  text: string;
}

export const BACKERS: Record<Backer, BackerDef> = {
  crown: {
    name: 'the Crown',
    gold: (ship) => Math.round(SHIP_CLASSES[ship].purse * 0.4) + 10,
    spares: 2,
    powder: 2,
    text: 'the Queen puts money in, and stores from the dockyard at Deptford. she takes a third of what you bring home, and wants a clean commission; her favour shields you at court',
  },
  gentlemen: {
    name: 'gentlemen adventurers',
    gold: (ship) => Math.round(SHIP_CLASSES[ship].purse * 0.6) + 25,
    spares: 0,
    powder: 0,
    text: 'gentlemen of the court put money in, hoping for three to one. at home they take half of what you bring over your own purse, and nothing if you come home poorer; and some of them sail with you',
  },
  own: {
    name: 'your own stake',
    gold: () => 0,
    spares: 0,
    powder: 0,
    text: 'what you could raise yourself: nothing more to fit out with, and nobody to share with at home',
  },
};
export const BACKER_KEYS = Object.keys(BACKERS) as Backer[];

/** The Queen's share of what comes home, under a Crown commission. */
export const CROWN_SHARE = 1 / 3;
/** The gentlemen's share of what comes home over your own purse: their stake is in it, and their risk. */
export const GENTLEMEN_SHARE = 1 / 2;

// --- Privateer or pirate ---------------------------------------------------------

/** Infamy for firing on a friend's merchant; twice that under a Crown commission. */
export const NEUTRAL_INFAMY = 1;
export const infamyFor = (s: WorldState) => NEUTRAL_INFAMY * (s.backer === 'crown' ? 2 : 1);
/** A name for piracy: this much infamy. */
export const PIRATE_INFAMY = 4;

/** How the voyage looks to the Admiralty, in a word. */
export const lawfulness = (s: WorldState) => (s.infamy <= 0 ? 'lawful' : s.infamy < PIRATE_INFAMY ? 'questions asked' : 'a name for piracy');
/** Spain's grievance, in a word: what the ambassador will want back. */
export const grievanceWord = (s: WorldState) => (s.grievance <= 0 ? 'none' : s.grievance < 150 ? 'small' : s.grievance < 400 ? 'considerable' : 'great');

// --- The reckoning -----------------------------------------------------------------

/** What the backers take at home, from the gold you bring in. */
export function sharesDue(s: WorldState): { queen: number; gentlemen: number } {
  if (s.backer === 'crown') return { queen: Math.round(s.gold * CROWN_SHARE), gentlemen: 0 };
  // Adventurers share the risk: half of what comes home over your own purse, and nothing if you come home poorer.
  if (s.backer === 'gentlemen') return { queen: 0, gentlemen: Math.round(Math.max(0, s.gold - SHIP_CLASSES[s.ship].purse) * GENTLEMEN_SHARE) };
  return { queen: 0, gentlemen: 0 };
}

/**
 * The chance at court of being disowned: Spain's grievance and your infamy
 * against it, the Queen's favour for you. Jewels set aside for her lessen
 * it; the dead commander's ring, proof of service, ends it.
 */
export function courtRisk(s: WorldState): number {
  if (proofOfService(s)) return 0;
  const raw = Math.min(0.9, s.grievance / 1200 + s.infamy * 0.12);
  const jewels = Math.max(0, 1 - favourOf(s) / JEWEL_FAVOUR);
  return Math.round(100 * raw * (s.backer === 'crown' ? 0.4 : 1) * jewels) / 100;
}
/** Jewels set aside worth this much to her, and court holds no risk at all. */
export const JEWEL_FAVOUR = 120;
/** Her pleasure in a jewel: fame for half of what it's worth to her. */
export const pleasure = (s: WorldState) => Math.round(favourOf(s) / 2);
/** What the gift costs in gold, once the jewels set aside for her are counted. */
export const giftGold = (s: WorldState) => Math.max(0, giftFor(s) - favourOf(s));
/** Great infamy and no favour: the prize seized and you named a pirate. */
export const outlawed = (s: WorldState) => s.infamy >= PIRATE_INFAMY && s.backer !== 'crown';
/** Lying low with a name for piracy: this often they come for you anyway. */
export const LOW_PIRATE = 0.5;
/** What's seized of a pirate's gold. */
export const SEIZED = 0.75;
/** What the Queen's gift costs: a share of the treasure, and no less than this. */
export const GIFT_SHARE = 0.2;
export const GIFT_MIN = 10;
/** A gift wipes this much infamy before you go to court. */
export const GIFT_PARDON = 2;
/** Disowned: this share of Spain's grievance goes back, no more than half the gold. */
export const RESTITUTION = 0.5;

/** The fame of showing yourself at court: a share of what you bring home, within bounds. */
export const fameFor = (gold: number) => Math.max(20, Math.min(150, Math.round(gold * 0.3)));
export const giftFor = (s: WorldState) => Math.min(s.gold, Math.max(GIFT_MIN, Math.round(s.gold * GIFT_SHARE)));
export const restitutionFor = (s: WorldState) => Math.min(Math.round(s.gold / 2), Math.round(s.grievance * RESTITUTION));

/** How it came out at home. */
export type Verdict = 'court' | 'low' | 'gift' | 'disowned' | 'pirate';

/** What was paid away at home, line by line, for the end screen. */
export interface Settled {
  queen: number;
  gentlemen: number;
  gift: number;
  restitution: number;
  seized: number;
}
export const NOTHING_SETTLED: Settled = { queen: 0, gentlemen: 0, gift: 0, restitution: 0, seized: 0 };

const said = (s: WorldState, text: string, stop = false): WorldState => ({ ...s, log: [...s.log, { turn: s.turn, text, ...(stop ? { stop } : {}) }] });

/**
 * Into Plymouth: the backers' shares paid out of what you bring home, and
 * then the reckoning waits on your choice. Called by `raise` on raising home.
 */
export function comeHome(s: WorldState): WorldState {
  // The ore assayed: Frobisher's two hundred tons of 1578 were iron pyrites, and went to mend the roads.
  if (s.seen.includes('ore')) s = said(s, 'the shining ore assayed at the Tower: iron pyrites, fool’s gold, fit to mend the roads with');
  const due = sharesDue(s);
  let w: WorldState = { ...s, gold: s.gold - due.queen - due.gentlemen, settled: { ...NOTHING_SETTLED, queen: due.queen, gentlemen: due.gentlemen } };
  if (due.queen) w = said(w, `the Queen's third paid into the Exchequer: ${due.queen}`);
  if (due.gentlemen) w = said(w, `the gentlemen adventurers paid their half: ${due.gentlemen}`);
  const demand = restitutionFor(w);
  const words = [
    w.grievance > 0 ? `Spain's ambassador demands restitution: ${demand}` : '',
    w.infamy > 0 ? `the Admiralty asks about the ${w.infamy === 1 ? 'ship' : 'ships'} you took that weren't Spain's` : '',
  ].filter(Boolean);
  return said({ ...w, dilemma: { kind: 'reckoning' } }, words.length ? words.join('; ') : 'home, and nobody asking questions', true);
}

/** Your choice at the reckoning, and what comes of it: the voyage is over, and won, however it went. */
export function reckon(s: WorldState, choice: 'court' | 'low' | 'gift', roll: () => number): WorldState {
  // The jewels not set aside go to a goldsmith first; lying low, the rest go too, for you won't be at court to give them.
  let w: WorldState = sellJewels({ ...s, dilemma: null });
  if (choice === 'low') w = sellJewels({ ...w, jewels: w.jewels.map((j) => ({ ...j, forQueen: false })) });
  const ring = proofOfService(w);
  const pleased = pleasure(w);
  const presented = w.jewels.filter((j) => j.forQueen);
  const present = (x: WorldState): WorldState => {
    if (!presented.length) return x;
    const names = presented.map((j) => j.name).join(', ');
    const lines = [`presented to the Queen: ${names}`, ...(presented.some(toHerTaste) ? ['she was so pleased she wore it at court that night'] : []), ...(ring ? ['the dead commander’s ring, proof of your service, and she says so before Spain’s ambassador'] : [])];
    return { ...x, jewels: [], infamy: Math.max(0, x.infamy - (ring ? 1 : 0)), log: [...x.log, ...lines.map((text) => ({ turn: x.turn, text }))] };
  };
  const settled = { ...w.settled };
  const pirate = (): WorldState => {
    const seized = Math.round(w.gold * SEIZED);
    settled.seized = seized;
    return said({ ...w, gold: w.gold - seized, verdict: 'pirate', fame: 0, settled }, `named a pirate: ${seized} of the prize seized by the Admiralty, and the rest of it hidden`, true);
  };
  if (choice === 'gift') {
    const gift = giftGold(w);
    settled.gift = gift;
    w = present(w);
    w = said({ ...w, gold: w.gold - gift, infamy: Math.max(0, w.infamy - GIFT_PARDON), settled }, gift ? `a gift for the Queen from the treasure, ${gift}, and she receives you` : 'the jewels are gift enough, and she receives you');
    if (outlawed(w)) w = pirate();
    else {
      const fame = fameFor(w.gold) + pleased;
      w = said({ ...w, verdict: 'gift', fame }, 'received at court under the Queen’s favour: Spain’s ambassador is told the matter is closed', true);
    }
  } else if (choice === 'court') {
    const risk = courtRisk(w);
    w = present(w);
    if (outlawed(w)) w = pirate();
    else if (roll() < risk) {
      const back = restitutionFor(w);
      settled.restitution = back;
      w = said({ ...w, gold: w.gold - back, verdict: 'disowned', fame: 0, settled }, `disowned at court to please Spain: ${back} handed back as restitution`, true);
    } else {
      const fame = fameFor(w.gold) + pleased;
      w = said({ ...w, verdict: 'court', fame }, 'shown at court: the Queen’s countenance shows great joy, whatever she tells the ambassador', true);
    }
  } else {
    if (outlawed(w) && roll() < LOW_PIRATE) w = pirate();
    else w = said({ ...w, verdict: 'low', fame: 0 }, 'you lie low in the West Country till the ambassador finds another grievance');
  }
  return { ...w, won: true, ending: 'home' };
}
