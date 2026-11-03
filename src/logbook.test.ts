/** The logbook, today's voyage, and a run's tally and last fight. Run with `npm test`. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { type Entry, LOG_KEPT, best, dailySeed, entryFor, today, withEntry } from './logbook.ts';
import { legalActions } from './rules.ts';
import { portNamed } from './world/map.ts';
import { fight, raid } from './world/meet.ts';
import { ROUNDS_KEPT } from './world/record.ts';
import { createSea, createWorld, type WorldState } from './world/world.ts';

const sea = createSea();

const entry = (over: Partial<Entry>): Entry => ({ when: '2026-11-03', seed: 1, daily: null, day: 100, gold: 50, acts: 0, ending: 'sunk', ship: 'pinnace', sunkBy: null, taken: 0, sacks: 0, ...over });

test("today's voyage: one seed a day, the same for everyone, different the next day", () => {
  assert.equal(dailySeed('2026-11-03'), dailySeed('2026-11-03'));
  assert.notEqual(dailySeed('2026-11-03'), dailySeed('2026-11-04'));
  assert.ok(Number.isInteger(dailySeed('2026-11-03')) && dailySeed('2026-11-03') >= 0);
  assert.equal(today(new Date('2026-11-03T15:00:00Z')), '2026-11-03');
});

test('the best run is the richest win; with no win, the furthest the letters went', () => {
  assert.equal(best([]), null);
  const log = [entry({ gold: 300, acts: 2 }), entry({ gold: 90, ending: 'home', acts: 3 }), entry({ gold: 140, ending: 'retired' })];
  assert.equal(best(log)!.gold, 140);
  assert.equal(best([entry({ acts: 1, gold: 500 }), entry({ acts: 2, gold: 10 })])!.acts, 2);
});

test('the log keeps the newest runs first, and only so many', () => {
  let log: Entry[] = [];
  for (let i = 0; i < LOG_KEPT + 5; i++) log = withEntry(log, entry({ seed: i }));
  assert.equal(log.length, LOG_KEPT);
  assert.equal(log[0].seed, LOG_KEPT + 4);
});

test('a run sunk in a raid: the tally counts the fight, the record tells its last rounds, the entry names what sank you', () => {
  const town = portNamed(sea.map, 'Maracaibo');
  for (let seed = 0; seed < 40; seed++) {
    let w: WorldState = { ...createWorld(sea, 1), rng: seed, player: town, hull: 3, maxHull: 10 };
    w = raid(sea, w);
    while (w.encounter) w = fight(sea, w, legalActions(w.encounter.fight)[0]);
    if (!w.sunk) continue;
    assert.equal(w.tally.fights, 1);
    const f = w.lastFight!;
    assert.equal(f.what, 'the raid on Maracaibo');
    assert.equal(f.outcome, 'sunk');
    assert.equal(f.hullIn, 3);
    assert.equal(f.hullOut, 0);
    assert.ok(f.lastRounds.length >= 1 && f.lastRounds.length <= ROUNDS_KEPT);
    assert.ok(f.lastRounds.at(-1)!.lines.length > 0);
    const e = entryFor(w, 7, '2026-11-03', new Date('2026-11-03T12:00:00Z'));
    assert.equal(e.ending, 'sunk');
    assert.equal(e.sunkBy, 'the raid on Maracaibo');
    assert.equal(e.daily, '2026-11-03');
    return;
  }
  assert.fail('never sunk in 40 tries on a 3-point hull');
});

test('a prize counts in the tally, and the best prize is kept', () => {
  const town = portNamed(sea.map, 'Maracaibo');
  for (let seed = 0; seed < 40; seed++) {
    let w: WorldState = { ...createWorld(sea, 1), rng: seed, player: town, hull: 60, maxHull: 60 };
    w = raid(sea, w);
    while (w.encounter) w = fight(sea, w, legalActions(w.encounter.fight)[0]);
    if (w.reckoning?.outcome !== 'destroyed') continue;
    assert.equal(w.tally.sacks, 1);
    assert.equal(w.tally.taken, 0);
    assert.equal(w.tally.best!.payout, w.reckoning.payout);
    return;
  }
  assert.fail('no sack in 40 tries');
});
