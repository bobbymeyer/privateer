/** Building the deck from prizes, striking cards out, wages; and seeing a ship before you meet her. Run with `npm test`. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MIN_DECK, PRIZE_CARDS, START_OUTFIT, STRIKE_COST, WAGE_DAYS, cardsOf, deckSize, wagesOf } from '../outfit.ts';
import { act, legalActions } from '../rules.ts';
import { TARGETS } from '../setup.ts';
import { nextStep, sailToward } from './course.ts';
import { UNPAID, aDay } from './events.ts';
import { portNamed } from './map.ts';
import { PRIZE_OFFERS, attack, fight, meeting } from './meet.ts';
import { leavePrize, strikable, strikeCard, takePrize } from './port.ts';
import { inSight, lookout, read } from './scout.ts';
import { declare } from './wars.ts';
import { advance, createSea, createWorld, type WorldState } from './world.ts';

const sea = createSea();
const { map } = sea;
const at = (name: string) => portNamed(map, name);
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
    s = fight(sea, s, legalActions(f).reduce((a, b) => (score(b) < score(a) ? b : a)));
  }
  return s;
}

/** A Spanish merchant taken, out in the Pacific, at war with Spain. */
function takenMerchant(): WorldState {
  const w = createWorld(sea, 3);
  const merchant = w.ships.find((s) => s.kind === 'merchant' && s.nation === 'spain')!;
  const here = farOut();
  for (let seed = 0; seed < 20; seed++) {
    const s = meeting(sea, { ...w, rng: seed, player: here, wars: declare(w.wars, 'england', 'spain'), ships: [{ ...merchant, node: here }], trail: [[]] });
    const after = takeHer(attack(s));
    if (after.reckoning?.outcome === 'destroyed') return after;
  }
  throw new Error('no prize taken');
}

test('an outfit deals its prizes, and not what was struck', () => {
  const o = { ...START_OUTFIT, prizes: ['grapnels', 'grapnels', 'pikes'], struck: ['sweep', 'bear-away'] };
  const base = cardsOf(START_OUTFIT);
  const c = cardsOf(o);
  assert.equal(c.grapnels, 2);
  assert.equal(c.pikes, 1);
  assert.equal(c.sweep, base.sweep - 1);
  assert.equal(c['bear-away'], base['bear-away'] - 1);
  assert.equal(deckSize(o), deckSize(START_OUTFIT) + 3 - 2);
  // Strike the last copy and the card's gone, not at zero.
  assert.equal(cardsOf({ ...START_OUTFIT, struck: ['patch'] }).patch, undefined);
});

test('take a prize and her stores are offered: three of what she had, one to keep or none', () => {
  const w = takenMerchant();
  assert.ok(w.spoil);
  assert.equal(w.spoil.offers.length, PRIZE_OFFERS);
  for (const k of w.spoil.offers) assert.ok(PRIZE_CARDS.merchant!.includes(k));
  assert.equal(new Set(w.spoil.offers).size, PRIZE_OFFERS);
  assert.throws(() => advance(sea, w, w.player), /stores are waiting/);

  const key = w.spoil.offers[0];
  const kept = takePrize(w, key);
  assert.equal(kept.spoil, null);
  assert.deepEqual(kept.outfit.prizes, [key]);
  assert.equal(cardsOf(kept.outfit)[key], (cardsOf(w.outfit)[key] ?? 0) + 1);
  assert.throws(() => takePrize(kept, key), /nothing to take/);

  const left = leavePrize(w);
  assert.equal(left.spoil, null);
  assert.deepEqual(left.outfit, w.outfit);
});

test('a yard strikes a card for a price, but not below the least a deck can be', () => {
  const w = { ...createWorld(sea, 1), gold: 100 };
  assert.ok(strikable(sea, w, 'sweep'));
  const once = strikeCard(sea, w, 'sweep');
  assert.equal(once.gold, 100 - STRIKE_COST);
  assert.equal(cardsOf(once.outfit).sweep, cardsOf(w.outfit).sweep - 1);
  assert.throws(() => strikeCard(sea, w, 'double-shot'), /no double-shot/);

  let thin: WorldState = once;
  while (deckSize(thin.outfit) > MIN_DECK) thin = strikeCard(sea, thin, Object.keys(cardsOf(thin.outfit))[0]);
  assert.equal(deckSize(thin.outfit), MIN_DECK);
  assert.throws(() => strikeCard(sea, thin, Object.keys(cardsOf(thin.outfit))[0]), /nothing to spare/);
  assert.throws(() => strikeCard(sea, { ...w, player: farOut() }, 'sweep'), /in port/);
});

test('the hands of note are paid every so often; unpaid, the crew sour', () => {
  const crew = { ...START_OUTFIT, crew: ['gunner', 'pilot'] };
  const wages = wagesOf(crew);
  assert.equal(wages, 3);
  const w: WorldState = { ...createWorld(sea, 1), player: at('Plymouth'), outfit: crew, turn: WAGE_DAYS, lastSpoils: WAGE_DAYS, morale: 7 };
  const paid = aDay(sea, { ...w, gold: 50 });
  assert.equal(paid.gold, 50 - wages);
  assert.equal(paid.morale, 7);
  const broke = aDay(sea, { ...w, gold: 1 });
  assert.equal(broke.gold, 1);
  assert.equal(broke.morale, 7 - UNPAID);
  assert.ok(broke.log.some((l) => l.stop && l.text.startsWith('no money for the wages')));
  assert.equal(aDay(sea, { ...w, turn: WAGE_DAYS + 1, gold: 50 }).gold, 50, 'not every day');
});

test('a ship read before you meet her: her hull, her hold, how she fights', () => {
  const merchant = read('merchant');
  assert.equal(merchant.hull, TARGETS.merchant.hull);
  assert.ok(merchant.traits.includes("fast: she'll run"));
  assert.ok(merchant.traits.includes('a fair hold'));
  const town = read('town');
  assert.ok(town.traits.includes("she won't run"));
  assert.ok(town.traits.includes('help comes if it drags on'));
  const armada = read('armada');
  assert.ok(armada.traits.includes('heavily gunned'));
  assert.ok(armada.traits.includes('a light hold'));
  assert.ok(read('monster').traits.includes('nothing to take'));
  assert.ok(read('hunter').traits.includes('well gunned'));
  assert.ok(merchant.traits.includes('lightly armed'));
  assert.equal(read('hunter', { hull: 4 }).hull, TARGETS.hunter.hull + 4);
  assert.ok(read('corsair').traits.includes('a light hold'));
  assert.ok(read('corsair', { cargo: 12 }).traits.includes('a fair hold'), 'laden with captives, her hold is worth more');
});

test('the lookout sees farther than the water, and a hostile sail coming into view brings you to', () => {
  const w0 = createWorld(sea, 2);
  const armada = w0.ships.find((s) => s.kind === 'armada' && s.nation === 'spain')!;
  const from = farOut();
  const dest = map.nodes.find((n) => n.kind === 'ocean' && map.distTo(from)[n.id] === 12)!.id;
  const step = nextStep(sea, { ...w0, player: from }, dest)!;
  const range = lookout(w0);
  // Just out of sight from where you are, and just in sight from where you'll be.
  const x = map.nodes.find((n) => map.distTo(step)[n.id] === range && map.distTo(from)[n.id] > range)!.id;
  // An armada moves on even days only: on an odd day she holds where she is.
  const w: WorldState = { ...w0, turn: 1, player: from, wars: declare(w0.wars, 'england', 'spain'), ships: [{ ...armada, node: x }], trail: [[]] };
  assert.equal(inSight(sea, w).length, 0);
  const out = sailToward(sea, w, dest);
  assert.equal(out.halt, 'sail');
  const seen = inSight(sea, out.world);
  assert.equal(seen.length, 1);
  assert.ok(seen[0].hostile);
  assert.equal(seen[0].days, range);

  // A ship that means you no harm doesn't stop you.
  const friendly: WorldState = { ...w, wars: [], standing: {} };
  assert.equal(sailToward(sea, friendly, dest).halt, null);
});
