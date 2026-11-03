/** The late game: renown, the home stretch, and the Barbary corsairs. Run with `npm test`. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { act, legalActions } from '../rules.ts';
import { TARGETS } from '../setup.ts';
import { portNamed } from './map.ts';
import { CAPTIVES_CARGO, attack, fight, meeting } from './meet.ts';
import { CORSAIR_REACH, PRIVATEER_RANGE, corsairTarget, privateerGoal } from './ships.ts';
import { declare } from './wars.ts';
import { CORSAIR_PORTS, GOAL, HULL_PER_RENOWN, RENOWN, advance, createSea, createWorld, homeward, pursuitOf, renown, type WorldState } from './world.ts';

const sea = createSea();
const { map } = sea;
const at = (name: string) => portNamed(map, name);
/** Out in the Pacific, a long way from anyone's business. */
const farOut = () => map.nodes.find((n) => n.kind === 'ocean' && Math.abs(n.lon + 150) < 4 && Math.abs(n.lat + 20) < 4)!.id;

/** Fight to a finish with a hull nothing can sink, taking her if it can. */
function takeHer(w: WorldState): WorldState {
  let s: WorldState = { ...w, encounter: { ...w.encounter!, fight: { ...w.encounter!.fight, ship: { ...w.encounter!.fight.ship, hull: 999, maxHull: 999 } } } };
  while (s.encounter) {
    const f = s.encounter.fight;
    const score = (a: ReturnType<typeof legalActions>[number]) => {
      const n = act(f, a);
      return n.outcome === 'destroyed' ? -1e6 : n.outcome === 'fled' || n.outcome === 'escaped' ? 1e6 : n.target.hull - n.target.way;
    };
    const best = legalActions(f).reduce((a, b) => (score(b) < score(a) ? b : a));
    s = fight(sea, s, best);
  }
  return s;
}

test('renown: a step at each mark, and the hunters come farther and better found', () => {
  assert.deepEqual([0, 59, 60, 119, 120, 200, 999].map((fame) => renown({ fame })), [0, 0, 1, 1, 2, 3, 3]);
  const w = createWorld(sea, 1);
  assert.equal(pursuitOf(w, sea).reach, 1);
  assert.equal(pursuitOf({ ...w, fame: RENOWN[2] }, sea).reach, 1.75);

  // A guard ship alongside a captain with a name carries more hull.
  const hunter = w.ships.find((s) => s.kind === 'hunter')!;
  const here = farOut();
  const met = (fame: number) =>
    meeting(sea, { ...w, fame, player: here, standing: { [hunter.nation]: -5 }, ships: [{ ...hunter, node: here }], trail: [[]] });
  const base = TARGETS.hunter.hull;
  assert.equal(met(0).encounter?.fight.target.maxHull, base);
  assert.equal(met(RENOWN[2]).encounter?.fight.target.maxHull, base + 3 * HULL_PER_RENOWN);
});

test('a prize past a mark of renown is news worth heaving to for', () => {
  const w = createWorld(sea, 3);
  const merchant = w.ships.find((s) => s.kind === 'merchant' && s.nation === 'spain')!;
  const here = farOut();
  for (let seed = 0; seed < 10; seed++) {
    const s = meeting(sea, { ...w, rng: seed, fame: RENOWN[0] - 1, player: here, wars: declare(w.wars, 'england', 'spain'), ships: [{ ...merchant, node: here }], trail: [[]] });
    const after = takeHer(attack(s));
    if (!after.reckoning?.payout) continue;
    assert.equal(after.fame, RENOWN[0] - 1 + after.reckoning.payout);
    assert.equal(renown(after), 1);
    assert.ok(after.log.some((l) => l.stop && l.text.startsWith('your name is getting about')));
    return;
  }
  assert.fail('no prize in ten tries');
});

test('homeward bound with the score, and every enemy privateer comes, from anywhere', () => {
  const w = createWorld(sea, 1);
  const far = farOut();
  const dunkirk = at('Dunkirk');
  assert.ok(map.distTo(dunkirk)[far] > PRIVATEER_RANGE * 2);
  assert.equal(privateerGoal(map, { home: dunkirk, nation: 'france' }, far, true), dunkirk, 'out of range: she stays home');
  assert.equal(privateerGoal(map, { home: dunkirk, nation: 'france' }, far, true, 1, true), far, 'homeward: she comes');
  assert.equal(privateerGoal(map, { home: dunkirk, nation: 'france' }, far, false, 1, true), dunkirk, 'not at war: she does not');

  const rich = { ...w, gold: GOAL, player: far, ships: [], trail: [], letter: null, acts: 3, commission: 'done' as const };
  assert.ok(homeward(rich));
  assert.ok(!homeward({ ...rich, pirate: true }), "a pirate isn't bound for London");
  const next = advance(sea, rich, far);
  assert.ok(next.homewardNoised);
  assert.equal(next.log.filter((l) => l.text.startsWith('word is out')).length, 1);
  const again = advance(sea, next, far);
  assert.equal(again.log.filter((l) => l.text.startsWith('word is out')).length, 1, 'said once');
});

test('corsairs fit out of the Barbary ports and pick open towns of their enemies within reach', () => {
  const w = createWorld(sea, 1);
  const corsairs = w.ships.filter((s) => s.kind === 'corsair');
  assert.equal(corsairs.length, CORSAIR_PORTS.length);
  assert.ok(corsairs.every((c) => c.nation === 'barbary' || c.nation === 'morocco'));

  const algiers = corsairs.find((c) => c.home === at('Algiers'))!;
  const prey = pursuitOf(w, sea).prey('barbary');
  assert.ok(prey.includes(at('Baltimore')), 'Baltimore: English, and open');
  assert.ok(!prey.includes(at('Plymouth')), 'a fortified port is not for corsairs');
  const seen = new Set<number>();
  for (let i = 0; i < 200; i++) {
    const t = corsairTarget(map, { rng: i * 31 + 7 }, algiers, pursuitOf(w, sea))!;
    assert.ok(map.distTo(algiers.home)[t] <= CORSAIR_REACH);
    assert.ok(prey.includes(t));
    seen.add(t);
  }
  assert.ok(seen.size > 5, 'they range about');
});

test('a corsair raids a town, the town is stripped, and the captives go home with her', () => {
  let w: WorldState = { ...createWorld(sea, 4), player: farOut() };
  let raided: string | null = null;
  let home = false;
  for (let day = 0; day < 400 && !home; day++) {
    w = advance(sea, { ...w, encounter: null, hail: null, dilemma: null }, w.player);
    const line = w.log.find((l) => l.text.includes('corsairs raided'));
    if (line && !raided) {
      raided = line.text;
      const c = w.ships.find((s) => s.kind === 'corsair' && s.captives)!;
      assert.ok(c, 'she has captives aboard');
      assert.equal(c.dest, c.home);
    }
    if (raided && w.ships.some((s) => s.kind === 'corsair' && !s.captives && s.laidUp > w.turn)) home = true;
  }
  assert.ok(raided, 'some town was raided');
  const town = raided!.match(/raided (.+) and carried/)![1];
  assert.ok((w.sacked[at(town)] ?? 0) > 0, `${town} is stripped`);
  assert.ok(home, 'and a corsair made it home with them');
});

test('take a laden corsair and the captives go free: their nation and the Crown hear of it', () => {
  const w = createWorld(sea, 5);
  const corsair = { ...w.ships.find((s) => s.kind === 'corsair')!, captives: 'spain' as const, raid: null };
  const here = farOut();
  const met = meeting(sea, { ...w, player: here, ships: [{ ...corsair, node: here }], trail: [[]] });
  assert.equal(met.encounter?.kind, 'corsair');
  assert.equal(met.encounter?.fight.target.cargo, TARGETS.corsair.cargo + CAPTIVES_CARGO);
  const after = takeHer(met);
  assert.equal(after.reckoning?.outcome, 'destroyed');
  assert.equal(after.standing.spain, 1);
  assert.equal(after.standing.england, 2, 'a point for taking an enemy, and another for the captives');
  assert.ok(after.log.some((l) => l.text.startsWith('you freed Spanish captives')));
  assert.equal(after.ships[0].captives, null);
});
