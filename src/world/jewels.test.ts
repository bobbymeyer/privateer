/** Jewels for the Queen, Brazil and its brazilwood, captives who talk, and the chronicler. Run with `npm test`. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { choices, choose } from './dilemmas.ts';
import { HOME_LANDMARK } from './landmarks.ts';
import { choices as legsFrom, raise } from './journey.ts';
import { COMMANDER_VALUE, JEWELS, TASTE, favourOf, plunderJewels, proofOfService, setAside } from './jewels.ts';
import { courtRisk, giftFor, giftGold, outlawed, PIRATE_INFAMY } from './reckoning.ts';
import { arriveBrazil } from './brazil.ts';
import { IBERIAN, freed, taken, talk } from './captives.ts';
import { mourn } from './hands.ts';
import { CHRONICLE_BASE, score } from './score.ts';
import { WOOD_WORTH, buySpice, buyWood, holdRoom, woodRoom } from './stores.ts';
import { decode, encode } from '../save.ts';
import { CHRONICLER_COST, createSea, createWorld, type WorldState } from './world.ts';
import { lyingAt } from './testing.ts';

const sea = createSea();
const { map } = sea;
const said = (w: WorldState, re: RegExp) => w.log.some((l) => re.test(l.text));
const base = (over: Partial<WorldState> = {}, ship = 'sloop', backer: WorldState['backer'] = 'own') => ({ ...createWorld(sea, 1, ship, backer), ...over });
/** Off Plymouth, bound home round the world. */
const homeward = (over: Partial<WorldState> = {}, backer: WorldState['backer'] = 'own'): WorldState => ({
  ...base({}, 'sloop', backer),
  player: map.landmarks[HOME_LANDMARK],
  voyage: { at: 'sierra-leone', bound: HOME_LANDMARK, visited: ['plymouth', 'canaries', 'ladrones', 'cape', 'sierra-leone'] },
  ...over,
});

// --- Jewels -------------------------------------------------------------------------

test('prizes give up jewels by where they come from: emeralds from the Spanish Main, diamonds from the East', () => {
  const kinds = (nation: 'spain' | 'portugal', east: boolean) => {
    const got = new Set<string>();
    for (let rng = 1; rng < 300; rng++) for (const j of plunderJewels(base(), 'treasure-ship', nation, east, { rng }).jewels) got.add(j.kind);
    return got;
  };
  assert.ok(kinds('spain', false).has('emerald'));
  assert.ok(!kinds('spain', false).has('diamond'));
  assert.ok(kinds('portugal', true).has('diamond'));
  assert.ok(kinds('spain', false).has('commander'), 'her captain falls, sometimes, and his ring is yours');
  const merchants = Array.from({ length: 200 }, (_, rng) => plunderJewels(base(), 'merchant', 'spain', false, { rng: rng + 1 }).jewels);
  assert.ok(merchants.some((j) => j.length) && merchants.some((j) => !j.length));
  assert.ok(merchants.every((js) => js.every((j) => j.kind !== 'commander')), 'a merchant’s master is no commander');
});

test('at the reckoning, jewels not set aside are sold; those set aside go to the Queen', () => {
  const ruby = { kind: 'ruby' as const, name: JEWELS.ruby.name, value: JEWELS.ruby.value };
  const w = raise(sea, homeward({ gold: 300, jewels: [ruby] }));
  const sold = choose(sea, w, 'low');
  assert.equal(sold.gold, w.gold + ruby.value);
  assert.ok(said(sold, /sold to a goldsmith/));
  const kept = choose(sea, setAside(w, 0, true), 'court');
  assert.equal(kept.gold, w.gold, 'given, not sold');
  assert.ok(said(kept, /presented to the Queen/));
});

test('jewels to her taste count for more, and make the gift cheaper and her pleasure fame', () => {
  const diamond = { kind: 'diamond' as const, name: JEWELS.diamond.name, value: JEWELS.diamond.value, forQueen: true };
  const ruby = { kind: 'ruby' as const, name: JEWELS.ruby.name, value: JEWELS.ruby.value, forQueen: true };
  assert.equal(favourOf(base({ jewels: [diamond] })), Math.round(JEWELS.diamond.value * TASTE));
  assert.equal(favourOf(base({ jewels: [ruby] })), JEWELS.ruby.value);
  const w = raise(sea, homeward({ gold: 400, jewels: [diamond] }));
  assert.equal(giftGold(w), Math.max(0, giftFor(w) - favourOf(w)));
  const given = choose(sea, w, 'gift');
  assert.ok(said(given, /so pleased/));
  const plain = choose(sea, raise(sea, homeward({ gold: 400 })), 'gift');
  assert.ok(given.fame > plain.fame);
  assert.ok(given.gold > plain.gold);
});

test('the dead commander’s ring is proof of service: court is safe, and a question forgotten', () => {
  const ring = { kind: 'commander' as const, name: 'the ring of Don Pedro de Arana', value: COMMANDER_VALUE, forQueen: true };
  const w = raise(sea, homeward({ gold: 500, grievance: 900, infamy: 2, jewels: [ring] }));
  assert.ok(proofOfService(w));
  assert.equal(courtRisk(w), 0);
  const out = choose(sea, w, 'court');
  assert.equal(out.verdict, 'court');
  assert.ok(out.infamy < 2);
  // With a name for piracy, the ring and a gift between them can save you.
  const black = raise(sea, homeward({ gold: 500, infamy: PIRATE_INFAMY + 1, jewels: [ring] }));
  assert.ok(outlawed(black));
  assert.notEqual(choose(sea, black, 'gift').verdict, 'pirate');
});

// --- Brazil -------------------------------------------------------------------------

test('the bay of Guanabara is a fork from Cape Verde, and rejoins at the Plate', () => {
  assert.ok(legsFrom({ at: 'cape-verde', bound: null, visited: ['plymouth', 'canaries', 'cape-verde'] }).includes('guanabara'));
  assert.ok(map.distTo(map.landmarks.guanabara)[map.landmarks['cape-verde']] < 200);
  assert.ok(map.distTo(map.landmarks.plate)[map.landmarks.guanabara] < 200);
});

test('brazilwood bought at Guanabara shares the hold with spice, and sells to the dyers at home', () => {
  let w = lyingAt(sea, base({ gold: 200 }), 'guanabara');
  for (let i = 0; i < 3; i++) w = buyWood(sea, w);
  assert.equal(w.wood, 3);
  assert.equal(woodRoom(w), holdRoom(w));
  assert.throws(() => buyWood(sea, lyingAt(sea, base(), 'canaries')), /no brazilwood/);
  // The spice room is what the brazilwood leaves.
  let t = lyingAt(sea, { ...w, gold: 500 }, 'ternate');
  for (let i = 0; i < holdRoom(w) - 3; i++) t = buySpice(sea, t);
  assert.throws(() => buySpice(sea, t), /no room/);
  const home = raise(sea, homeward({ wood: 4, gold: 100 }));
  assert.ok(said(home, /brazilwood sold to the dyers/));
  assert.equal(home.wood, 0);
  assert.ok(home.gold >= 100 + 4 * WOOD_WORTH - 1 || home.backer !== 'own');
});

test('a Portuguese settlement on the coast of Brazil: it may deal, or send word south', () => {
  let dealt = 0;
  let warned = 0;
  for (let rng = 1; rng < 80; rng++) {
    const w = arriveBrazil(lyingAt(sea, base({ rng, gold: 50, stores: { food: 100, water: 100, spares: 0, powder: 0 } }), 'brazil'), 'brazil');
    if (w.dilemma?.kind !== 'settlement') continue;
    assert.deepEqual(choices(w, w.dilemma).map((c) => c.key), ['treat', 'clear']);
    const out = choose(sea, w, 'treat');
    if (out.seen.includes('coast-alarm')) warned++;
    else if (out.stores.water > 100) dealt++;
    assert.ok(!arriveBrazil({ ...w, dilemma: null }, 'brazil').dilemma, 'once a voyage');
  }
  assert.ok(dealt > 0 && warned > 0, `dealt ${dealt}, warned ${warned}`);
});

test('the Normans at Guanabara sell brazilwood cheap, or tell you of the carrack from Goa', () => {
  let met = 0;
  for (let rng = 1; rng < 40; rng++) {
    const w = arriveBrazil(lyingAt(sea, base({ rng, gold: 60 }), 'guanabara'), 'guanabara');
    if (w.dilemma?.kind !== 'normans') continue;
    met++;
    const bought = choose(sea, w, 'buy');
    assert.ok(bought.wood > 0 && bought.gold < 60);
    const news = choose(sea, w, 'news');
    assert.equal(news.dilemma?.kind, 'rumor');
    assert.equal((news.dilemma as { key: string }).key, 'azores');
  }
  assert.ok(met > 0);
});

// --- Captives -----------------------------------------------------------------------

test('men left ashore on a Spanish coast are taken and talk: the treasure ship is warned', () => {
  let talked = 0;
  for (let rng = 1; rng < 40; rng++) {
    const w = talk(sea, lyingAt(sea, base({ rng }), 'valparaiso'), { rng });
    if (w.seen.includes('coast-alarm')) talked++;
  }
  assert.ok(talked > 10, `talked ${talked}`);
  // Past the treasure ship, it's Spain's grievance that grows instead.
  let grew = 0;
  for (let rng = 1; rng < 40; rng++) {
    const past = lyingAt(sea, base({ rng, voyage: { at: 'guatulco', bound: null, visited: ['plymouth', 'cacafuego', 'guatulco'] } }), 'guatulco');
    if (talk(sea, past, { rng }).grievance > 0) grew++;
  }
  assert.ok(grew > 0);
  // Through `mourn`: hands who desert at a Spanish town may talk.
  let viaMourn = 0;
  for (let rng = 1; rng < 60; rng++) {
    const before = lyingAt(sea, base({ rng }), 'callao');
    const after = { ...before, crew: before.crew - 3, log: [...before.log, { turn: 0, text: '3 hands slipped over the side in the night' }] };
    if (mourn(sea, before, after).seen.includes('coast-alarm')) viaMourn++;
  }
  assert.ok(viaMourn > 0);
  assert.ok(IBERIAN.includes('callao') && !IBERIAN.includes('san-julian'));
});

test('a ship lost on a Spanish coast: the gunner and the carpenter to the galleys, the rest hanged', () => {
  const lost = { ...lyingAt(sea, base(), 'callao'), sunk: true };
  const after = taken(sea, lost);
  const fate = Object.fromEntries(after.hands.map((h) => [h.role, h.fate ?? h.dead?.cause]));
  assert.equal(fate.gunner, 'galleys');
  assert.equal(fate.carpenter, 'galleys');
  assert.equal(fate.master, 'the hangman');
  assert.ok(said(after, /hanged at Lima/));
  const patagonia = taken(sea, { ...lyingAt(sea, base(), 'san-julian'), sunk: true });
  assert.ok(patagonia.hands.every((h) => !h.fate && !h.dead), 'nobody to take them in Patagonia');
});

test('an Englishman freed from a Spanish prize joins, and takes a dead man’s place', () => {
  const w = base({ hands: base().hands.map((h) => (h.role === 'gunner' ? { ...h, dead: { turn: 1, node: 0, place: 'at sea', cause: 'scurvy' } } : h)) });
  let joined = 0;
  for (let rng = 1; rng < 40; rng++) {
    const out = freed(w, 'callao', { rng });
    if (!out.freed) continue;
    joined++;
    assert.equal(out.world.crew, Math.min(w.crew + 1, 45));
    const gunners = out.world.hands.filter((h) => h.role === 'gunner' && !h.dead);
    assert.equal(gunners.length, 1);
    assert.ok(gunners[0].freed);
    assert.ok(said(out.world, /Oxenham/));
  }
  assert.ok(joined > 10, 'at Callao, often: the prison at Lima’s port');
});

// --- The chronicler -----------------------------------------------------------------

test('a chronicler costs a berth and his keep, and his account adds to the score if he comes home', () => {
  const plain = createWorld(sea, 3, 'sloop', 'own');
  const w = createWorld(sea, 3, 'sloop', 'own', true);
  assert.equal(w.gold, plain.gold - CHRONICLER_COST);
  assert.equal(w.crew, plain.crew + 1);
  assert.ok(w.hands.some((h) => h.role === 'chronicler'));
  const atHome = choose(sea, raise(sea, homeward({ gold: 300, hands: w.hands })), 'court');
  const s = score(atHome);
  assert.equal(s.chronicle, CHRONICLE_BASE + Math.round(atHome.fame / 2));
  const dead = w.hands.map((h) => (h.role === 'chronicler' ? { ...h, dead: { turn: 9, node: 0, place: 'at sea', cause: 'the flux' } } : h));
  assert.equal(score(choose(sea, raise(sea, homeward({ gold: 300, hands: dead })), 'court')).chronicle, 0);
  const pirate = choose(sea, raise(sea, homeward({ gold: 300, hands: w.hands, infamy: PIRATE_INFAMY + 2 })), 'court');
  assert.equal(pirate.verdict, 'pirate');
  assert.equal(score(pirate).chronicle, 0, 'forbidden printing');
});

test('his death is told, and the account dies with him', () => {
  const w = createWorld(sea, 3, 'sloop', 'own', true);
  let died = false;
  for (let rng = 1; rng < 200 && !died; rng++) {
    const before = { ...w, rng };
    const after = { ...before, crew: 2, log: [...before.log, { turn: 0, text: `${before.crew - 2} hands dead of scurvy` }] };
    const out = mourn(sea, before, after);
    if (out.hands.find((h) => h.role === 'chronicler')?.dead) {
      died = true;
      assert.ok(said(out, /account of the voyage dead with him/));
    }
  }
  assert.ok(died);
});

test('a save from before jewels and brazilwood comes forward', () => {
  const { jewels: _j, wood: _w, ...old } = createWorld(sea, 1);
  const saved = decode(JSON.stringify({ ...JSON.parse(encode(1, old as WorldState)), version: 16 }))!;
  assert.deepEqual(saved.world.jewels, []);
  assert.equal(saved.world.wood, 0);
});

test('lost in the open Pacific, nobody comes for her men; lost off Callao, they are taken', async () => {
  const { spanishCoast } = await import('./captives.ts');
  const sea2 = createSea();
  const w = createWorld(sea2, 1);
  const midPacific = sea2.map.nodes.filter((n) => !n.port && sea2.map.adj[n.id].length).sort((a, b) => Math.hypot(a.lon + 150, a.lat - 12) - Math.hypot(b.lon + 150, b.lat - 12))[0].id;
  assert.ok(!spanishCoast(sea2, { ...w, player: midPacific, voyage: { at: 'guatulco', bound: 'ladrones', visited: ['plymouth', 'guatulco'] } }));
  const offCallao = sea2.map.adj[sea2.map.landmarks.callao][0];
  assert.ok(spanishCoast(sea2, { ...w, player: offCallao, voyage: { at: 'callao', bound: 'cacafuego', visited: ['plymouth', 'callao'] } }));
});
