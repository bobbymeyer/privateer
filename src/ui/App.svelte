<script lang="ts">
  /**
   * One screen: the chart of the whole voyage, where you stand, the two
   * things you set (rations and pace), and one thing to do — continue on.
   * At a landmark, what it offers. Everything else is a dialog over it: the
   * ship you choose at the start, the way's events, a sail, a fight, the end.
   */
  import { onDestroy } from 'svelte';
  import { act, type Action, type EncounterState, type GameEvent } from '../rules.ts';
  import { SHIP_CLASSES, SHIPS, cardWords, deckSize } from '../outfit.ts';
  import { TARGETS } from '../setup.ts';
  import { continueOn } from '../world/course.ts';
  import { choices, choose, describe as describeDilemma } from '../world/dilemmas.ts';
  import { choices as legsFrom, daysTo, makeFor, onward } from '../world/journey.ts';
  import { HOME_LANDMARK, landmark } from '../world/landmarks.ts';
  import { attack, fight, hailExtra, letPass, raid, raidHere, type Reckoning } from '../world/meet.ts';
  import { adjective, article, type Nation } from '../world/ports.ts';
  import { read } from '../world/reading.ts';
  import { HAND_WORTH, LIKE_TITLES, score } from '../world/score.ts';
  import {
    CHANDLER, ISLANDERS_COST, SPICE_WORTH, TRUCK_AT, TRUCK_ROOM, barter, barterHere, BARTER_DAYS, shoreDays, takeHere, buySpice, spiceHere, spiceRoom, ISLANDERS_DAYS, SCURVY_DAYS, SHORE_DAYS, type Ware, ashore, startCrew, buy, capacity, complement, daysOf, landmarkHere, marketHere, price, room, scurvy, shoreHere, trade, WOOD_WORTH, buyWood, woodHere, woodRoom,
  } from '../world/stores.ts';
  import { PRIZES, followed } from '../world/rumors.ts';
  import { JEWELS, favourOf, setAside, toHerTaste } from '../world/jewels.ts';
  import { BACKERS, BACKER_KEYS, type Backer, courtRisk, grievanceWord, infamyFor, lawfulness, restitutionFor } from '../world/reckoning.ts';
  import { CHRONICLER_COST, advance, createSea, createWorld, dateOf, newLines, type Sea, type WorldState, waiting } from '../world/world.ts';
  import { ROLE, type Grave, called, gravesOf, placeOf, visitGraves } from '../world/hands.ts';
  import { FIX_WORDS, type Warning, warningKey, warnings } from '../world/warnings.ts';
  import { EPITAPH_LENGTH, loadGraves, saveGraves, withEpitaph, withGraves } from '../graves.ts';
  import { forget, load, store } from '../save.ts';
  import { PEOPLES, TAKEN_DAYS, peopleHere, standingWord, takeWhatYouNeed, remember } from '../world/peoples.ts';
  import { loadPeoples, savePeoples } from '../peoples.ts';
  import { shareText } from '../share.ts';
  import { type Entry, best, dailySeed, entryFor, isWin, loadLog, raised, saveLog, scoreOf, today, withEntry } from '../logbook.ts';
  import { ambient, bell, coin, gun, knell, pipe, setSound, soundOn, storm, toll } from './sound.ts';
  import { ARMS_DAYS, armsHere, armsPaidWith, plantArms } from '../world/arms.ts';
  import { allTaught, loadTaught } from '../lessons.ts';
  import Fight from './Fight.svelte';
  import RouteChart from './RouteChart.svelte';

  function seedFromUrl(): number | null {
    const raw = new URLSearchParams(location.search).get('seed');
    const n = raw === null ? NaN : Number(raw);
    return Number.isInteger(n) ? n : null;
  }

  // A run in progress is picked up where it was left, unless the address asks for a different seed.
  const asked = seedFromUrl();
  const saved = load();
  const resuming = saved && (asked === null || asked === saved.seed) ? saved : null;

  // Building the chart takes a moment; let the page paint first.
  let sea: Sea | null = $state.raw(null);
  let seed = $state(resuming?.seed ?? asked ?? Math.floor(Math.random() * 2 ** 31));
  /** The date, if this run is that day's voyage. */
  let daily: string | null = $state(resuming?.daily ?? (asked !== null && asked === dailySeed(today()) ? today() : null));
  let world: WorldState | null = $state.raw(null);
  /** Choosing a ship, then whose money: a new run waits on both. */
  let choosing = $state(!resuming);
  let chosenShip: string | null = $state(null);
  /** A chronicler aboard: chosen with your backer, at Plymouth. */
  let takeChronicler = $state(false);
  setTimeout(() => {
    sea = createSea();
    if (resuming) world = resuming.world;
  }, 30);

  function begin(ship: string, backer: Backer) {
    if (!sea) return;
    world = createWorld(sea, seed, ship, backer, takeChronicler, loadPeoples());
    buried = [];
    sailAnywayOn = '';
    choosing = false;
    chosenShip = null;
    logged = false;
    said = '';
    shown = null;
  }

  function newRun(day: string | null = null) {
    stop();
    daily = day;
    seed = day ? dailySeed(day) : Math.floor(Math.random() * 2 ** 31);
    world = null;
    choosing = true;
    chosenShip = null;
    logOpen = false;
    intro = false;
  }
  function abandon() {
    if (world && !world.sunk && !world.won && world.turn > 0) {
      if (!confirm('give up this voyage and start another?')) return;
      logRun(world);
    }
    newRun();
  }
  /** Today's voyage, from the header: a voyage in progress is given up first, and logged. */
  function todaysVoyage() {
    if (world && world.turn > 0 && !world.sunk && !world.won) {
      if (!confirm("give up this voyage and sail today's?")) return;
      logRun(world);
    }
    newRun(today());
  }

  $effect(() => {
    const url = new URL(location.href);
    url.searchParams.set('seed', String(seed));
    history.replaceState(null, '', url);
  });

  // How to play, from the header.
  let intro = $state(false);

  // --- The logbook -------------------------------------------------------------

  let logOpen = $state(false);
  let log: Entry[] = $state(loadLog());
  let logged = false;
  function logRun(w: WorldState) {
    log = withEntry(log, entryFor(w, seed, daily, new Date()));
    saveLog(log);
    // What this voyage left behind on the coasts it met, for the next English ship.
    savePeoples(remember(loadPeoples(), w));
    // The dead of this voyage, where they lie: a later voyage passing finds them.
    if (sea) {
      buried = gravesOf(w, seed, dateOf, SHIP_CLASSES[w.ship].name, placeOf(sea, w));
      graves = withGraves(graves, buried);
      saveGraves(graves);
    }
  }

  // --- Graves --------------------------------------------------------------------

  /** Every grave from voyages before, kept in the browser; and this voyage's, once it ends. */
  let graves: Grave[] = $state(loadGraves());
  let buried: Grave[] = $state([]);
  function epitaph(id: string, text: string) {
    graves = withEpitaph(graves, id, text);
    buried = withEpitaph(buried, id, text);
    saveGraves(graves);
  }
  function downloadLog() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(log, null, 2)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'privateer-logbook.json' });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const likeOf = (e: Entry) => (e.like && e.like in LIKE_TITLES ? LIKE_TITLES[e.like] : null);

  // Saved after every change; a finished run is written in the logbook and forgotten.
  $effect(() => {
    if (!world) return;
    if (world.sunk || world.won) {
      forget();
      if (!logged) {
        logged = true;
        logRun(world);
      }
    } else store(seed, world, daily);
  });

  // --- Sound -------------------------------------------------------------------

  let sound = $state(soundOn());
  function toggleSound() {
    sound = !sound;
    setSound(sound);
  }
  function wake() {
    if (sound) ambient(true);
  }
  let lastDilemma: string | null = null;
  $effect(() => {
    const k = world?.dilemma?.kind ?? null;
    // A storm roars; the reckoning at home rings three bells; anything else that asks, the boatswain's pipe.
    if (k && k !== lastDilemma) {
      if (k === 'storm') storm();
      else if (k === 'reckoning') bell(3);
      else pipe();
    }
    lastDilemma = k;
  });
  // A hand of note dead: one slow stroke.
  let lastDead = -1;
  $effect(() => {
    const dead = world ? world.hands.filter((h) => h.dead).length : 0;
    // Not on loading a voyage with its dead already counted: only as it happens.
    if (lastDead >= 0 && dead > lastDead && world && !world.sunk) toll();
    lastDead = dead;
  });

  // --- Continuing on -----------------------------------------------------------

  let sailing = $state(false);
  /** Why she stopped, or what came of the last thing you did. */
  let said = $state('');
  let timer: ReturnType<typeof setInterval> | null = null;

  function attempt(f: () => WorldState) {
    try {
      world = f();
      said = '';
    } catch (e) {
      said = (e as Error).message;
    }
  }

  /** The master's warning, asked once a departure: the key of the one you've said to sail anyway on. */
  let sailAnywayOn = $state('');
  let warning: Warning[] = $state.raw([]);
  function go() {
    if (!sea || !world || waiting(world) || world.sunk || world.won) return;
    const w = here && !sailing ? warnings(sea, world) : [];
    if (w.length && sailAnywayOn !== warningKey(world, w)) {
      warning = w;
      return;
    }
    if (timer) clearInterval(timer);
    sailing = true;
    said = '';
    timer = setInterval(day, 110);
  }
  function stop(why = '') {
    sailing = false;
    if (timer) clearInterval(timer);
    timer = null;
    said = why;
    if (why && world && !world.sunk && !world.won) bell(2);
  }
  function sailAnyway() {
    if (!world) return;
    sailAnywayOn = warningKey(world, warning);
    warning = [];
    go();
  }
  function day() {
    if (!sea || !world) return stop();
    try {
      const before = world;
      const out = continueOn(sea, world);
      // Graves from voyages before, found as she passes them.
      world = out.world.sunk || out.world.won ? out.world : visitGraves(sea, out.world, graves);
      if (!out.halt) return;
      const news = newLines(before, world).filter((l) => l.stop).at(-1)?.text ?? '';
      stop(out.halt === 'won' || out.halt === 'sunk' ? '' : news);
    } catch (e) {
      stop((e as Error).message);
    }
  }
  onDestroy(() => stop());

  function onkey(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Escape') {
      logOpen = false;
      intro = false;
      return;
    }
    if (e.key !== ' ' || !world || choosing || intro || logOpen || shown || waiting(world) || world.sunk || world.won) return;
    e.preventDefault();
    if (sailing) stop('hove to');
    else if (canContinue) go();
  }

  function setFor(key: string) {
    attempt(() => makeFor(world!, key));
    if (!said) go();
  }

  // --- Fighting ----------------------------------------------------------------

  /** The fight as it stands, kept a moment after the world settles it, to show how it ended. */
  let shown: EncounterState | null = $state.raw(null);
  let lastRound: GameEvent[] = $state.raw([]);
  let reckoning: Reckoning | null = $state.raw(null);
  let title = $state('');
  let nation: Nation = $state('spain');
  let isRaid = $state(false);
  /** The practice fight, and whether this fight teaches: practice always does, and a real one until the hints have all been read. */
  let practising = $state(false);
  let teaching = $state(false);

  $effect(() => {
    if (world?.encounter && !shown) {
      const m = world.encounter;
      shown = m.fight;
      practising = !!m.practice;
      teaching = practising || !allTaught(loadTaught());
      isRaid = m.raid !== null;
      nation = m.nation;
      const flag = adjective(m.nation);
      title = m.raid ? `the raid on ${landmark(m.raid).name}` : m.plate ? 'the treasure ship from Callao' : m.prize ? PRIZES[m.prize].name : `${article(flag)} ${flag} ${m.kind === 'treasure-ship' ? 'carrack' : TARGETS[m.kind].name}`;
      lastRound = [];
      reckoning = null;
      stop();
    }
  });

  function onact(a: Action) {
    if (!sea || !world?.encounter || !shown) return;
    const before = shown.events.length;
    const next = act(shown, a);
    lastRound = next.events.slice(before).filter((e) => e.type === 'played' || e.type === 'effect' || e.type === 'rejected' || e.type === 'range' || e.type === 'chain');
    world = fight(sea, world, a);
    shown = next;
    if (next.outcome) reckoning = world.reckoning;
    let i = 0;
    for (const e of lastRound) {
      if (e.type !== 'effect' || !e.applied) continue;
      if (e.effect.kind === 'hit') gun(1 + e.applied / 4, 0.18 * i++);
      else if (e.effect.kind === 'hurt' || (e.effect.kind === 'breach' && e.card.side === 'ship')) gun(0.6 + e.applied / 6, 0.18 * i++);
    }
    if (next.outcome === 'destroyed' && next.payout > 0) coin();
    if (next.outcome === 'sunk') knell();
  }
  function oncontinue() {
    shown = null;
    reckoning = null;
  }

  // --- Where you stand ---------------------------------------------------------

  /** The voyage as it stands, typed as it may be: the compiler can't see the setTimeout that fills it. */
  const now = (): WorldState | null => world;
  const here = $derived(sea && now() ? landmarkHere(sea, now()!) : null);
  const shore = $derived(sea && now() ? shoreHere(sea, now()!) : []);
  /** A place nobody holds, where the Queen's arms could be set up. */
  const claim = $derived(sea && now() ? armsHere(sea, now()!) : null);
  const market = $derived(sea && now() ? marketHere(sea, now()!) : null);
  const town = $derived(sea && now() ? raidHere(sea, now()!) : null);
  const spice = $derived(sea && now() ? spiceHere(sea, now()!) : null);
  const wood = $derived(sea && now() ? woodHere(sea, now()!) : null);
  /** At a fork with nothing chosen: the way divides, and you choose. */
  const atFork = $derived.by(() => {
    const w = now();
    return !!w && !w.voyage.bound && !onward(w.voyage, followed(w));
  });
  const canContinue = $derived.by(() => {
    const w = now();
    return !!w && !atFork && !waiting(w) && !w.sunk && !w.won;
  });
  /** Where you're making for: chosen, or the next where the way is one. */
  const making = $derived.by(() => {
    const w = now();
    return w ? (w.voyage.bound ?? onward(w.voyage, followed(w))) : null;
  });
  const days = $derived(now() ? daysOf(now()!) : { food: 0, water: 0 });
  const RATIONS: [WorldState['rations'], string][] = [['full', 'full'], ['short', 'short'], ['starving', 'starvation']];
  const PACES: [WorldState['pace'], string][] = [['easy', 'easy'], ['steady', 'steady'], ['hard', 'crack on']];
  const WARES: Ware[] = ['food', 'water', 'hands', 'spares', 'powder'];
  /** What the chandler here sells: truck only at Plymouth, where it's English goods. */
  const waresHere = (w: WorldState): Ware[] => (w.voyage.at === TRUCK_AT ? [...WARES, 'truck'] : WARES);
  /** The people of the coast you're lying at, and where they stand. */
  const people = $derived(sea && now() && here ? peopleHere(now()!) : null);
  const canBarter = $derived(sea && now() ? barterHere(sea, now()!) : false);
  const canTake = $derived(sea && now() ? takeHere(sea, now()!) : false);

  // --- Sharing -----------------------------------------------------------------------

  /** The voyage in a few lines, copied to the clipboard; or shown to select, where the clipboard won't take it. */
  let copied = $state('');
  let shareShown = $state('');
  async function copyLog() {
    if (!world) return;
    const text = shareText(world, seed, daily);
    try {
      await navigator.clipboard.writeText(text);
      copied = 'copied';
      shareShown = '';
    } catch {
      copied = '';
      shareShown = text;
    }
  }

  // --- A phone -----------------------------------------------------------------------

  /** A narrow screen: the status folded, and continue on kept at the bottom. */
  let phone = $state(false);
  if (typeof window !== 'undefined' && window.matchMedia) {
    const mq = window.matchMedia('(max-width: 600px)');
    phone = mq.matches;
    mq.addEventListener?.('change', (e) => (phone = e.matches));
  }
  /** The last things that happened, newest first. */
  const recent = $derived(now()?.log.slice(-6).reverse() ?? []);
  /** What won't last the leg ahead, said beside the casks and the chandler while you can still put it right. */
  const short = $derived(sea && now() && here ? warnings(sea, now()!) : []);
  const pct = (v: number, m: number) => `${Math.max(0, Math.min(100, (v / Math.max(1, m)) * 100))}%`;
</script>

<svelte:window onkeydown={onkey} onpointerdown={wake} />

{#if !sea}
  <main><p class="faint">charting the seas…</p></main>
{:else}
  <main>
    {#snippet gauges(w: WorldState)}
        <div class="gauges">
          <div class:low={w.crew < complement(w) / 2}><span class="label">hands</span><span class="bar"><span style="width: {pct(w.crew, complement(w))}"></span></span>{w.crew} of {complement(w)}</div>
          <div class:low={days.food <= 10}><span class="label">food</span><span class="bar"><span style="width: {pct(w.stores.food, capacity(w).food)}"></span></span>{days.food} days</div>
          <div class:low={days.water <= 10}><span class="label">water</span><span class="bar"><span style="width: {pct(w.stores.water, capacity(w).water)}"></span></span>{days.water} days</div>
          <div class:low={scurvy(w) !== 'none'}><span class="label">fresh food</span>{w.fresh} days ago{scurvy(w) === 'killing' ? ': the scurvy is killing' : scurvy(w) === 'coming' ? `: scurvy at ${SCURVY_DAYS}` : ''}</div>
          <div class:low={w.hull <= w.maxHull / 3}><span class="label">hull</span><span class="bar"><span style="width: {pct(w.hull, w.maxHull)}"></span></span>{w.hull} of {w.maxHull}</div>
          <div class:low={w.stores.spares === 0}><span class="label">spares</span>{w.stores.spares}</div>
          <div class:low={w.stores.powder === 0}><span class="label">powder</span>{w.stores.powder}</div>
          <div><span class="label">gold</span>{w.gold}</div>
          {#if w.spice}<div><span class="label">spice</span>{w.spice} {w.spice === 1 ? 'ton' : 'tons'}, {w.spice * SPICE_WORTH} at home</div>{/if}
          {#if w.wood}<div><span class="label">brazilwood</span>{w.wood} {w.wood === 1 ? 'ton' : 'tons'}, {w.wood * WOOD_WORTH} at home</div>{/if}
          {#if w.jewels.length}<div title={w.jewels.map((j) => j.name).join('; ')}><span class="label">jewels</span>{w.jewels.length}, {w.jewels.reduce((t, j) => t + j.value, 0)} to a goldsmith</div>{/if}
          <div><span class="label">backed by</span>{BACKERS[w.backer].name}</div>
          <div class:low={w.infamy > 0}><span class="label">your name</span>{lawfulness(w)}</div>
          <div><span class="label">Spain's grievance</span>{grievanceWord(w)}</div>
          {#if w.truck}<div><span class="label">truck</span>{w.truck} {w.truck === 1 ? 'chest' : 'chests'}</div>{/if}
          {#if w.french}<div><span class="label">commission</span>a French one too</div>{/if}
          {#if w.company > w.turn}<div><span class="label">in company</span>the Rochellers, {w.company - w.turn} days</div>{/if}
        </div>
    {/snippet}
    <header>
      <h1>privateer</h1>
      <p class="faint">{world ? `${dateOf(world.turn)} · a ${SHIP_CLASSES[world.ship].name}` : 'Plymouth, 1580'}{daily ? ` · today's voyage, ${daily}` : ''}</p>
      <div class="row">
        <button onclick={() => (intro = true)}>how to play</button>
        <button onclick={() => (logOpen = true)}>logbook</button>
        <button onclick={toggleSound} aria-pressed={sound}>sound {sound ? 'on' : 'off'}</button>
        <button onclick={todaysVoyage}>today's voyage</button>
        <button onclick={abandon}>a new run</button>
      </div>
    </header>

    {#if world}
      <RouteChart {sea} {world} {graves} />

      <!-- Where you stand: the next landmark, and what you've got to get there on. -->
      <section class="status" aria-label="the ship">
        <p class="bound">
          {#if here}<strong>{here.name}</strong>{:else}at sea{/if}
          {#if making && making !== world.voyage.at} · bound for {making === HOME_LANDMARK ? 'home' : landmark(making).name}, {daysTo(sea, world, making)} days{/if}
        </p>
        {#if phone}
          <details class="fold">
            <summary>
              <span class:low={world.crew < complement(world) / 2}>{world.crew} hands</span> ·
              <span class:low={days.food <= 10}>food {days.food}d</span> ·
              <span class:low={days.water <= 10}>water {days.water}d</span> ·
              <span class:low={world.hull <= world.maxHull / 3}>hull {world.hull}/{world.maxHull}</span>
              <span class="faint"> · more</span>
            </summary>
            {@render gauges(world)}
          </details>
        {:else}
          {@render gauges(world)}
        {/if}
        <details class="of-note">
          <summary>hands of note: {world.hands.filter((h) => !h.dead && !h.ran && !h.fate).length} of {world.hands.length} aboard</summary>
          <ul class="plain">
            {#each world.hands as h (h.name)}
              <li class:gone={h.dead || h.ran || h.fate}>
                <strong>{h.name}</strong>, {ROLE[h.role].title}{h.freed ? ', freed from the Spaniards' : ''}{h.dead ? `: dead of ${h.dead.cause}, ${h.dead.place}, ${dateOf(h.dead.turn)}` : h.ran ? ': ran' : h.fate ? ': sent to the galleys' : ''}
                {#if !h.dead && !h.ran && !h.fate}<span class="faint">{ROLE[h.role].does}.</span>{/if}
              </li>
            {/each}
          </ul>
        </details>
        <div class="settings">
          <div class="row" role="group" aria-label="rations">
            <span class="faint">rations</span>
            {#each RATIONS as [k, name] (k)}<button aria-pressed={world.rations === k} onclick={() => (world = { ...world!, rations: k })}>{name}</button>{/each}
          </div>
          <div class="row" role="group" aria-label="pace">
            <span class="faint">pace</span>
            {#each PACES as [k, name] (k)}<button aria-pressed={world.pace === k} onclick={() => (world = { ...world!, pace: k })}>{name}</button>{/each}
          </div>
        </div>
      </section>

      <!-- What to do: continue on; at a landmark, what it offers first. -->
      <section class="act">
        {#if said && said !== recent[0]?.text}<p class="said">{said}</p>{/if}
        {#if here}
          <p class="landmark">{here.text}</p>
          {#if people}
            {@const word = standingWord(world, people)}
            <p class:warn={word === 'hostile'} class:faint={word !== 'hostile'}>{PEOPLES[people].name}: {word}{word === 'friendly' ? ', and their guides make the work ashore a day quicker' : word === 'hostile' ? ': no trade, and arrows from the trees at the work ashore' : ': deal fairly and they may come round; there may be arrows at the work ashore'}.</p>
          {/if}
          {#each short as w (w.kind)}<p class="warn">{w.text}{w.fix ? ` ${FIX_WORDS[w.fix]}.` : ''}</p>{/each}
          {#if shore.length}
            <div class="row">
              {#each shore as work (work)}
                <button disabled={sailing} onclick={() => attempt(() => ashore(sea!, world!, work, advance))}>
                  {work === 'water' ? 'fill the casks' : work === 'forage' ? 'forage and fish' : 'careen her'} ({shoreDays(world, work)} {shoreDays(world, work) === 1 ? 'day' : 'days'})
                </button>
              {/each}
            </div>
          {/if}
          {#if claim}
            {@const paid = armsPaidWith(world)}
            <p class="faint">nobody holds this land: set up a post with a brass plate bearing the Queen’s arms, and claim it for her, as Drake did at Nova Albion. fame at home, and an answer to Spain.</p>
            <div class="row"><button disabled={sailing || !paid} onclick={() => attempt(() => plantArms(sea!, world!, advance))}>set up the Queen’s arms ({ARMS_DAYS} day, {paid === 'truck' ? 'a chest of truck' : 'a bundle of the spares'}){paid ? '' : ': nothing to make the post of'}</button></div>
          {/if}
          {#if market === 'chandler'}
            <p class="faint">the chandler{world.voyage.at === 'plymouth' ? '' : ', half as dear again as Plymouth'}. food bought here is fresh.</p>
            <div class="row">
              {#each waresHere(world) as ware (ware)}
                <button disabled={sailing || world.gold < price(world, ware) || !room(world, ware)} onclick={() => attempt(() => buy(sea!, world!, ware))}>
                  {ware === 'hands' ? `${CHANDLER[ware].lot} hands` : ware === 'truck' ? `a chest of truck: knives, beads and cloth (${world.truck} of ${TRUCK_ROOM})` : `${CHANDLER[ware].lot} ${CHANDLER[ware].unit} of ${CHANDLER[ware].name}`} ({price(world, ware)})
                </button>
              {/each}
            </div>
          {:else if market === 'islanders'}
            <div class="row">
              <button disabled={sailing || world.gold < ISLANDERS_COST} onclick={() => attempt(() => trade(sea!, world!))}>trade with the islanders ({ISLANDERS_COST}): the casks filled, {ISLANDERS_DAYS} days of fresh food</button>
              {#if world.truck}<button disabled={sailing} onclick={() => attempt(() => trade(sea!, world!, 'truck'))}>pay in truck: a chest</button>{/if}
            </div>
          {/if}
          {#if canBarter || canTake}
            <div class="row">
              {#if canBarter}<button disabled={sailing || world.truck < 1} onclick={() => attempt(() => barter(sea!, world!))}>a chest of truck for fresh food and water: {BARTER_DAYS} days{world.truck < 1 ? ' (no truck aboard)' : ''}</button>{/if}
              {#if canTake}<button disabled={sailing} onclick={() => attempt(() => takeWhatYouNeed(world!))}>take what you need: {TAKEN_DAYS} days, by force</button>{/if}
            </div>
            {#if canTake && people}<p class="faint">taken by force, {PEOPLES[people].name} turn against you, and remember it.</p>{/if}
          {/if}
          {#if spice}
            <p class="faint">{spice.name}, by the ton, sold on the quay at Plymouth for {SPICE_WORTH}. room for {spiceRoom(world)} tons.</p>
            <div class="row"><button disabled={sailing || world.gold < spice.cost || world.spice >= spiceRoom(world)} onclick={() => attempt(() => buySpice(sea!, world!))}>a ton of {spice.name} ({spice.cost}), {world.spice} aboard</button></div>
          {/if}
          {#if wood}
            <p class="faint">brazilwood, cut by the Tupinambá for trade goods, for the red dye: sold at home for {WOOD_WORTH} a ton. room for {woodRoom(world) - world.wood} more, beside the spice.</p>
            <div class="row"><button disabled={sailing || world.gold < wood.cost || world.wood >= woodRoom(world)} onclick={() => attempt(() => buyWood(sea!, world!))}>a ton of brazilwood ({wood.cost}), {world.wood} aboard</button></div>
          {/if}
          {#if town}
            <div class="row"><button disabled={sailing} onclick={() => attempt(() => raid(sea!, world!))}>raid {here.name}, once</button></div>
            <p class="faint">{town.kind === 'fortress' ? 'walled, and its guns are heavy.' : 'an open town: a battery or two, the walls, and the townsfolk.'} {['valparaiso', 'callao'].includes(town.key) && !world.voyage.visited.includes('cacafuego') ? 'word of a raid here would go north ahead of you.' : ''}</p>
          {/if}
        {/if}
        <div class="row primary" class:dock={phone}>
          {#if phone && making && making !== world.voyage.at && !atFork}<span class="faint docked">{making === HOME_LANDMARK ? 'home' : landmark(making).name}, {daysTo(sea, world, making)} days</span>{/if}
          {#if world.voyage.at === HOME_LANDMARK}
            <!-- Home: nothing to sail for; the reckoning and the end screen say the rest. -->
          {:else if atFork}
            <span class="faint">the way divides:</span>
            {#each legsFrom(world.voyage, followed(world)) as k (k)}
              <button onclick={() => setFor(k)}>{k === HOME_LANDMARK ? 'turn for home' : landmark(k).name}{landmark(k).detour ? ' (rumored)' : ''}, {daysTo(sea, world, k)} days</button>
            {/each}
          {:else if sailing}
            <button onclick={() => stop('hove to')}>heave to</button>
          {:else}
            <button class="go" onclick={go} disabled={!canContinue}>continue on</button>
            {#if world.voyage.at !== 'plymouth' && world.voyage.bound !== HOME_LANDMARK && !landmark(world.voyage.at).next.includes(HOME_LANDMARK)}
              <button onclick={() => setFor(HOME_LANDMARK)} disabled={!canContinue}>turn for home, {daysTo(sea, world, HOME_LANDMARK)} days</button>
            {/if}
          {/if}
        </div>
        {#if atFork && world.voyage.at !== HOME_LANDMARK}
          <ul class="plain legs">
            {#each legsFrom(world.voyage, followed(world)).filter((k) => k !== HOME_LANDMARK) as k (k)}<li><em>{landmark(k).name}{landmark(k).detour ? ', by rumor' : ''}.</em> <span class="faint">{landmark(k).text}</span></li>{/each}
          </ul>
        {/if}
        {#if followed(world).length}
          <p class="faint">you've heard of: {followed(world).map((k) => `${landmark(k).name}, from ${landmark(k).detour!.from.map((f) => landmark(f).name).join(' or ')}`).join('; ')}.</p>
        {/if}
        <ul class="plain log">
          {#each recent as l, i (i)}<li class:faint={i > 0}>{dateOf(l.turn)}: {l.text}</li>{/each}
        </ul>
        <p class="faint keys">space continues on, or heaves to</p>
      </section>
    {/if}

    {#if choosing}
      <div class="overlay">
        <div class="sheet intro">
          <h2>Plymouth, 1580</h2>
          <p>Drake is home with a hold full of Spanish silver, and everyone with a ship thinks the same thing: I could do that too. Sail round the world his way, or turn back when you must, take what Spain leaves lying about, and come home to Plymouth. The gold you bring home, the hands alive and the ship are your score.</p>
          {#if !chosenShip}
            <h3>choose your ship</h3>
            <ul class="plain ships">
              {#each SHIPS as k (k)}
                {@const c = SHIP_CLASSES[k]}
                <li>
                  <button onclick={() => (chosenShip = k)}>a {c.name}</button>
                  <span>{c.text}.</span>
                  <span class="faint">{c.purse} gold · hull {c.hull} · {startCrew(k)} of {c.complement} hands · {deckSize(k)} cards{Object.keys(c.cards).length ? `, with ${cardWords(c.cards)}` : ''} · the score ×{c.multiplier}</span>
                </li>
              {/each}
            </ul>
          {:else}
            {@const c = SHIP_CLASSES[chosenShip]}
            <h3>a {c.name}: whose money do you sail on?</h3>
            <ul class="plain ships">
              {#each BACKER_KEYS as b (b)}
                {@const def = BACKERS[b]}
                <li>
                  <button onclick={() => begin(chosenShip!, b)}>{def.name}</button>
                  <span>{def.text}.</span>
                  <span class="faint">{c.purse + def.gold(chosenShip)} gold to fit out with{def.spares ? `, ${def.spares} spares and ${def.powder} powder besides` : ''}</span>
                </li>
              {/each}
            </ul>
            <label class="chronicler"><input type="checkbox" bind:checked={takeChronicler} /> take a chronicler: a gentleman-poet who does no seamanship, costs {CHRONICLER_COST} gold and a berth, and if he comes home alive his account of the voyage adds to your fame</label>
            <div class="row"><button onclick={() => (chosenShip = null)}>another ship</button></div>
          {/if}
        </div>
      </div>
    {:else if intro}
      <div class="overlay">
        <div class="sheet intro">
          <h2>how to play</h2>
          <dl>
            <dt>the voyage</dt>
            <dd>Continue on and the ship sails the lanes a day at a time to the next landmark on the chart, stopping when something happens. Where the way divides, you choose: the Strait or the Horn, across the Pacific or back the way you came, the Moluccas or Manila. You can turn for home whenever you like.</dd>
            <dt>stores</dt>
            <dd>Every day the hands eat and drink a ration each, water faster in the tropics. Short rations stretch both; starvation kills slowly. Six weeks without fresh food and the scurvy starts to kill. Too few hands and she can't be sailed.</dd>
            <dt>at a landmark</dt>
            <dd>Fill the casks, forage and fish, careen her (spares mend her faster), buy from a chandler, trade with islanders, or raid a Spanish town, once. Where nobody holds the land, set up the Queen’s arms for fame at home. Each takes days.</dd>
            <dt>pace</dt>
            <dd>Easy loses a day in three and spares the hull; cracking on gains one and wears it.</dd>
            <dt>the way's events</dt>
            <dd>Storms, fever, foul water, weevils, a leak, a wreck, canoes, a reef, the hands wanting Spanish gold, fire in the bread room, a storm on the eve of a raid, a feast ashore, hands in the lock-up, your papers searched, shining ore: each asks you how to meet it, and says what it costs.</dd>
            <dt>a sail</dt>
            <dd>Privateers and corsairs off Spain and Barbary come at you; merchants off Brazil, Peru and in the East are yours to take or let pass. Off Cape San Francisco, the treasure ship, unless your raids on the coast have warned her.</dd>
            <dt>how to fight</dt>
            <dd>
              Cards, yours and hers. <em>The range</em> is far, close or grappled: long guns reach far, a broadside is heavy close, boarders only go across grappled, and a card does only what works at the range as it stands. Sail cards close the range or open it; three stretches of open water and a ship is away.
              <em>Her next card</em> is face up beside your hand, and she plays it after yours.
              <em>Three are dealt</em>: keep two, which play in the order you pick them; the third goes under your deck.
              <em>The chain</em>: sail, then shot, then board, each in order, and each hits harder than the last.
              <em>What it costs</em>: a barrel of powder for three shots, hands for every point of hull lost; with no powder the guns are silent. Beat her down and she strikes, and her hold fills yours.
              Your first fight explains itself as it goes, and at the Canaries there's a fishing boat to practise on.
            </dd>
            <dt>whose money</dt>
            <dd>The Crown, gentlemen adventurers, or your own stake: more money to fit out with, for a share of what you bring home.</dd>
            <dt>privateer or pirate</dt>
            <dd>Spain's and Portugal's ships and towns are fair game, but Spain keeps count. A French, Hanseatic or Dutch merchant is a friend's: richer than she looks, and taking her is piracy.</dd>
            <dt>home</dt>
            <dd>Your backers take their shares. Then the reckoning: show yourself at court for the fame, at a risk of being disowned to please Spain; lie low; or give the Queen a gift.</dd>
            <dt>the score</dt>
            <dd>Treasure home, two for every hand alive, up to twenty for the ship, times what your ship counts for: a voyage like Drake's, Cavendish's or Fenton's, or Oxenham's, lost.</dd>
          </dl>
          <p class="faint">The voyage saves as you go. The seed in the address sails the same voyage again.</p>
          <button onclick={() => (intro = false)}>close</button>
        </div>
      </div>
    {:else if logOpen}
      {@const top = best(log)}
      <div class="overlay">
        <div class="sheet">
          <h2>logbook</h2>
          {#if !log.length}
            <p class="faint">no voyage has ended yet. every one that does is written here.</p>
          {:else}
            <p>your best: {isWin(top!) ? `${scoreOf(top!)}${likeOf(top!) ? `, ${likeOf(top!)}` : ''}, on day ${top!.day}` : `${raised(top!)} landmarks raised, ${top!.gold} gold`}{top!.daily ? `, on the voyage of ${top!.daily}` : ''}</p>
            <table class="logbook">
              <thead><tr><th>ended</th><th>how</th><th class="num">score</th><th class="num">gold</th><th class="num">landmarks</th><th class="num">days</th><th>ship</th></tr></thead>
              <tbody>
                {#each log as e, i (i)}
                  <tr class:lost={e.ending === 'sunk'}>
                    <td>{e.when}{e.daily ? ' · today’s voyage' : ''}</td>
                    <td>{e.ending === 'sunk' ? `lost${e.sunkBy ? `: ${e.sunkBy}` : ''}` : e.ending === 'home' ? (likeOf(e)?.replace('a voyage like ', 'like ') ?? 'home') : e.ending === 'retired' ? 'retired' : 'given up'}</td>
                    <td class="num">{scoreOf(e)}</td>
                    <td class="num">{e.gold}</td>
                    <td class="num">{raised(e)}</td>
                    <td class="num">{e.day}</td>
                    <td>{e.ship}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          {/if}
          <div class="row">
            <button onclick={() => (logOpen = false)}>close</button>
            {#if log.length}<button onclick={downloadLog}>download the logbook</button>{/if}
          </div>
          <p class="faint">today's voyage is the same for everyone who sails it today: seed {dailySeed(today())}.</p>
        </div>
      </div>
    {:else if world && warning.length}
      <div class="overlay">
        <div class="sheet">
          <h2>before you sail</h2>
          {#each warning as w (w.kind)}<p>{w.text}</p>{/each}
          <div class="row">
            <button onclick={() => (warning = [])}>{warning.some((w) => w.fix) ? `stay and ${[...new Set(warning.map((w) => w.fix).filter(Boolean))].map((f) => FIX_WORDS[f!]).join(', and ')}` : 'stay'}</button>
            <button onclick={sailAnyway}>sail anyway</button>
          </div>
          <p class="faint">put on short rations and the stores go further, at the crew’s cost.</p>
        </div>
      </div>
    {:else if world && shown}
      <div class="overlay">
        <div class="sheet wide">
          <Fight fight={shown} {lastRound} {reckoning} {title} {isRaid} {nation} {onact} {oncontinue} teach={teaching} practice={practising} />
        </div>
      </div>
    {:else if world?.hail}
      {@const h = world.hail}
      {@const r = read(h.kind, hailExtra(h))}
      {@const flag = adjective(h.nation)}
      <div class="overlay">
        <div class="sheet">
          <h2>{h.plate ? 'the treasure ship' : h.prize ? PRIZES[h.prize].name : `a sail: ${article(flag)} ${flag} ${h.kind === 'treasure-ship' ? 'carrack' : TARGETS[h.kind].name}`}</h2>
          {#if h.prize}
            <p>{PRIZES[h.prize].text}</p>
          {/if}
          {#if h.neutral}
            <p>a friend's ship, not Spain's, and richer than her guns suggest. take her and it is piracy: {infamyFor(world) === 2 ? 'twice over under the Crown’s commission, ' : ''}the Admiralty will ask about her when you come home{world.backer === 'crown' ? ', and the Queen wants a clean commission' : ''}.</p>
          {/if}
          {#if h.plate}
            <p>the treasure ship of the South Sea, with the year's silver from Callao for Panama. {h.plate === 'warned' ? 'word of your raids on the coast has gone ahead of you, and she is ready for you.' : 'she has never seen an enemy in these waters, and takes you for one of her own.'}</p>
          {/if}
          <p class="faint">hull {r.hull} to your {world.hull} · {r.traits.join(' · ')}</p>
          <div class="row">
            <button onclick={() => attempt(() => attack(world!))}>attack</button>
            <button onclick={() => attempt(() => letPass(world!))}>let her pass</button>
          </div>
        </div>
      </div>
    {:else if world?.dilemma}
      {@const d = world.dilemma}
      {@const told = describeDilemma(d)}
      <div class="overlay">
        <div class="sheet">
          <h2>{told.title}</h2>
          <p>{told.text}</p>
          {#if d.kind === 'reckoning' && world.jewels.length}
            <p>the jewels in your cabin: sell them to a goldsmith, or set them aside for the Queen, who loves a jewel above anything{favourOf(world) ? `. set aside, they count ${favourOf(world)} toward a gift` : ''}.</p>
            <ul class="plain jewels">
              {#each world.jewels as j, i (i)}
                <li>
                  <label><input type="checkbox" checked={!!j.forQueen} onchange={(e) => (world = setAside(world!, i, (e.currentTarget as HTMLInputElement).checked))} /> {j.name}</label>
                  <span class="faint">{j.value} to a goldsmith{toHerTaste(j) ? `; to her taste: ${JEWELS[j.kind as Exclude<typeof j.kind, 'commander'>].taste}` : ''}{j.kind === 'commander' ? '; proof of your service, and court is safe' : ''}</span>
                </li>
              {/each}
            </ul>
          {/if}
          {#if d.kind === 'reckoning'}
            <p class="faint">
              in the strongroom: {world.gold}{world.settled.queen ? ` · the Queen's third paid: ${world.settled.queen}` : ''}{world.settled.gentlemen ? ` · the gentlemen paid: ${world.settled.gentlemen}` : ''}
              · Spain's grievance: {grievanceWord(world)}{world.grievance ? `, restitution demanded: ${restitutionFor(world)}` : ''} · your name: {lawfulness(world)}{courtRisk(world) ? ` · at court, ${Math.round(courtRisk(world) * 100)} in 100 you're disowned` : ''}
            </p>
          {/if}
          <ul class="plain choices">
            {#each choices(world, d) as c (c.key)}
              <li>
                <button onclick={() => attempt(() => choose(sea!, world!, c.key))} disabled={!!c.barred}>{c.label}</button>
                <span class="faint">{c.barred ?? c.stakes}</span>
              </li>
            {/each}
          </ul>
        </div>
      </div>
    {:else if world && (world.sunk || world.won)}
      {@const sc = score(world)}
      <div class="overlay">
        <div class="sheet">
          <h2>{sc.title}</h2>
          <p>{world.won ? `you came home to Plymouth on ${dateOf(world.turn)}, ${world.turn} days out.` : `lost on ${dateOf(world.turn)}, ${world.voyage.visited.length - 1} landmarks out.`} {sc.text}</p>
          {#if world.won}
            <table class="score">
              <tbody>
                <tr><td>treasure home</td><td class="num">{sc.treasure}</td></tr>
                <tr><td>{world.crew} hands home, {HAND_WORTH} each</td><td class="num">{sc.hands}</td></tr>
                <tr><td>the ship, {world.hull} hull of {world.maxHull}</td><td class="num">{sc.ship}</td></tr>
                <tr><td>fame at court{world.verdict === 'disowned' ? ': disowned' : world.verdict === 'low' ? ': you lay low' : world.verdict === 'pirate' ? ': named a pirate' : ''}</td><td class="num">{sc.fame}</td></tr>
                {#if world.hands.some((h) => h.role === 'chronicler')}
                  {@const him = world.hands.find((h) => h.role === 'chronicler')!}
                  <tr><td>{sc.chronicle ? `his account of the voyage, by ${him.name}` : him.dead ? `his account of the voyage died with ${him.name}` : `${him.name}'s account, forbidden printing`}</td><td class="num">{sc.chronicle}</td></tr>
                {/if}
                <tr><td>a {SHIP_CLASSES[world.ship].name}, ×{sc.multiplier}</td><td class="num"></td></tr>
                <tr class="total"><td>the score</td><td class="num">{sc.total}</td></tr>
              </tbody>
            </table>
          {/if}
          {#if world.won}
            {@const paid = [['the Queen’s third', world.settled.queen], ['the gentlemen adventurers', world.settled.gentlemen], ['a gift for the Queen', world.settled.gift], ['restitution to Spain', world.settled.restitution], ['seized by the Admiralty', world.settled.seized]].filter(([, n]) => n)}
            {#if paid.length}<p class="faint">paid away at home: {paid.map(([who, n]) => `${who}, ${n}`).join(' · ')}</p>{/if}
            {#if world.grievance && world.verdict !== 'pirate'}<p class="faint">take the Indies from the King of Spain, Hakluyt wrote in 1584, and “you take away his treasure which is nervus belli”.</p>{/if}
          {/if}
          {#if world.sunk && world.lastFight && world.lastFight.outcome === 'sunk'}
            {@const f = world.lastFight}
            <h3>the last fight: {f.what}</h3>
            <p>you went in with {f.hullIn} hull of {f.maxHull}; she had {f.theirHull} of {f.theirMax} left at the end.</p>
          {/if}
          <p class="faint">
            {world.tally.fights} {world.tally.fights === 1 ? 'fight' : 'fights'} · {world.tally.taken} taken · {world.tally.sacks} {world.tally.sacks === 1 ? 'town' : 'towns'} sacked{world.tally.best ? ` · best prize: ${world.tally.best.what}, ${world.tally.best.payout}` : ''}
          </p>
          <p class="faint">the way you sailed: {world.voyage.visited.map((k) => landmark(k).name).join(' · ')}</p>
          {#if world.arms.length}<p class="faint">the Queen’s arms set up at: {world.arms.map((k) => landmark(k).name).join(' · ')}</p>{/if}
          {#if Object.keys(world.losses).length}
            <p class="faint">hands lost on the voyage: {Object.entries(world.losses).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${n} ${k === 'ran' ? 'ran' : k === 'killed in the fight' ? 'killed fighting' : `to ${k}`}`).join(' · ')}</p>
          {/if}
          {#if world.hands.some((h) => h.dead && h.dead.cause !== 'went down with the ship')}
            <h3>the dead</h3>
            <ul class="plain dead">
              {#each world.hands.filter((h) => h.dead && h.dead.cause !== 'went down with the ship').sort((a, b) => a.dead!.turn - b.dead!.turn) as h (h.name)}
                {@const g = buried.find((x) => x.id.endsWith(`:${h.role}:${h.dead!.turn}`))}
                <li>
                  <strong>{called(h)}</strong>, dead of {h.dead!.cause}, {h.dead!.place}, {dateOf(h.dead!.turn)}.
                  {#if g}
                    <label><span class="faint">on his board:</span> <input maxlength={EPITAPH_LENGTH} value={g.epitaph} onchange={(e) => epitaph(g.id, (e.currentTarget as HTMLInputElement).value)} /></label>
                  {/if}
                </li>
              {/each}
            </ul>
            <p class="faint">a voyage that passes where they lie will find them.</p>
          {/if}
          <div class="row">
            <button onclick={() => newRun()}>a new run</button>
            <button onclick={() => newRun(today())}>today's voyage</button>
            <button onclick={() => (logOpen = true)}>logbook</button>
            <button onclick={copyLog}>copy the log</button>
            {#if copied}<span class="faint">{copied}: paste it wherever you like</span>{/if}
          </div>
          {#if shareShown}
            <p class="faint">the clipboard won't take it here; select it and copy:</p>
            <textarea class="share" readonly rows={shareShown.split('\n').length} value={shareShown} onfocus={(e) => (e.currentTarget as HTMLTextAreaElement).select()}></textarea>
          {/if}
        </div>
      </div>
    {/if}
  </main>
{/if}

<style>
  .chronicler { display: block; margin: 0.6rem 0; }
  .jewels li { margin: 0.2rem 0; }
  main { max-width: 72rem; margin: 0 auto; padding: 1.25rem 16px 2rem; display: flex; flex-direction: column; gap: 1rem; }
  header { display: flex; flex-direction: column; gap: 0.25rem; }
  h1 { margin: 0; font-size: 1.8rem; font-weight: 400; letter-spacing: -0.025em; }
  h2 { margin: 0 0 0.5rem; font-size: 1.3rem; font-weight: 400; letter-spacing: -0.025em; }
  h3 { margin: 1rem 0 0.4rem; font-size: 1rem; font-weight: 400; color: var(--faint); }
  p { margin: 0.3rem 0; }
  .faint { color: var(--faint); }
  .row { display: flex; flex-direction: row; flex-wrap: wrap; align-items: center; gap: 0.4rem; margin: 0.4rem 0; }
  .row button { padding: 0.3rem 0.7rem; font-size: 0.95rem; }
  button[aria-pressed='true'] { background: var(--ink); color: var(--paper); }
  .status { display: flex; flex-direction: column; gap: 0.4rem; }
  .bound { font-size: 1.1rem; }
  .bound strong { font-weight: 400; font-style: italic; }
  .gauges { display: grid; grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr)); gap: 0.25rem 1.25rem; font-size: 0.95rem; }
  .gauges > div { display: flex; align-items: center; gap: 0.5rem; }
  .label { color: var(--faint); min-width: 5.5rem; }
  .bar { display: inline-block; width: 4.5rem; height: 0.5rem; border: 1px solid var(--ink); flex: none; }
  .bar span { display: block; height: 100%; background: var(--ink); }
  .low { color: var(--theirs); }
  .low .bar { border-color: currentColor; }
  .low .bar span { background: currentColor; }
  .settings { display: flex; flex-wrap: wrap; gap: 0.4rem 1.5rem; }
  .settings .row { margin: 0; }
  .act { border-top: 1.5px solid var(--ink); padding-top: 0.75rem; }
  .landmark { border-left: 3px solid var(--ink); padding-left: 0.75rem; }
  .said { font-style: italic; }
  .primary .go { font-size: 1.1rem; padding: 0.5rem 1.4rem; }
  .plain { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.3rem; }
  .legs { margin: 0.5rem 0; font-size: 0.95rem; }
  .log { margin-top: 0.75rem; font-size: 0.95rem; }
  .keys { font-size: 0.8rem; margin-top: 0.75rem; }
  .overlay { position: fixed; inset: 0; background: rgba(255, 255, 255, 0.92); display: grid; place-items: start center; overflow: auto; padding: 2rem 16px; }
  .sheet { width: min(44rem, 100%); background: var(--paper); border: 1.5px solid var(--ink); padding: 1.25rem; }
  .sheet.wide { width: min(60rem, 100%); }
  .intro dl { margin: 1rem 0; }
  .intro dt { margin-top: 0.75rem; }
  .intro dd { margin: 0.2rem 0 0; }
  .ships { gap: 1rem; margin-top: 0.5rem; }
  .ships li { display: flex; flex-direction: column; align-items: flex-start; gap: 0.25rem; }
  .choices { flex-direction: row; flex-wrap: wrap; gap: 0.75rem; margin-top: 0.75rem; }
  .choices li { display: flex; flex-direction: column; align-items: flex-start; gap: 0.25rem; flex: 1 1 12rem; max-width: 18rem; }
  .warn { color: var(--theirs); margin: 0.3rem 0; }
  .of-note { margin: 0.4rem 0; font-size: 0.9rem; }
  .of-note summary { cursor: pointer; color: var(--faint); }
  .of-note li { margin: 0.2rem 0; }
  .of-note .gone, .of-note .gone strong { color: var(--faint); text-decoration: line-through; }
  .of-note .faint { display: block; }
  .dead li { margin: 0.4rem 0; }
  .dead input { font: inherit; width: 100%; max-width: 32rem; border: 1px solid var(--rule); padding: 0.2rem 0.4rem; }
  .score { border-collapse: collapse; margin: 0.5rem 0; min-width: 16rem; }
  .score td { padding: 0.15rem 1rem 0.15rem 0; text-align: left; }
  .score td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .score .total td { border-top: 1px solid var(--ink); font-weight: 600; }
  .logbook { width: 100%; border-collapse: collapse; font-size: 0.9rem; margin: 0.75rem 0; }
  .logbook th, .logbook td { text-align: left; padding: 0.25rem 0.6rem 0.25rem 0; border-bottom: 1px dashed var(--rule); vertical-align: top; }
  .logbook th { font-weight: 400; color: var(--faint); }
  .logbook .num { text-align: right; font-variant-numeric: tabular-nums; }
  .logbook .lost { color: var(--theirs); }
  .share { width: 100%; font: inherit; font-size: 0.9rem; border: 1px solid var(--rule); padding: 0.4rem; }
  .fold summary { cursor: pointer; }
  .fold summary .low { color: var(--theirs); }
  .fold .gauges { margin-top: 0.5rem; }
  .docked { flex-basis: 100%; font-size: 0.9rem; }
  /* A touch screen has no space bar to press. */
  @media (pointer: coarse) {
    .keys { display: none; }
  }
  /* A phone: continue on kept at the bottom, within reach of a thumb; buttons big enough to hit. */
  @media (max-width: 600px) {
    main { padding-bottom: 7rem; }
    .row button, .choices button { min-height: 2.6rem; }
    .dock { position: fixed; left: 0; right: 0; bottom: 0; margin: 0; padding: 0.5rem 16px calc(0.5rem + env(safe-area-inset-bottom)); background: var(--paper); border-top: 1.5px solid var(--ink); z-index: 1; }
    .dock button { font-size: 0.95rem; }
    .primary.dock .go { padding: 0.5rem 1.2rem; }
    .overlay { padding: 1rem 8px; z-index: 2; }
    .sheet { padding: 1rem; }
    .gauges { grid-template-columns: 1fr; }
  }
</style>
