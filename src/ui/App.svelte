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
  import { attack, fight, letPass, raid, raidHere, type Reckoning } from '../world/meet.ts';
  import { adjective, article, type Nation } from '../world/ports.ts';
  import { read } from '../world/reading.ts';
  import { HAND_WORTH, LIKE_TITLES, score } from '../world/score.ts';
  import {
    CHANDLER, ISLANDERS_COST, ISLANDERS_DAYS, SCURVY_DAYS, SHORE_DAYS, type Ware, ashore, startCrew, buy, capacity, complement, daysOf, landmarkHere, marketHere, price, room, scurvy, shoreHere, trade,
  } from '../world/stores.ts';
  import { plateExtra } from '../world/treasure.ts';
  import { advance, createSea, createWorld, dateOf, type Sea, type WorldState, waiting } from '../world/world.ts';
  import { forget, load, store } from '../save.ts';
  import { type Entry, best, dailySeed, entryFor, isWin, loadLog, raised, saveLog, scoreOf, today, withEntry } from '../logbook.ts';
  import { ambient, bell, coin, gun, knell, setSound, soundOn, storm } from './sound.ts';
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
  /** Choosing a ship: a new run waits on it. */
  let choosing = $state(!resuming);
  setTimeout(() => {
    sea = createSea();
    if (resuming) world = resuming.world;
  }, 30);

  function begin(ship: string) {
    if (!sea) return;
    world = createWorld(sea, seed, ship);
    choosing = false;
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
    if (k === 'storm' && lastDilemma !== 'storm') storm();
    lastDilemma = k;
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

  function go() {
    if (!sea || !world || waiting(world) || world.sunk || world.won) return;
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
  function day() {
    if (!sea || !world) return stop();
    try {
      const before = world.log.length;
      const out = continueOn(sea, world);
      world = out.world;
      if (!out.halt) return;
      const news = world.log.slice(before).filter((l) => l.stop).at(-1)?.text ?? '';
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

  $effect(() => {
    if (world?.encounter && !shown) {
      const m = world.encounter;
      shown = m.fight;
      isRaid = m.raid !== null;
      nation = m.nation;
      const flag = adjective(m.nation);
      title = m.raid ? `the raid on ${landmark(m.raid).name}` : m.plate ? 'the treasure ship from Callao' : `${article(flag)} ${flag} ${m.kind === 'treasure-ship' ? 'carrack' : TARGETS[m.kind].name}`;
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
  const market = $derived(sea && now() ? marketHere(sea, now()!) : null);
  const town = $derived(sea && now() ? raidHere(sea, now()!) : null);
  /** At a fork with nothing chosen: the way divides, and you choose. */
  const atFork = $derived.by(() => {
    const w = now();
    return !!w && !w.voyage.bound && !onward(w.voyage);
  });
  const canContinue = $derived.by(() => {
    const w = now();
    return !!w && !atFork && !waiting(w) && !w.sunk && !w.won;
  });
  /** Where you're making for: chosen, or the next where the way is one. */
  const making = $derived.by(() => {
    const w = now();
    return w ? (w.voyage.bound ?? onward(w.voyage)) : null;
  });
  const days = $derived(now() ? daysOf(now()!) : { food: 0, water: 0 });
  const RATIONS: [WorldState['rations'], string][] = [['full', 'full'], ['short', 'short'], ['starving', 'starvation']];
  const PACES: [WorldState['pace'], string][] = [['easy', 'easy'], ['steady', 'steady'], ['hard', 'crack on']];
  const WARES: Ware[] = ['food', 'water', 'hands', 'spares', 'powder'];
  /** The last things that happened, newest first. */
  const recent = $derived(now()?.log.slice(-6).reverse() ?? []);
  const pct = (v: number, m: number) => `${Math.max(0, Math.min(100, (v / Math.max(1, m)) * 100))}%`;
</script>

<svelte:window onkeydown={onkey} onpointerdown={wake} />

{#if !sea}
  <main><p class="faint">charting the seas…</p></main>
{:else}
  <main>
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
      <RouteChart {sea} {world} />

      <!-- Where you stand: the next landmark, and what you've got to get there on. -->
      <section class="status" aria-label="the ship">
        <p class="bound">
          {#if here}<strong>{here.name}</strong>{:else}at sea{/if}
          {#if making && making !== world.voyage.at} · bound for {making === HOME_LANDMARK ? 'home' : landmark(making).name}, {daysTo(sea, world, making)} days{/if}
        </p>
        <div class="gauges">
          <div class:low={world.crew < complement(world) / 2}><span class="label">hands</span><span class="bar"><span style="width: {pct(world.crew, complement(world))}"></span></span>{world.crew} of {complement(world)}</div>
          <div class:low={days.food <= 10}><span class="label">food</span><span class="bar"><span style="width: {pct(world.stores.food, capacity(world).food)}"></span></span>{days.food} days</div>
          <div class:low={days.water <= 10}><span class="label">water</span><span class="bar"><span style="width: {pct(world.stores.water, capacity(world).water)}"></span></span>{days.water} days</div>
          <div class:low={scurvy(world) !== 'none'}><span class="label">fresh food</span>{world.fresh} days ago{scurvy(world) === 'killing' ? ': the scurvy is killing' : scurvy(world) === 'coming' ? `: scurvy at ${SCURVY_DAYS}` : ''}</div>
          <div class:low={world.hull <= world.maxHull / 3}><span class="label">hull</span><span class="bar"><span style="width: {pct(world.hull, world.maxHull)}"></span></span>{world.hull} of {world.maxHull}</div>
          <div class:low={world.stores.spares === 0}><span class="label">spares</span>{world.stores.spares}</div>
          <div class:low={world.stores.powder === 0}><span class="label">powder</span>{world.stores.powder}</div>
          <div><span class="label">gold</span>{world.gold}</div>
        </div>
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
          {#if shore.length}
            <div class="row">
              {#each shore as work (work)}
                <button disabled={sailing} onclick={() => attempt(() => ashore(sea!, world!, work, advance))}>
                  {work === 'water' ? 'fill the casks' : work === 'forage' ? 'forage and fish' : 'careen her'} ({SHORE_DAYS[work]} days)
                </button>
              {/each}
            </div>
          {/if}
          {#if market === 'chandler'}
            <p class="faint">the chandler{world.voyage.at === 'plymouth' ? '' : ', half as dear again as Plymouth'}. food bought here is fresh.</p>
            <div class="row">
              {#each WARES as ware (ware)}
                <button disabled={sailing || world.gold < price(world, ware) || !room(world, ware)} onclick={() => attempt(() => buy(sea!, world!, ware))}>
                  {ware === 'hands' ? `${CHANDLER[ware].lot} hands` : `${CHANDLER[ware].lot} ${CHANDLER[ware].unit} of ${CHANDLER[ware].name}`} ({price(world, ware)})
                </button>
              {/each}
            </div>
          {:else if market === 'islanders'}
            <div class="row"><button disabled={sailing || world.gold < ISLANDERS_COST} onclick={() => attempt(() => trade(sea!, world!))}>trade with the islanders ({ISLANDERS_COST}): the casks filled, {ISLANDERS_DAYS} days of fresh food</button></div>
          {/if}
          {#if town}
            <div class="row"><button disabled={sailing} onclick={() => attempt(() => raid(sea!, world!))}>raid {here.name}, once</button></div>
            <p class="faint">{town.kind === 'fortress' ? 'walled, and its guns are heavy.' : 'an open town: a battery or two, the walls, and the townsfolk.'} {['valparaiso', 'callao'].includes(town.key) && !world.voyage.visited.includes('cacafuego') ? 'word of a raid here would go north ahead of you.' : ''}</p>
          {/if}
        {/if}
        <div class="row primary">
          {#if atFork}
            <span class="faint">the way divides:</span>
            {#each legsFrom(world.voyage) as k (k)}
              <button onclick={() => setFor(k)}>{k === HOME_LANDMARK ? 'turn for home' : landmark(k).name}, {daysTo(sea, world, k)} days</button>
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
        {#if atFork}
          <ul class="plain legs">
            {#each legsFrom(world.voyage).filter((k) => k !== HOME_LANDMARK) as k (k)}<li><em>{landmark(k).name}.</em> <span class="faint">{landmark(k).text}</span></li>{/each}
          </ul>
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
          <h3>choose your ship</h3>
          <ul class="plain ships">
            {#each SHIPS as k (k)}
              {@const c = SHIP_CLASSES[k]}
              <li>
                <button onclick={() => begin(k)}>a {c.name}</button>
                <span>{c.text}.</span>
                <span class="faint">{c.purse} gold · hull {c.hull} · {startCrew(k)} of {c.complement} hands · {deckSize(k)} cards{Object.keys(c.cards).length ? `, with ${cardWords(c.cards)}` : ''} · the score ×{c.multiplier}</span>
              </li>
            {/each}
          </ul>
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
            <dd>Fill the casks, forage and fish, careen her (spares mend her faster), buy from a chandler, trade with islanders, or raid a Spanish town, once. Each takes days.</dd>
            <dt>pace</dt>
            <dd>Easy loses a day in three and spares the hull; cracking on gains one and wears it.</dd>
            <dt>the way's events</dt>
            <dd>Storms, fever, foul water, weevils: each asks you how to meet it, and says what it costs.</dd>
            <dt>a sail</dt>
            <dd>Privateers and corsairs off Spain and Barbary come at you; merchants off Brazil, Peru and in the East are yours to take or let pass. Off Cape San Francisco, the treasure ship, unless your raids on the coast have warned her.</dd>
            <dt>a fight</dt>
            <dd>Cards. Three are dealt: keep two, which play in the order you pick them; the third goes to the bottom. Sail, then shot, then board, each in order, and they hit harder. A fight spends powder and costs hands; with no powder the guns are silent. A prize's hold fills yours.</dd>
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
    {:else if world && shown}
      <div class="overlay">
        <div class="sheet wide">
          <Fight fight={shown} {lastRound} {reckoning} {title} {isRaid} {nation} {onact} {oncontinue} />
        </div>
      </div>
    {:else if world?.hail}
      {@const h = world.hail}
      {@const r = read(h.kind, h.plate ? plateExtra(h.plate === 'warned') : {})}
      {@const flag = adjective(h.nation)}
      <div class="overlay">
        <div class="sheet">
          <h2>{h.plate ? 'the treasure ship' : `a sail: ${article(flag)} ${flag} ${h.kind === 'treasure-ship' ? 'carrack' : TARGETS[h.kind].name}`}</h2>
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
                <tr><td>a {SHIP_CLASSES[world.ship].name}, ×{sc.multiplier}</td><td class="num"></td></tr>
                <tr class="total"><td>the score</td><td class="num">{sc.total}</td></tr>
              </tbody>
            </table>
          {/if}
          {#if world.sunk && world.lastFight && world.lastFight.outcome === 'sunk'}
            {@const f = world.lastFight}
            <h3>the last fight: {f.what}</h3>
            <p>you went in with {f.hullIn} hull of {f.maxHull}; she had {f.theirHull} of {f.theirMax} left at the end.</p>
          {/if}
          <p class="faint">
            {world.tally.fights} {world.tally.fights === 1 ? 'fight' : 'fights'} · {world.tally.taken} taken · {world.tally.sacks} {world.tally.sacks === 1 ? 'town' : 'towns'} sacked{world.tally.best ? ` · best prize: ${world.tally.best.what}, ${world.tally.best.payout}` : ''}
          </p>
          <p class="faint">{world.voyage.visited.map((k) => landmark(k).name).join(' · ')}</p>
          <div class="row">
            <button onclick={() => newRun()}>a new run</button>
            <button onclick={() => newRun(today())}>today's voyage</button>
            <button onclick={() => (logOpen = true)}>logbook</button>
          </div>
        </div>
      </div>
    {/if}
  </main>
{/if}

<style>
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
  .settings { display: flex; flex-wrap: wrap; gap: 0 1.5rem; }
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
  .score { border-collapse: collapse; margin: 0.5rem 0; min-width: 16rem; }
  .score td { padding: 0.15rem 1rem 0.15rem 0; text-align: left; }
  .score td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .score .total td { border-top: 1px solid var(--ink); font-weight: 600; }
  .logbook { width: 100%; border-collapse: collapse; font-size: 0.9rem; margin: 0.75rem 0; }
  .logbook th, .logbook td { text-align: left; padding: 0.25rem 0.6rem 0.25rem 0; border-bottom: 1px dashed var(--rule); vertical-align: top; }
  .logbook th { font-weight: 400; color: var(--faint); }
  .logbook .num { text-align: right; font-variant-numeric: tabular-nums; }
  .logbook .lost { color: var(--theirs); }
</style>
