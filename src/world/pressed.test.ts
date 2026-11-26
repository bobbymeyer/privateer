/** Men who aren't your own: pressed from prizes, hired with a catch; false colours; Persian silk. Run with `npm test`. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { continueOn } from './course.ts';
import { choices, choose } from './dilemmas.ts';
import { raise, makeFor } from './journey.ts';
import { attack } from './meet.ts';
import {
  COME_ROUND, GUARDED, HIRE, PRESSABLE, canHire, hire, pilotWaters, piloted, press, pressable, pressedDay, rising, strangers, strangersArriving, thin,
} from './pressed.ts';
import { SILK_WORTH, disguise, disguiseHere, foundOut, silkRoom, takeSilk } from './disguise.ts';
import { complement, marketHere, provisionDay, WEAR_DAYS } from './stores.ts';
import { mourn } from './hands.ts';
import { decode, encode } from '../save.ts';
import { advance, createSea, createWorld, type WorldState } from './world.ts';
import { lyingAt, victualled } from './testing.ts';

const sea = createSea();
const { map } = sea;
const node = (lon: number, lat: number) =>
  map.nodes.filter((n) => !n.port && map.adj[n.id].length).sort((a, b) => Math.hypot(a.lon - lon, a.lat - lat) - Math.hypot(b.lon - lon, b.lat - lat))[0].id;
const fresh = (over: Partial<WorldState> = {}): WorldState => ({ ...victualled(createWorld(sea, 1, 'brigantine')), ...over });
const said = (w: WorldState, re: RegExp) => w.log.some((l) => re.test(l.text));

test('her people pressed: so many by what she was, never past the complement, nor more than a fifth of the hands can guard', () => {
  const s = fresh({ crew: 40, player: node(-30, 40) });
  assert.deepEqual(pressable(sea, s, 'merchant', 'spain', false), { men: PRESSABLE.merchant, pilot: false });
  assert.equal(pressable(sea, s, 'treasure-ship', 'spain', true)!.men, Math.min(5, Math.floor(40 * GUARDED)));
  assert.equal(pressable(sea, { ...s, crew: complement(s) }, 'merchant', 'spain', false), null, 'no room');
  assert.equal(pressable(sea, { ...s, crew: 10, pressed: 2 }, 'merchant', 'spain', false), null, 'none to guard more');
  const w = press(s, 2, false, 'spain');
  assert.equal(w.crew, 42);
  assert.equal(w.pressed, 2);
  assert.equal(strangers(w), '2 pressed');
});

test('a Portuguese prize off the Atlantic coast gives up her pilot, once; and he shortens the coast of Brazil', () => {
  const off = fresh({ player: node(-24, 15) });
  assert.ok(pilotWaters(sea, off));
  assert.equal(pressable(sea, off, 'merchant', 'portugal', false)!.pilot, true);
  assert.equal(pressable(sea, off, 'merchant', 'spain', false)!.pilot, false);
  assert.equal(pressable(sea, { ...off, player: node(120, 0) }, 'merchant', 'portugal', false)!.pilot, false, 'not in the East');
  const piloted1 = press(off, 0, true, 'portugal');
  assert.equal(pressable(sea, piloted1, 'merchant', 'portugal', false)!.pilot, false, 'once a voyage');
  // From Cape Verde to the coast of Brazil, with and without him.
  const at = lyingAt(sea, fresh({ calm: 0 }), 'cape-verde');
  const sail = (w: WorldState) => {
    w = makeFor(w, 'brazil');
    let days = 0;
    for (; days < 200 && w.voyage.at === 'cape-verde'; days++) {
      const out = continueOn(sea, { ...w, dilemma: null, hail: null, encounter: null, calm: 0 });
      w = { ...out.world, dilemma: null, hail: null, encounter: null };
    }
    return days;
  };
  const withHim = { ...at, seen: [...at.seen, 'pilot'] };
  assert.ok(piloted(makeFor(withHim, 'brazil')));
  assert.ok(sail(withHim) < sail(at), 'he knows the coast');
});

test('the press choice, then whatever else was waiting', () => {
  const s = fresh({ crew: 40, dilemma: { kind: 'press', men: 3, pilot: true, nation: 'portugal', then: { kind: 'leak' } } });
  assert.deepEqual(choices(s, s.dilemma!).map((c) => c.key), ['press', 'pilot', 'free']);
  const pressed = choose(sea, s, 'press');
  assert.equal(pressed.pressed, 3);
  assert.ok(pressed.seen.includes('pilot'));
  assert.equal(pressed.dilemma?.kind, 'leak');
  const free = choose(sea, s, 'free');
  assert.equal(free.pressed, 0);
  assert.equal(free.dilemma?.kind, 'leak');
});

test('pressed men slip away at a landmark, more where their own people are; and none of the hands of note go with them', () => {
  let home = 0;
  let away = 0;
  for (let rng = 1; rng < 60; rng++) {
    const s = fresh({ crew: 40, pressed: 10, rng });
    const a = strangersArriving({ ...s, voyage: { ...s.voyage, at: 'callao' } }, 'callao');
    const b = strangersArriving({ ...s, voyage: { ...s.voyage, at: 'ladrones' } }, 'ladrones');
    home += 10 - a.pressed;
    away += 10 - b.pressed;
    assert.equal(a.crew, 40 - (10 - a.pressed));
  }
  assert.ok(home > away, `${home} at Callao, ${away} at the Ladrones`);
  // Mourned: the hands of note stay aboard, and the count says they ran.
  const s = fresh({ crew: 40, pressed: 10 });
  const after = strangersArriving({ ...s, rng: 3, voyage: { ...s.voyage, at: 'callao' } }, 'callao');
  if (after.crew < 40) {
    const m = mourn(sea, s, after);
    assert.ok(m.hands.every((h) => !h.ran && !h.dead));
    assert.equal(m.losses.ran, 40 - after.crew);
    assert.equal(m.pressed, after.pressed, 'not thinned twice');
  }
});

test('fed full long enough, the pressed come round; short commons set them back; a prize’s share brings it on', () => {
  const s = fresh({ pressed: 4, pressedSince: 0, turn: COME_ROUND - 1 });
  assert.equal(pressedDay(s).pressed, 4);
  assert.equal(pressedDay({ ...s, turn: COME_ROUND }).pressed, 0);
  assert.ok(said(pressedDay({ ...s, turn: COME_ROUND }), /come round/));
  const short = pressedDay({ ...s, rations: 'short' });
  assert.equal(short.pressedSince, 1);
});

test('after a fight the pressed may turn, likelier against their own', () => {
  let turned = 0;
  let own = 0;
  for (let rng = 1; rng < 400; rng++) {
    const s = fresh({ crew: 40, pressed: 6, pressedFrom: ['spain'] });
    const a = rising(s, 'portugal', { rng });
    const b = rising(s, 'spain', { rng });
    if (a.crew < 40) {
      turned++;
      assert.equal(a.losses.ran, 40 - a.crew);
      assert.equal(a.pressed, 6 - (40 - a.crew));
    }
    if (b.crew < 40) own++;
  }
  assert.ok(turned > 0 && own > turned, `${turned} against strangers, ${own} against their own`);
});

test('hands lost to anything else: the pressed, the soldiers and the jail-hands among them in their share', () => {
  const before = fresh({ crew: 40, pressed: 8, soldiers: 4, jailed: 4 });
  const after = thin(before, { ...before, crew: 30 });
  assert.equal(after.pressed, 6);
  assert.equal(after.soldiers, 3);
  assert.equal(after.jailed, 3);
  const all = thin(before, { ...before, crew: 2 });
  assert.ok(all.pressed + all.soldiers + all.jailed <= 2);
});

test('soldiers bring a card to the fight, and sail like landsmen; jail-hands are cheap and run', () => {
  const home = lyingAt(sea, fresh({ crew: 40, gold: 100 }), 'plymouth');
  const r = { rng: 5 };
  const soldiered = hire(home, 'soldiers', r);
  assert.equal(soldiered.crew, 40 + HIRE.soldiers.lot);
  assert.equal(soldiered.soldiers, HIRE.soldiers.lot);
  assert.equal(soldiered.gold, 100 - HIRE.soldiers.cost);
  const w = attack({ ...soldiered, hail: { kind: 'merchant', nation: 'spain' } });
  assert.ok([...w.encounter!.fight.hand, ...w.encounter!.fight.deck].some((c) => c.name === 'soldiers over the side'));
  const plain = attack({ ...home, hail: { kind: 'merchant', nation: 'spain' } });
  assert.ok(![...plain.encounter!.fight.hand, ...plain.encounter!.fight.deck].some((c) => c.name === 'soldiers over the side'));
  // The wear comes sooner with landsmen at the sheets.
  const day = Math.round(WEAR_DAYS.steady * 0.75);
  const atSea = { ...soldiered, player: node(-30, 40), turn: day };
  assert.ok(provisionDay(sea, atSea, { rng: 1 }).hull < atSea.hull);
  assert.equal(provisionDay(sea, { ...atSea, soldiers: 0 }, { rng: 1 }).hull, atSea.hull);
  // Jail-hands: cheap, and they run.
  const jailed = hire(home, 'jail', r);
  assert.equal(jailed.gold, 100 - HIRE.jail.cost);
  let ran = 0;
  for (let rng = 1; rng < 40; rng++) ran += 5 - strangersArriving({ ...jailed, rng }, 'canaries').jailed;
  assert.ok(ran > 0);
  // Soldiers three months without a prize go off to find their own.
  let went = 0;
  for (let rng = 1; rng < 40; rng++) went += strangersArriving({ ...soldiered, rng, turn: 200, lastPrize: 0 }, 'canaries').soldiers < 5 ? 1 : 0;
  assert.ok(went > 0);
  assert.equal(strangersArriving({ ...soldiered, rng: 1, turn: 30, lastPrize: 0 }, 'canaries').soldiers, 5, 'not while there are prizes');
  // Not abroad.
  assert.ok(!canHire(lyingAt(sea, fresh({ gold: 100, crew: 40 }), 'ternate'), 'soldiers'));
});

test('the interpreter: friends sooner, a rumor surely, and one day he sells you', () => {
  const home = lyingAt(sea, fresh({ crew: 40, gold: 100 }), 'plymouth');
  const r = { rng: 9 };
  const w = hire(home, 'interpreter', r);
  assert.ok(w.hands.some((h) => h.role === 'interpreter'));
  assert.ok(!canHire(w, 'interpreter'), 'once');
  // A people the first time: smoothed.
  const before = w.peoples.tupinamba ?? 0;
  const met = strangersArriving({ ...w, rng: 2 }, 'brazil');
  if (met.hands.some((h) => h.role === 'interpreter' && !h.ran)) assert.equal(met.peoples.tupinamba, before + 1);
  let sold = 0;
  for (let rng = 1; rng < 300; rng++) {
    const a = strangersArriving({ ...w, rng }, 'canaries');
    if (a.hands.some((h) => h.role === 'interpreter' && h.ran)) {
      sold++;
      assert.ok(a.seen.includes('coast-alarm'), 'before the treasure ship, word goes up the coast');
      assert.ok(said(a, /sold with him/));
    }
  }
  assert.ok(sold > 0 && sold < 60, `${sold} of 300`);
});

test('under false colours: taken for a merchant, the chandler deals; found out, the port is shut', () => {
  const at = lyingAt(sea, fresh({ crew: 40, gold: 100 }), 'canaries');
  assert.ok(disguiseHere(sea, at));
  assert.equal(marketHere(sea, at), null);
  let dealt = 0;
  let shut = 0;
  for (let rng = 1; rng < 80; rng++) {
    const w = disguise(sea, { ...at, rng }, advance);
    if (w.seen.includes('disguised:canaries')) {
      dealt++;
      assert.equal(marketHere(sea, { ...w, player: at.player }), 'chandler');
    } else {
      shut++;
      assert.ok(w.seen.includes('shut:canaries'));
      assert.ok(w.encounter || w.grievance > at.grievance);
    }
    assert.ok(!disguiseHere(sea, { ...w, player: at.player, encounter: null }), 'once');
  }
  assert.ok(dealt > shut && shut > 0, `${dealt} dealt, ${shut} found out`);
  assert.ok(foundOut({ ...at, infamy: 3 }) > foundOut(at));
  assert.ok(!disguiseHere(sea, lyingAt(sea, fresh(), 'ternate')), 'not where they deal with you anyway');
  assert.ok(!disguiseHere(sea, { ...lyingAt(sea, fresh(), 'callao'), raided: ['callao'] }), 'not where you raided');
});

test('Persian silk from a Goa carrack, as far as the hold allows, sold dear at home', () => {
  const s = fresh({ spice: 0, wood: 0, silk: 0 });
  const w = takeSilk(s, { rng: 4 });
  assert.ok(w.silk >= 2 && w.silk <= 4);
  assert.equal(takeSilk({ ...s, spice: silkRoom(s) }, { rng: 4 }).silk, 0, 'no room');
  const home = raise(sea, { ...w, player: map.landmarks['plymouth-home'], voyage: { at: 'azores', bound: 'plymouth-home', visited: ['plymouth', 'azores'] } });
  assert.ok(said(home, /Persian silk sold/));
  assert.equal(home.silk, 0);
  assert.ok(SILK_WORTH > 20);
});

test('a save from before the pressed men comes forward', () => {
  const { silk: _a, pressed: _b, pressedSince: _c, pressedFrom: _d, soldiers: _e, jailed: _f, ...old } = createWorld(sea, 1);
  const saved = decode(JSON.stringify({ ...JSON.parse(encode(1, old as WorldState)), version: 22 }))!;
  assert.equal(saved.world.pressed, 0);
  assert.equal(saved.world.silk, 0);
  assert.deepEqual(saved.world.pressedFrom, []);
});
