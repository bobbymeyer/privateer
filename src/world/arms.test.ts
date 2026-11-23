/** The Queen's arms: set up once where nobody holds the land, fame and an answer to Spain at home. Run with `npm test`. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ARMS_COURT, ARMS_FAME, CLAIMABLE, armsHere, plantArms } from './arms.ts';
import { choose } from './dilemmas.ts';
import { HOME_LANDMARK } from './landmarks.ts';
import { raise } from './journey.ts';
import { courtRisk, fameFor } from './reckoning.ts';
import { lyingAt } from './testing.ts';
import { advance, createSea, createWorld, type WorldState } from './world.ts';

const sea = createSea();
const { map } = sea;
const fresh = (over: Partial<WorldState> = {}) => ({ ...createWorld(sea, 1, 'sloop'), ...over });

test('at San Julián the arms can be set up, once, for a day and a bundle of the spares', () => {
  const at = lyingAt(sea, fresh(), 'san-julian');
  assert.equal(armsHere(sea, at), 'san-julian');
  const w = plantArms(sea, at, advance);
  assert.deepEqual(w.arms, ['san-julian']);
  assert.equal(w.stores.spares, at.stores.spares - 1);
  assert.ok(w.turn > at.turn, 'a day passes');
  assert.ok(w.log.some((l) => /Queen’s arms/.test(l.text)));
  assert.equal(armsHere(sea, { ...w, dilemma: null, hail: null, encounter: null }), null);
  assert.throws(() => plantArms(sea, { ...w, dilemma: null, hail: null, encounter: null }, advance), /nowhere here/);
});

test('with no spares, a chest of truck makes the post; with neither, nothing', () => {
  const at = lyingAt(sea, fresh({ stores: { ...fresh().stores, spares: 0 }, truck: 2 }), 'nova-albion');
  assert.equal(plantArms(sea, at, advance).truck, 1);
  assert.throws(() => plantArms(sea, { ...at, truck: 0 }, advance), /nothing to make/);
});

test('only where nobody holds the land, and not at islands that were only a rumor', () => {
  assert.equal(armsHere(sea, lyingAt(sea, fresh(), 'canaries')), null);
  assert.equal(armsHere(sea, lyingAt(sea, fresh(), 'valparaiso')), null);
  const lie = { key: 'solomons', source: 'prisoner' as const, told: 'a prisoner', truth: false, followed: true };
  assert.equal(armsHere(sea, lyingAt(sea, fresh({ rumors: [lie] }), 'solomons')), null);
  assert.equal(armsHere(sea, lyingAt(sea, fresh({ rumors: [{ ...lie, truth: true }] }), 'solomons')), 'solomons');
  assert.ok(CLAIMABLE.includes('bermuda') && CLAIMABLE.includes('mauritius'));
});

test('at home, each place claimed answers Spain a little, and adds fame at court', () => {
  const base = fresh({ grievance: 600 });
  assert.equal(Math.round(100 * (courtRisk(base) - courtRisk({ ...base, arms: ['san-julian', 'nova-albion'] }))) / 100, Math.round(100 * 2 * ARMS_COURT) / 100);
  assert.equal(courtRisk({ ...base, grievance: 0, arms: ['san-julian'] }), 0, 'never below nothing');
  const homeward = (arms: string[]): WorldState => ({
    ...fresh({ gold: 200, arms }),
    player: map.landmarks[HOME_LANDMARK],
    voyage: { at: 'sierra-leone', bound: HOME_LANDMARK, visited: ['plymouth', 'san-julian', 'nova-albion', 'sierra-leone'] },
  });
  const at = raise(sea, homeward(['san-julian', 'nova-albion']));
  const court = choose(sea, at, 'court');
  assert.equal(court.verdict, 'court');
  assert.equal(court.fame, fameFor(court.gold) + 2 * ARMS_FAME);
});

test('a voyage saved before the arms comes forward with none set up', async () => {
  const { decode, encode } = await import('../save.ts');
  const { arms: _a, ...old } = fresh();
  const saved = decode(JSON.stringify({ ...JSON.parse(encode(1, old as WorldState)), version: 18 }))!;
  assert.deepEqual(saved.world.arms, []);
});
