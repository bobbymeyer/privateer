/**
 * The days of the year a ship of 1580 kept. England counts by the Julian
 * calendar, and goes on doing so for another 170 years: when the Pope drops
 * ten days in October 1582, Spain and Portugal drop them too, and the
 * English don't. The year turns on New Year's Day for the almanacs and the
 * giving of gifts, but on Lady Day, 25 March, for the law.
 *
 * Christmas and the Queen's Accession Day ask you something; the rest are a
 * line in the log, once each, and never stop the ship. Sundays bring prayers
 * on the waist now and then, not every week, or the log would be nothing
 * else.
 *
 * Called by `aDay`, every day, at sea or not.
 */

import { type Roller, pick, roll } from './random.ts';
import type { WorldState } from './world.ts';

/** The day you set out, as the English reckon it: 1 December 1580. */
const SET_OUT = { y: 1580, m: 12, d: 1 };

const DAYS_IN = (y: number, m: number) => [31, y % 4 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];

/**
 * The date on a day of the voyage, Julian, as `dateOf` in world.ts prints
 * it. The two agree: between 1580 and 1700 the Julian and the proleptic
 * Gregorian calendars have the same leap years, so counting days on from 1
 * December gives the same day and month in both.
 */
export function dateParts(turn: number): { y: number; m: number; d: number } {
  let { y, m, d } = SET_OUT;
  for (let n = turn; n > 0; n--) {
    d++;
    if (d > DAYS_IN(y, m)) {
      d = 1;
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }
  }
  return { y, m, d };
}

/** The day of the week of a Julian date, 0 for Sunday, by its Julian day number. */
export function weekday(y: number, m: number, d: number): number {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  const jdn = d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - 32083;
  return (jdn + 1) % 7;
}

/** Easter Day in a Julian year: the old reckoning (Meeus), which England keeps. */
export function easter(y: number): { m: number; d: number } {
  const a = y % 4;
  const b = y % 7;
  const c = y % 19;
  const dd = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - dd + 34) % 7;
  const n = dd + e + 114;
  return { m: Math.floor(n / 31), d: (n % 31) + 1 };
}

export type Feast = 'christmas' | 'new-year' | 'lady-day' | 'easter' | 'midsummer' | 'accession' | 'reform';

/** The feast a day of the voyage falls on, if any. */
export function feastOn(turn: number): Feast | null {
  const { y, m, d } = dateParts(turn);
  if (m === 12 && d === 25) return 'christmas';
  if (m === 1 && d === 1) return 'new-year';
  if (m === 3 && d === 25) return 'lady-day';
  const e = easter(y);
  if (m === e.m && d === e.d) return 'easter';
  if (m === 6 && d === 24) return 'midsummer';
  if (m === 11 && d === 17) return 'accession';
  // 5 October 1582 in England; the fifteenth in Spain.
  if (y === 1582 && m === 10 && d === 5) return 'reform';
  return null;
}

/** On a Sunday at sea, prayers are worth a line this often. */
export const PRAYERS_CHANCE = 1 / 5;

const PRAYERS = [
  'Sunday: prayers on the waist, the master reading from the Book of Common Prayer',
  'Sunday: a psalm sung at the main mast, and the hands bareheaded',
  'Sunday: prayers, and the chaplain’s sermon long enough to make the hands wish for a sail',
  'Sunday: prayers for the Queen, and for a fair wind, in that order',
];

const said = (s: WorldState, text: string): WorldState => ({ ...s, log: [...s.log, { turn: s.turn, text }] });

/** The day's feast, kept once; or a Sunday's prayers. Christmas and Accession Day ask, if nothing else is. */
export function calendarDay(s: WorldState, r: Roller, atSea: boolean): WorldState {
  const { y, m, d } = dateParts(s.turn);
  const feast = feastOn(s.turn);
  if (feast) {
    const key = `day:${feast}:${y}`;
    if (s.seen.includes(key)) return s;
    let w: WorldState = { ...s, seen: [...s.seen, key] };
    switch (feast) {
      case 'christmas':
        return w.dilemma ? said(w, 'Christmas Day, and no keeping it') : said({ ...w, dilemma: { kind: 'christmas' } }, 'Christmas Day');
      case 'accession':
        return w.dilemma ? said(w, 'the Queen’s day, the anniversary of her coming to the throne: a toast, and no more') : said({ ...w, dilemma: { kind: 'accession' } }, 'the seventeenth of November: the Queen’s day');
      case 'new-year':
        return said(w, `New Year’s Day: gifts in the great cabin, as at court. the year itself won’t turn till Lady Day, and the lawyers still write ${y - 1}`);
      case 'lady-day':
        return said(w, `Lady Day: the year turns, and it is ${y} even for the lawyers`);
      case 'easter':
        w = said(w, atSea ? 'Easter Day: prayers on the waist, and the last of the salt beef that wasn’t ship’s biscuit' : 'Easter Day: the hands ashore to hear prayers under the trees');
        return w;
      case 'midsummer':
        return said(w, 'Midsummer Day, St John’s: at home there are bonfires on every hill');
      case 'reform':
        return said(w, 'the fifth of October: in Spain and Portugal, by the Pope’s new calendar, it is the fifteenth, and ten days are gone. the English keep theirs');
    }
  }
  // Sundays at sea, now and then.
  if (atSea && weekday(y, m, d) === 0 && roll(r) < PRAYERS_CHANCE) return said(s, pick(r, PRAYERS));
  return s;
}

/** Christmas: a double ration eats a day's food more. */
export const CHRISTMAS_DAYS = 1;
/** Kept plain, the hands grumble this often, and it comes to a head at the next landmark. */
export const PLAIN_GRUMBLE = 1 / 3;
