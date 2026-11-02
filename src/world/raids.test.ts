/** The war table, and raids on ports. Run with `npm test`. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FORTRESS_CARDS, TOWN_CARDS } from '../cards.ts';
import { act, legalActions } from '../rules.ts';
import { encounterWith, RELIEF_FROM } from '../setup.ts';
import { portNamed } from './map.ts';
import { ALARM_DAYS, SACK_DAYS, attack, fight, meeting, raid, raidable } from './meet.ts';
import { isHaven, retire, serves } from './port.ts';
import { HUNT_RANGE, hunterGoal } from './ships.ts';
import { CASUS_BELLI, ENGLAND_OPENS_AGAINST, STANDING_WARS, atWar, declare, drift, enemiesOf, isEnemy, makePeace, openingWars } from './wars.ts';
import { GOAL, advance, createSea, createWorld, type WorldState } from './world.ts';

const sea = createSea();
const { map } = sea;
const at = (name: string) => portNamed(map, name);
/** England at war with Spain and at peace with France, whatever the run opened with. */
const spanishWar = (w: WorldState): WorldState => ({ ...w, wars: makePeace(declare(w.wars, 'england', 'spain'), 'england', 'france') });
const quiet = (w: WorldState): WorldState => spanishWar({ ...w, ships: [], trail: [] });
/** Play a fight out greedily: the keep that leaves the other side worst off, and you best. */
const fightOut = (w: WorldState) => {
  while (w.encounter) {
    const f = w.encounter.fight;
    const score = (a: ReturnType<typeof legalActions>[number]) => {
      const n = act(f, a);
      const owed = (side: 'ship' | 'target') => [...n.deck, ...n.hand].filter((c) => c.damage && c.side === side).length;
      return n.outcome === 'destroyed' ? 1e6 : n.outcome === 'sunk' ? -1e6 : -(n.target.hull - owed('target')) + 0.5 * (n.ship.hull - owed('ship'));
    };
    w = fight(sea, w, legalActions(f).reduce((best, a) => (score(a) > score(best) ? a : best)));
  }
  return w;
};

test('a run opens with England against the corsairs and one great power, chosen by the run', () => {
  const against = new Set<string>();
  for (let seed = 0; seed < 30; seed++) {
    const wars = openingWars({ rng: seed * 7 + 1 });
    for (const [a, b] of STANDING_WARS) assert.ok(atWar(wars, a, b) && atWar(wars, b, a), 'symmetric');
    assert.ok(isEnemy(wars, 'barbary') && isEnemy(wars, 'morocco'));
    const great = ENGLAND_OPENS_AGAINST.filter((n) => isEnemy(wars, n));
    assert.equal(great.length, 1);
    against.add(great[0]);
  }
  assert.equal(against.size, 3, 'Spain, France and the Dutch all come up');
});

test('the wars drift, season by season', () => {
  let wars = openingWars({ rng: 1 });
  const r = { rng: 99 };
  const seen = new Set<string>();
  for (let season = 0; season < 40; season++) {
    wars = drift(wars, r).wars;
    seen.add(enemiesOf(wars, 'england').sort().join(','));
  }
  assert.ok(seen.size > 3, `England's enemies change over ten years: ${[...seen].join(' | ')}`);
});

/** On turn 1, with a ship of the given kind and flag lying one step off Plymouth (she won't move: it's her destination). */
function alongside(pick: (s: WorldState['ships'][number]) => boolean, extra: Partial<WorldState> = {}) {
  let w = spanishWar(advance(sea, spanishWar(createWorld(sea, 1)), createWorld(sea, 1).player));
  const step = map.adj[w.player].find((n) => !map.nodes[n].port)!;
  const ship = w.ships.find(pick)!;
  w = { ...w, ...extra, ships: w.ships.map((s) => (s.id === ship.id ? { ...s, node: step, dest: step } : s)) };
  return { w: advance(sea, w, step), ship };
}

test('an enemy warship attacks on sight, before you have done anything', () => {
  const { w, ship } = alongside((s) => s.kind === 'armada' && s.nation === 'spain');
  assert.equal(w.encounter?.shipId, ship.id);
  assert.equal(w.encounter?.forced, true);
});

test('an enemy is fair game: England minds not at all, and approves of a prize', () => {
  const { w } = alongside((s) => s.kind === 'merchant' && s.nation === 'spain');
  assert.equal(w.hail?.nation, 'spain');
  const fired = attack(w);
  assert.equal(fired.standing.spain, -1);
  assert.equal(fired.standing.england, undefined);
  for (let seed = 0; seed < 20; seed++) {
    const after = fightOut({ ...fired, rng: seed });
    if (after.reckoning?.outcome === 'destroyed') {
      assert.equal(after.standing.england, 1, 'the Crown approves');
      return;
    }
  }
});

test('a ship at peace with England: the Crown hears of it', () => {
  const { w } = alongside((s) => s.kind === 'merchant' && s.nation === 'france');
  const fired = attack(w);
  assert.equal(fired.standing.france, -1);
  assert.equal(fired.standing.england, -1);
  assert.equal(fired.pirate, false, 'not piracy, quite');
  assert.match(fired.log.at(-1)!.text, /French merchant, at peace with England: the Crown will hear of it/);
});

test('a raid: a town or a fortress by its walls, three points off, and the alarm raised', () => {
  const town = raid(sea, quiet({ ...createWorld(sea, 1), player: at('Maracaibo') }));
  assert.equal(town.encounter?.kind, 'town');
  assert.equal(town.encounter?.port, at('Maracaibo'));
  assert.equal(town.standing.spain, -3);
  assert.equal(town.standing.england, undefined, 'fair game');
  assert.equal(town.alarm.spain, town.turn + ALARM_DAYS);
  assert.equal(raid(sea, quiet({ ...createWorld(sea, 1), player: at('Havana') })).encounter?.kind, 'fortress');
  assert.throws(() => raid(sea, town), /fight to finish/, 'not twice at once');
  assert.throws(() => raid(sea, quiet({ ...createWorld(sea, 1), player: map.adj[at('Havana')].find((n) => !map.nodes[n].port)! })), /no port/);
});

test('a sack: the treasury is yours, the town has nothing for months, and Spain remembers it twice', () => {
  for (let seed = 0; seed < 40; seed++) {
    // A sturdy ship: this is about what a sack does, not how hard it is to win one.
    const before = { ...quiet({ ...createWorld(sea, 1), player: at('Maracaibo') }), rng: seed, hull: 30, maxHull: 30 };
    const after = fightOut(raid(sea, before));
    if (after.reckoning?.outcome !== 'destroyed') continue;
    assert.ok(after.reckoning.payout >= 10, `${after.reckoning.payout} from a sack`);
    assert.equal(after.gold, before.gold + after.reckoning.payout);
    assert.equal(after.sacked[at('Maracaibo')], before.turn + SACK_DAYS);
    assert.equal(after.standing.spain, -5);
    assert.equal(after.standing.england, 2, 'the Crown approves');
    assert.equal(serves(sea, after), false, 'nothing for anybody');
    assert.equal(raidable(sea, after), false);
    assert.throws(() => raid(sea, after), /sacked lately/);
    return;
  }
  assert.fail('no sack in 40 tries');
});

test('a town cannot run, a raiding party can, and if the raid goes on the garrison is reinforced', () => {
  for (const deck of [TOWN_CARDS, FORTRESS_CARDS]) assert.ok(!deck.some((c) => c.effects.some((e) => e.kind === 'flee')));
  let f = encounterWith('town', 1);
  assert.equal([...f.deck, ...f.hand].filter((c) => c.name === 'back to the boats').length, 2);
  // Keep blanks: play the first legal keep until the relief is due.
  while (!f.outcome && f.round < RELIEF_FROM) f = act(f, legalActions(f)[0]);
  if (f.outcome) return; // over before the relief was due: nothing to see
  assert.ok([...f.hand, ...f.deck].some((c) => c.id.startsWith('reinforce#')), 'relief came');
  assert.ok(f.hand.some((c) => c.id.startsWith('reinforce#')), 'on top, so in this hand');
});

test('an alarm sends guard ships twice as far', () => {
  const w = createWorld(sea, 1);
  const havana = w.ships.find((s) => s.kind === 'hunter' && s.home === at('Havana'))!;
  const far = map.nodes.find((n) => {
    const d = map.distTo(havana.home)[n.id];
    return d > HUNT_RANGE && d <= 2 * HUNT_RANGE && n.waters === null;
  })!;
  assert.equal(hunterGoal(map, havana, far.id, { spain: -1 }), havana.home);
  assert.equal(hunterGoal(map, havana, far.id, { spain: -1 }, true), far.id);
});

test('raid a nation at peace with England often enough, and it is war', () => {
  let w: WorldState = { ...quiet({ ...createWorld(sea, 1), player: at('La Rochelle') }), gold: 500 };
  assert.ok(!isEnemy(w.wars, 'france'));
  w = raid(sea, w);
  assert.equal(w.tension.france, 3);
  assert.ok(!isEnemy(w.wars, 'france'), 'not yet');
  w = raid(sea, { ...w, encounter: null });
  assert.ok(isEnemy(w.wars, 'france'), `${CASUS_BELLI} strain: war`);
  assert.match(w.log.at(-1)!.text, /England and France are at war: your attacks have seen to it/);
  assert.equal(w.tension.france, 0);
});

test('an enemy privateer attacks on sight; at peace, she only comes alongside', () => {
  const { w: atWarWorld, ship } = alongside((s) => s.kind === 'privateer' && s.nation === 'spain');
  assert.equal(atWarWorld.encounter?.shipId, ship.id);
  assert.equal(atWarWorld.encounter?.kind, 'privateer');
  // At peace she heads home rather than wait, so meet her where she is.
  const w = quiet(createWorld(sea, 1));
  const step = map.adj[w.player].find((n) => !map.nodes[n].port)!;
  const atPeace: WorldState = { ...w, wars: makePeace(w.wars, 'england', 'spain'), player: step, ships: [{ ...ship, node: step }], trail: [[]] };
  const met = meeting(sea, atPeace);
  assert.equal(met.encounter, null);
  assert.equal(met.hail?.shipId, ship.id);
});

test('a pirate’s havens deal with him whoever wants him, and he can retire there rich', () => {
  const pirate: WorldState = { ...quiet(createWorld(sea, 1)), pirate: true, standing: { england: -5, barbary: -4 }, gold: 40 };
  // Port Royal is English, and England would hang him — but it asks no questions.
  const royal = { ...pirate, player: at('Port Royal') };
  assert.ok(isHaven(sea, royal) && serves(sea, royal));
  assert.equal(serves(sea, { ...pirate, player: at('Bristol') }), false, 'any other English port shuts him out');
  // The Barbary coast, even when the corsairs want him.
  const algiers = { ...pirate, player: at('Algiers') };
  assert.ok(serves(sea, algiers));
  assert.throws(() => retire(sea, algiers), /not yet/);
  const rich = retire(sea, { ...algiers, gold: GOAL });
  assert.ok(rich.won);
  assert.equal(rich.ending, 'retired');
  // An honest captain has no haven, and nothing to retire from.
  const honest = { ...quiet(createWorld(sea, 1)), player: at('Algiers'), gold: GOAL };
  assert.equal(isHaven(sea, honest), false);
  assert.throws(() => retire(sea, honest), /haven/);
});
