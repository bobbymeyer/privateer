/** The practice fight at the Canaries: offered once, and nothing it costs counts. Run with `npm test`. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { legalActions } from '../rules.ts';
import { choices, choose } from './dilemmas.ts';
import { raise } from './journey.ts';
import { fight } from './meet.ts';
import { createSea, createWorld, type WorldState } from './world.ts';

const sea = createSea();
const { map } = sea;
/** Raising the Canaries from Plymouth. */
const arriving = (over: Partial<WorldState> = {}): WorldState =>
  raise(sea, { ...createWorld(sea, 1, 'sloop'), player: map.landmarks.canaries, voyage: { at: 'plymouth', bound: 'canaries', visited: ['plymouth'] }, ...over });

test('raise the Canaries the first time, and a fishing boat is there to practise on; not again', () => {
  const w = arriving();
  assert.equal(w.dilemma?.kind, 'practice');
  assert.deepEqual(choices(w, w.dilemma!).map((c) => c.key), ['practise', 'leave']);
  assert.ok(w.seen.includes('practice'));
  const again = arriving({ seen: ['practice'] });
  assert.notEqual(again.dilemma?.kind, 'practice');
  const left = choose(sea, w, 'leave');
  assert.equal(left.dilemma, null);
  assert.equal(left.encounter, null);
});

test('practice costs nothing: no powder, no hull, no hands, no gold, nothing in the tally', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const at = arriving({ rng: seed });
    if (at.dilemma?.kind !== 'practice') continue;
    let w = choose(sea, at, 'practise');
    assert.equal(w.encounter?.kind, 'fishing');
    assert.ok(w.encounter?.practice);
    assert.ok([...w.encounter!.fight.hand, ...w.encounter!.fight.deck].some((c) => c.side === 'ship' && c.effects.some((e) => e.kind === 'hit')), 'the guns are run out, powder or no');
    for (let i = 0; i < 200 && w.encounter; i++) w = fight(sea, w, legalActions(w.encounter.fight)[0]);
    assert.equal(w.encounter, null);
    assert.ok(!w.sunk);
    assert.equal(w.hull, at.hull);
    assert.equal(w.crew, at.crew);
    assert.equal(w.stores.powder, at.stores.powder);
    assert.equal(w.gold, at.gold);
    assert.deepEqual(w.tally, at.tally);
    assert.equal(w.grievance, at.grievance);
    assert.ok(w.log.some((l) => /practice/.test(l.text)));
  }
});

test('the fishing boat has no guns: none of her cards can hurt you', () => {
  const w = choose(sea, arriving(), 'practise');
  const hers = [...w.encounter!.fight.herDeck, ...(w.encounter!.fight.intent ? [w.encounter!.fight.intent] : [])];
  assert.ok(hers.length > 0);
  for (const c of hers) assert.ok(!c.effects.some((e) => e.kind === 'hurt' || e.kind === 'wound'), c.name);
});

test('no powder aboard, and the guns are still run out for practice', () => {
  const at = arriving();
  const w = choose(sea, { ...at, stores: { ...at.stores, powder: 0 } }, 'practise');
  assert.ok([...w.encounter!.fight.hand, ...w.encounter!.fight.deck].some((c) => c.side === 'ship' && c.effects.some((e) => e.kind === 'hit')));
  assert.ok(!w.log.some((l) => /no powder aboard/.test(l.text)));
});
