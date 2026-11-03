/** Letters of marque: a run in three acts. Run with `npm test`. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { START_OUTFIT } from '../outfit.ts';
import { act, legalActions } from '../rules.ts';
import { TARGETS } from '../setup.ts';
import { portNamed } from './map.ts';
import { attack, fight, meeting, raid } from './meet.ts';
import { ACTS, DAYS, EXTENSION, LATE_STANDING, type Letter, PLATE_CARGO, PLATE_HULL, PRIZES, REGIONS, REWARD, checkDeadline, inRegion, issue } from './letters.ts';
import { buyPardon } from './port.ts';
import { readShip } from './scout.ts';
import { makePeace } from './wars.ts';
import { createSea, createWorld, homeward, type WorldState } from './world.ts';

const sea = createSea();
const { map } = sea;
const at = (name: string) => portNamed(map, name);

/** Fight to a finish with a hull nothing can sink, taking her if it can. */
function takeHer(w: WorldState): WorldState {
  let s: WorldState = { ...w, encounter: { ...w.encounter!, fight: { ...w.encounter!.fight, ship: { ...w.encounter!.fight.ship, hull: 999, maxHull: 999 } } } };
  while (s.encounter) {
    const f = s.encounter.fight;
    const score = (a: ReturnType<typeof legalActions>[number]) => {
      const n = act(f, a);
      return n.outcome === 'destroyed' ? -1e6 : n.outcome === 'fled' || n.outcome === 'escaped' ? 1e6 : n.target.hull + n.range;
    };
    s = fight(sea, s, legalActions(f).reduce((a, b) => (score(b) < score(a) ? b : a)));
  }
  return s;
}

/** A letter for act one against Spain on the Spanish Main: easy to stage. */
const spanishLetter = (w: WorldState, over: Partial<Letter> = {}): Letter => ({
  act: 1, nation: 'spain', region: 'main', task: { kind: 'prizes', count: PRIZES }, progress: 0, issued: w.turn, deadline: w.turn + DAYS[0], reward: REWARD[0], renewed: false, ...over,
});

/** Take a Spanish merchant at open water on the Main, at peace with Spain: only the letter makes her fair game. */
function takeOnTheMain(w: WorldState): WorldState {
  const here = map.nodes.find((n) => n.kind === 'ocean' && inRegion(sea, 'main', n.id) && !n.waters)!.id;
  const merchant = w.ships.find((s) => s.kind === 'merchant' && s.nation === 'spain')!;
  for (let seed = 0; seed < 20; seed++) {
    const met = meeting(sea, { ...w, rng: seed, player: here, ships: [{ ...merchant, node: here }], trail: [[]] });
    const after = takeHer(attack(met));
    if (after.reckoning?.outcome === 'destroyed') return { ...after, spoil: null, ships: w.ships, trail: w.trail };
  }
  throw new Error('no prize');
}

test('a run opens with the first letter: two prizes near home, against a nation with ports there', () => {
  for (let seed = 0; seed < 20; seed++) {
    const w = createWorld(sea, seed);
    const l = w.letter!;
    assert.equal(w.commission, 'active');
    assert.equal(l.act, 1);
    assert.deepEqual(l.task, { kind: 'prizes', count: PRIZES });
    assert.ok(['narrow-seas', 'barbary'].includes(l.region!));
    assert.ok(REGIONS[l.region!].nations.includes(l.nation));
    assert.equal(l.deadline, DAYS[0]);
  }
});

test("a letter makes its nation fair game, at peace or not: the Crown doesn't mind", () => {
  const base = createWorld(sea, 2);
  const w = { ...base, wars: makePeace(base.wars, 'england', 'spain'), letter: spanishLetter(base) };
  const after = takeOnTheMain(w);
  assert.ok((after.standing.england ?? 0) >= 0, 'no penalty with England');
  assert.equal(after.tension.spain ?? 0, 0, 'no strain on the peace');
});

test('prizes count toward the letter, and the last of them pays it and brings the next', () => {
  const base = createWorld(sea, 2);
  let w: WorldState = { ...base, gold: 0, letter: spanishLetter(base) };
  w = takeOnTheMain(w);
  assert.equal(w.letter!.progress, 1);
  assert.equal(w.acts, 0);
  const goldBefore = w.gold;
  w = takeOnTheMain(w);
  assert.equal(w.acts, 1);
  assert.ok(w.gold >= goldBefore + REWARD[0], 'the reward, on top of the prize');
  const two = w.letter!;
  assert.equal(two.act, 2);
  assert.deepEqual(two.task, { kind: 'sack' });
  assert.ok(['main', 'brazil', 'indies'].includes(two.region!));
  assert.ok(w.log.some((l) => l.stop && l.text.startsWith('a new letter by the packet')));
});

test('a prize outside the region, or of another nation, does not count', () => {
  const base = createWorld(sea, 2);
  const w: WorldState = { ...base, letter: spanishLetter(base, { region: 'narrow-seas' }) };
  assert.equal(takeOnTheMain(w).letter!.progress, 0);
  const dutch: WorldState = { ...base, letter: spanishLetter(base, { nation: 'netherlands' }) };
  assert.equal(takeOnTheMain(dutch).letter!.progress, 0);
});

test('a sack in the region does the second act', () => {
  const base = createWorld(sea, 1);
  const town = at('Maracaibo');
  for (let seed = 0; seed < 40; seed++) {
    const w: WorldState = { ...base, rng: seed, player: town, hull: 40, maxHull: 40, letter: spanishLetter(base, { act: 2, task: { kind: 'sack' }, reward: REWARD[1] }) };
    const after = takeHer(raid(sea, w));
    if (after.reckoning?.outcome !== 'destroyed') continue;
    assert.equal(after.acts, 1);
    assert.equal(after.letter!.act, 3);
    return;
  }
  assert.fail('no sack in 40 tries');
});

test('the third letter names a Spanish plate ship, with sure word of her, and she sails stronger and richer', () => {
  const w = createWorld(sea, 4);
  const l = issue(sea, w, ACTS, { rng: 9 });
  assert.equal(l.task.kind, 'take');
  const ship = w.ships.find((s) => s.id === (l.task as { shipId: number }).shipId)!;
  assert.equal(ship.nation, 'spain');
  assert.ok(ship.kind === 'treasure-ship' || ship.kind === 'treasure-fleet');
  const r = readShip({ ...w, letter: l }, ship);
  assert.equal(r.hull, TARGETS[ship.kind].hull + PLATE_HULL);
  assert.equal(r.cargo, TARGETS[ship.kind].cargo + PLATE_CARGO);
});

test('take the plate ship and every letter is done: home to London is the win', () => {
  const base = createWorld(sea, 4);
  const plate = base.ships.find((s) => s.kind === 'treasure-ship' && s.nation === 'spain')!;
  const here = map.nodes.find((n) => n.kind === 'ocean' && !n.waters && Math.abs(n.lat) < 30)!.id;
  for (let seed = 0; seed < 30; seed++) {
    const letter: Letter = { act: 3, nation: 'spain', region: null, task: { kind: 'take', shipId: plate.id }, progress: 0, issued: 0, deadline: DAYS[2], reward: REWARD[2], renewed: false };
    // A frigate: a pinnace has no business with the plate ship, which runs, and runs hard.
    const outfit = { ...START_OUTFIT, ship: 'frigate' };
    const w: WorldState = { ...base, rng: seed, acts: 2, letter, outfit, player: here, ships: [{ ...plate, node: here }], trail: [[]] };
    const met = meeting(sea, w);
    const after = takeHer(met.hail ? attack(met) : met);
    if (after.reckoning?.outcome !== 'destroyed') continue;
    assert.equal(after.acts, 3);
    assert.equal(after.commission, 'done');
    assert.equal(after.letter, null);
    assert.ok(homeward(after));
    return;
  }
  assert.fail('the plate ship got away every time');
});

test('a letter overdue: more time once, at a price; then it is revoked, and you are a pirate', () => {
  const w = createWorld(sea, 1);
  const late = checkDeadline({ ...w, turn: w.letter!.deadline + 1 });
  assert.equal(late.letter!.renewed, true);
  assert.equal(late.letter!.deadline, w.letter!.deadline + Math.round(DAYS[0] * EXTENSION));
  assert.equal(late.standing.england, -LATE_STANDING);
  assert.equal(late.pirate, false);
  const revoked = checkDeadline({ ...late, turn: late.letter!.deadline + 1 });
  assert.equal(revoked.letter, null);
  assert.equal(revoked.commission, 'revoked');
  assert.equal(revoked.pirate, true);
});

test('a pardon after a revoked letter brings the next one', () => {
  const w = createWorld(sea, 1);
  const revoked: WorldState = { ...w, letter: null, commission: 'revoked', pirate: true, acts: 1, gold: 500, standing: { england: -3 } };
  const pardoned = buyPardon(sea, revoked);
  assert.equal(pardoned.pirate, false);
  assert.equal(pardoned.commission, 'active');
  assert.equal(pardoned.letter!.act, 2);
});
