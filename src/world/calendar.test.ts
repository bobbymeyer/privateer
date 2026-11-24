/** The days of the year a ship of 1580 kept. Run with `npm test`. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CHRISTMAS_DAYS, calendarDay, dateParts, easter, feastOn, weekday } from './calendar.ts';
import { choices, choose } from './dilemmas.ts';
import { createSea, createWorld, dateOf, type WorldState } from './world.ts';

const sea = createSea();
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** The turn a date falls on. */
const turnOf = (y: number, m: number, d: number) => {
  for (let t = 0; t < 1500; t++) {
    const p = dateParts(t);
    if (p.y === y && p.m === m && p.d === d) return t;
  }
  throw new Error('not in the voyage');
};

test('the voyage’s dates agree with what the log prints', () => {
  for (const t of [0, 30, 31, 365, 500, 700, 1000]) {
    const { y, m, d } = dateParts(t);
    assert.equal(dateOf(t), `${d} ${MONTHS[m - 1]} ${y}`);
  }
});

test('Easter by the old reckoning, and the days of the week', () => {
  assert.deepEqual(easter(1581), { m: 3, d: 26 });
  assert.deepEqual(easter(1582), { m: 4, d: 15 });
  assert.deepEqual(easter(1583), { m: 3, d: 31 });
  // 4 October 1582, Julian, the last day before Spain's reform: a Thursday. Christmas 1580, Julian: a Sunday.
  assert.equal(weekday(1582, 10, 4), 4);
  assert.equal(weekday(1580, 12, 25), 0);
});

test('the feasts fall where they should', () => {
  assert.equal(feastOn(turnOf(1580, 12, 25)), 'christmas');
  assert.equal(feastOn(turnOf(1581, 1, 1)), 'new-year');
  assert.equal(feastOn(turnOf(1581, 3, 25)), 'lady-day');
  assert.equal(feastOn(turnOf(1581, 3, 26)), 'easter');
  assert.equal(feastOn(turnOf(1581, 6, 24)), 'midsummer');
  assert.equal(feastOn(turnOf(1581, 11, 17)), 'accession');
  assert.equal(feastOn(turnOf(1582, 10, 5)), 'reform');
  assert.equal(feastOn(turnOf(1581, 2, 3)), null);
});

test('each kept once, as a line that never stops the ship; Christmas and the Queen’s day ask', () => {
  const r = { rng: 1 };
  const base = createWorld(sea, 1);
  const lady = { ...base, turn: turnOf(1581, 3, 25) };
  const once = calendarDay(lady, r, true);
  assert.match(once.log.at(-1)!.text, /Lady Day/);
  assert.ok(!once.log.at(-1)!.stop);
  assert.equal(calendarDay(once, r, true).log.length, once.log.length, 'once');
  const xmas = calendarDay({ ...base, turn: turnOf(1580, 12, 25) }, r, true);
  assert.equal(xmas.dilemma?.kind, 'christmas');
  const busy = calendarDay({ ...base, turn: turnOf(1580, 12, 25), dilemma: { kind: 'storm' } }, r, true);
  assert.equal(busy.dilemma?.kind, 'storm', 'a storm comes first; Christmas is a line');
  assert.match(calendarDay({ ...base, turn: turnOf(1582, 10, 5) }, r, true).log.at(-1)!.text, /ten days are gone/);
});

test('Christmas: a double ration costs a day’s food and settles the grumbling; plain risks it', () => {
  const s: WorldState = { ...createWorld(sea, 1), dilemma: { kind: 'christmas' }, seen: ['discontent'] };
  const kept = choose(sea, s, 'keep');
  assert.equal(kept.stores.food, s.stores.food - s.crew * CHRISTMAS_DAYS);
  assert.ok(!kept.seen.includes('discontent'));
  let grumbled = 0;
  for (let rng = 0; rng < 60; rng++) if (choose(sea, { ...s, seen: [], rng }, 'plain').seen.includes('discontent')) grumbled++;
  assert.ok(grumbled > 5 && grumbled < 40, `${grumbled} in 60`);
});

test('the Queen’s day: a salute costs a barrel, and needs one', () => {
  const s: WorldState = { ...createWorld(sea, 1), dilemma: { kind: 'accession' } };
  assert.equal(choose(sea, s, 'salute').stores.powder, s.stores.powder - 1);
  assert.equal(choose(sea, s, 'toast').stores.powder, s.stores.powder);
  const dry = { ...s, stores: { ...s.stores, powder: 0 } };
  assert.ok(choices(dry, dry.dilemma!).find((c) => c.key === 'salute')!.barred);
});

test('Sundays at sea bring prayers now and then, not every week', () => {
  let s: WorldState = createWorld(sea, 3);
  let prayers = 0;
  let sundays = 0;
  for (let t = 1; t < 400; t++) {
    const { y, m, d } = dateParts(t);
    if (weekday(y, m, d) !== 0 || feastOn(t)) continue;
    sundays++;
    const after = calendarDay({ ...s, turn: t }, { rng: t * 7919 }, true);
    if (after.log.length > s.log.length && /Sunday/.test(after.log.at(-1)!.text)) prayers++;
    s = { ...s, log: [] };
  }
  assert.ok(prayers > 0 && prayers < sundays / 2, `${prayers} of ${sundays}`);
});
