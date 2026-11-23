/**
 * Warnings before a mistake there's no coming back from: setting out on a
 * leg the food or water won't see out. The master says it while he lives,
 * in his own words; after, the plain sum. Oregon Trail let you leave
 * Independence with no food; this is the old hand at your elbow who
 * wouldn't.
 *
 * Pure: the UI asks once a departure, and shows the same beside the casks
 * and the chandler while you can still put it right.
 */

import { plotCourse } from './course.ts';
import { alive, nameOf } from './hands.ts';
import { HOME_LANDMARK, landmark } from './landmarks.ts';
import { daysTo, onward } from './journey.ts';
import { followed } from './rumors.ts';
import { EAT, TROPIC_THIRST, daysOf, landmarkHere, marketHere, shoreHere } from './stores.ts';
import type { Sea, WorldState } from './world.ts';

/** Days over the leg that stores should run to: a calm, a storm run before, a wrong guess at the wind. */
export const MARGIN = 7;

export interface Warning {
  kind: 'water' | 'food';
  /** Days of it aboard, at these rations, on this leg. */
  have: number;
  /** Days' sail to the next landmark. */
  leg: number;
  /** Where to. */
  to: string;
  /** How to put it right here, if you can. */
  fix: 'buy' | 'fill' | 'forage' | 'trade' | null;
  /** The master's words, or the plain sum. */
  text: string;
}

/** The leg ahead: where you're bound, the one way on, or at a fork the nearest of the ways (home aside). */
function legAhead(sea: Sea, s: WorldState): string | null {
  if (s.voyage.bound) return s.voyage.bound;
  const one = onward(s.voyage, followed(s));
  if (one) return one;
  const ways = landmark(s.voyage.at).next.concat(followed(s)).filter((k) => k !== HOME_LANDMARK);
  if (!ways.length) return null;
  return ways.reduce((a, b) => (daysTo(sea, s, b) < daysTo(sea, s, a) ? b : a));
}

/** The share of a leg's days spent in the tropics, where the water goes half as fast again. */
function tropicShare(sea: Sea, s: WorldState, key: string): number {
  const course = plotCourse(sea, s, sea.map.landmarks[key]);
  if (course.length < 2) return 0;
  return course.slice(1).filter((n) => Math.abs(sea.map.nodes[n].lat) < 23.5).length / (course.length - 1);
}

/** What won't last the leg ahead, at a landmark, at the rations you've set. Empty if all's well, or you're at sea. */
export function warnings(sea: Sea, s: WorldState): Warning[] {
  if (s.won || s.sunk || !landmarkHere(sea, s)) return [];
  const key = legAhead(sea, s);
  if (!key) return [];
  const leg = daysTo(sea, s, key);
  if (!Number.isFinite(leg) || leg <= 0) return [];
  const to = key === HOME_LANDMARK ? 'home' : landmark(key).name;
  const days = daysOf(s);
  const thirst = 1 + (TROPIC_THIRST - 1) * tropicShare(sea, s, key);
  const water = s.crew ? Math.floor(s.stores.water / (s.crew * EAT[s.rations] * thirst)) : Infinity;
  const shore = shoreHere(sea, s);
  const market = marketHere(sea, s);
  const master = alive(s, 'master') ? nameOf(s, 'master') : null;
  const out: Warning[] = [];
  // Short of the leg, it won't do; short only of the margin, it will barely, with nothing over for a calm.
  const say = (what: string, have: number, hot: boolean) => {
    const verdict = have < leg ? `won’t see us to ${to}` : `will barely see us to ${to}, with nothing over for a calm`;
    const sum = `${have} days of it, ${leg} days’ sail${hot ? ', and the tropics drink faster' : ''}`;
    return master ? `${master}, the master: “the ${what} ${verdict}. ${sum}.”` : `the ${what} ${verdict.replace('see us', 'last').replace('won’t last', 'won’t last')}: ${sum}.`;
  };
  if (water < leg + MARGIN) {
    const fix = market === 'chandler' ? 'buy' : shore.includes('water') ? 'fill' : market === 'islanders' ? 'trade' : null;
    out.push({ kind: 'water', have: water, leg, to, fix, text: say('water', water, thirst > 1.05) });
  }
  if (days.food < leg + MARGIN) {
    const fix = market === 'chandler' ? 'buy' : shore.includes('forage') ? 'forage' : market === 'islanders' ? 'trade' : null;
    out.push({ kind: 'food', have: days.food, leg, to, fix, text: say('food', days.food, false) });
  }
  return out;
}

/** What puts it right here, in words, for the warning's buttons. */
export const FIX_WORDS: Record<NonNullable<Warning['fix']>, string> = {
  buy: 'buy it from the chandler',
  fill: 'fill the casks here',
  forage: 'forage and fish here',
  trade: 'trade with the islanders',
};

/** A departure's warnings, as one key: asked once, and again only if the stores or the way change. */
export const warningKey = (s: WorldState, w: Warning[]) => `${s.turn}:${s.voyage.at}:${s.voyage.bound}:${Math.round(s.stores.food)}:${Math.round(s.stores.water)}:${s.rations}:${w.map((x) => x.kind).join(',')}`;
