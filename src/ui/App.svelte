<script lang="ts">
  import { onDestroy } from 'svelte';
  import { act, type Action, type EncounterState, type GameEvent } from '../rules.ts';
  import { CREW, PLAYER_CARDS, SHIP_CLASSES, UPGRADES, WAGE_DAYS, cardWords, deckSize, wagesOf } from '../outfit.ts';
  import { buyRound, ROUND_COST } from '../world/bar.ts';
  import { plotCourse, sailToward } from '../world/course.ts';
  import type { NodeId } from '../world/map.ts';
  import { attack, fight, GUARD_HULL, GUARD_RELIEF, guardOf, letPass, onGuard, treasury, TREASURY_REFILL, raid, raidable, repair, REPAIR_COST, YOUR_NATION, type Reckoning } from '../world/meet.ts';
  import { CASUS_BELLI, enemiesOf, isEnemy } from '../world/wars.ts';
  import { TARGETS } from '../setup.ts';
  import { SEASON_NAMES } from '../world/ocean.ts';
  import { bribe, bribeCost, buyPardon, buyShip, buyUpgrade, isHaven, leavePrize, PARDON_COST, takePrize, PROVISION_CHEER, PROVISION_COST, PROVISION_HULL, provision, provisions, recruit, retire, serves } from '../world/port.ts';
  import { IDLE_DAYS, MORALE_MAX } from '../world/events.ts';
  import { inSight, lookout, readShip } from '../world/scout.ts';
  import { ACTS, REGIONS, describeLetter, reprisal } from '../world/letters.ts';
  import { choices, choose, describe as describeDilemma } from '../world/dilemmas.ts';
  import CardView from './CardView.svelte';
  import { adjective, article, nationName, sailName } from '../world/ports.ts';
  import { markerStrength, predict } from '../world/rumors.ts';
  import type { Sea } from '../world/ships.ts';
  import { atIsland, createSea, createWorld, GOAL, HOME, homeward, knowledge, pursuitOf, renown, type WorldState } from '../world/world.ts';
  import Fight from './Fight.svelte';
  import Flag from './Flag.svelte';
  import { COLORS } from '../world/colors.ts';
  import type { Nation } from '../world/ports.ts';
  import Gauge from './Gauge.svelte';
  import SeaChart from './SeaChart.svelte';
  import ShipSheet from './ShipSheet.svelte';
  import { forget, load, store } from '../save.ts';
  import { ambient, bell, coin, gun, knell, setSound, soundOn, storm } from './sound.ts';
  import { type Entry, best, dailySeed, entryFor, loadLog, saveLog, today, withEntry } from '../logbook.ts';

  function seedFromUrl(): number | null {
    const raw = new URLSearchParams(location.search).get('seed');
    const n = raw === null ? NaN : Number(raw);
    return Number.isInteger(n) ? n : null;
  }

  // A run in progress is picked up where it was left, unless the address
  // asks for a different seed.
  const asked = seedFromUrl();
  const saved = load();
  const resuming = saved && (asked === null || asked === saved.seed) ? saved : null;

  // Building the sea takes a moment; let the page paint first.
  let sea: Sea | null = $state.raw(null);
  let seed = $state(resuming?.seed ?? asked ?? Math.floor(Math.random() * 2 ** 31));
  /** The date, if this run is that day's voyage. */
  let daily: string | null = $state(resuming?.daily ?? (asked !== null && asked === dailySeed(today()) ? today() : null));
  let world: WorldState | null = $state.raw(null);
  setTimeout(() => {
    sea = createSea();
    world = resuming?.world ?? createWorld(sea, seed);
  }, 30);

  // How to play: shown on a first visit, and from the header after.
  const INTRO_KEY = 'privateer:intro-seen';
  let intro = $state(!resuming && !seenIntro());
  function seenIntro() {
    try {
      return localStorage.getItem(INTRO_KEY) !== null;
    } catch {
      return false;
    }
  }
  function closeIntro() {
    intro = false;
    try {
      localStorage.setItem(INTRO_KEY, '1');
    } catch {
      // Then it shows again next time; no harm.
    }
  }
  function abandon() {
    if (!confirm('give up this run and start another?')) return;
    if (world && world.turn > 0) logRun(world);
    newRun();
  }

  // The logbook: every run that ends, written once.
  let logOpen = $state(false);
  let log: Entry[] = $state(loadLog());
  let logged = false;
  function logRun(w: WorldState) {
    log = withEntry(log, entryFor(w, seed, daily, new Date()));
    saveLog(log);
  }

  // A storm coming on is heard before it's read.
  let lastDilemma: string | null = null;
  $effect(() => {
    const k = world?.dilemma?.kind ?? null;
    if (k === 'storm' && lastDilemma !== 'storm') storm();
    lastDilemma = k;
  });

  // Sound, if asked for: the toggle in the header; the sea starts with the first click on the page.
  let sound = $state(soundOn());
  function toggleSound() {
    sound = !sound;
    setSound(sound);
  }
  function wake() {
    if (sound) ambient(true);
  }

  // Keys, when nothing is open over the chart: space to sail or heave to, f to find the ship, + and − to zoom, escape to close.
  function onkey(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target as HTMLElement;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (e.key === 'Escape') {
      if (logOpen) logOpen = false;
      else if (intro) closeIntro();
      else halted = '';
      return;
    }
    if (!world || intro || logOpen || shown || world.hail || world.spoil || world.dilemma || world.sunk || world.won) return;
    if (e.key === ' ') {
      e.preventDefault();
      if (sailing) stop('hove to');
      else if (dest !== null && course.length >= 2) setSail();
    } else if (e.key === 'f') chart?.recentre();
    else if (e.key === '+' || e.key === '=') chart?.zoom(1 / 1.4);
    else if (e.key === '-') chart?.zoom(1.4);
  }

  // Saved after every change; a finished run is written in the logbook and forgotten, so the next visit starts afresh.
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

  /** The whole logbook, as a file to keep or send. */
  function downloadLog() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(log, null, 2)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'privateer-logbook.json' });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  /** Today's voyage, from the header: a run in progress is given up first, and logged. */
  function todaysVoyage() {
    if (world && world.turn > 0 && !world.sunk && !world.won) {
      if (!confirm("give up this run and sail today's voyage?")) return;
      logRun(world);
    }
    newRun(today());
  }

  $effect(() => {
    const url = new URL(location.href);
    url.searchParams.set('seed', String(seed));
    history.replaceState(null, '', url);
  });

  // --- Sailing ---------------------------------------------------------------

  let dest: NodeId | null = $state(null);
  let sailing = $state(false);
  let halted = $state('');
  let timer: ReturnType<typeof setInterval> | null = null;
  const course = $derived(sea && world && dest !== null ? plotCourse(sea, world, dest) : []);

  function setSail() {
    if (!sea || !world || dest === null) return;
    // A fresh timer every time: a timer left from a sailing that went wrong is never reused.
    if (timer) clearInterval(timer);
    sailing = true;
    halted = '';
    said = '';
    timer = setInterval(day, 140);
  }
  function stop(why = '') {
    sailing = false;
    halted = why;
    if (timer) clearInterval(timer);
    timer = null;
    // The bell: the ship heaves to for something. Not for the run's end; that has its own.
    if (why && world && !world.sunk && !world.won) bell(why === 'arrived' ? 2 : why === 'hove to' ? 1 : 3);
  }
  /**
   * A day's sail, guarded: anything that goes wrong stops the ship and says
   * so, rather than leaving a timer failing quietly behind a "sailing" ship
   * that never moves.
   */
  function day() {
    try {
      sailDay();
    } catch (e) {
      console.error('a day under sail failed', e, { turn: world?.turn, player: world?.player, dest, hail: !!world?.hail, encounter: !!world?.encounter, spoil: !!world?.spoil, dilemma: world?.dilemma });
      stop(`the ship can't sail: ${(e as Error).message}`);
    }
  }
  function sailDay() {
    if (!sea || !world || dest === null) return stop();
    const out = sailToward(sea, world, dest);
    world = out.world;
    chart?.recentre();
    if (!out.halt) return;
    const why: Record<string, string> = {
      arrived: 'arrived',
      encounter: 'attacked!',
      hail: 'a sail alongside',
      choice: '',
      sighted: 'land ho — uncharted',
      stuck: 'no way there',
      won: 'home',
      sunk: '',
    };
    if (out.halt === 'arrived') dest = null;
    if (out.halt === 'news') return stop([...world.log].reverse().find((l) => l.stop)!.text);
    if (out.halt === 'sail') {
      const x = inSight(sea, world).find((y) => y.hostile)!;
      return stop(`a sail: ${sailName(x.ship.kind, x.ship.nation)}, ${x.days} ${x.days === 1 ? 'day' : 'days'} off${x.closing ? ', bearing down on you' : ''}`);
    }
    stop(why[out.halt]);
  }
  function oneDay() {
    if (dest !== null) day();
  }
  onDestroy(() => stop());

  // --- Fighting --------------------------------------------------------------

  /** The fight as it stands, kept a moment after the world settles it, to show how it ended. */
  let shown: EncounterState | null = $state.raw(null);
  let lastRound: GameEvent[] = $state.raw([]);
  let reckoning: Reckoning | null = $state.raw(null);
  let title = $state('');
  let nation: Nation = $state('local');
  let isRaid = $state(false);

  $effect(() => {
    if (world?.encounter && !shown) {
      shown = world.encounter.fight;
      const m = world.encounter;
      const flagName = adjective(m.nation);
      isRaid = m.port !== null && m.kind !== 'canoes';
      nation = m.nation;
      const place = m.port !== null ? sea!.map.nodes[m.port].port!.name : '';
      title =
        m.kind === 'canoes'
          ? `war canoes off ${place}`
          : m.kind === 'monster'
            ? `the monster of the ${world.ships[m.shipId].routeName}`
            : m.port !== null
              ? `the raid on ${place}, ${flagName}`
              : `${article(flagName)} ${flagName} ${TARGETS[m.kind].name}`;
      lastRound = [];
      reckoning = null;
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
    // The guns, in the order the shot was fired: yours heavier, hers duller.
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

  // --- In port ---------------------------------------------------------------

  let said = $state('');
  /** The tab under the map. Arriving in a port shows the port. */
  type Tab = 'location' | 'politics' | 'ship';
  let tab: Tab = $state('location');
  let lastPort: number | null = null;
  $effect(() => {
    const here = world && sea?.map.nodes[world.player].port ? world.player : null;
    if (here !== null && here !== lastPort) tab = 'location';
    lastPort = here;
  });
  function attempt(f: () => WorldState, done = '') {
    try {
      world = f();
      said = done;
    } catch (e) {
      said = (e as Error).message;
    }
  }
  function round() {
    if (!sea || !world) return;
    try {
      const { world: w, heard } = buyRound(sea, world);
      world = w;
      said = heard ? `somebody saw ${sailName(heard.kind, heard.nation)}, ${ago(world.turn - heard.turn)}` : 'nobody knows anything worth the drink';
      if (heard) focus = heard.id;
    } catch (e) {
      said = (e as Error).message;
    }
  }

  // --- Rumors ----------------------------------------------------------------

  let focus: number | null = $state(null);
  const cloud = $derived.by(() => {
    if (!sea || !world || focus === null || sailing) return [];
    const r = world.rumors.find((x) => x.id === focus);
    if (!r) return [];
    const p = predict(sea, r, world.turn, knowledge(world), world.player, pursuitOf(world, sea));
    return p.flatMap((v, node) => (v > 0.003 ? [{ node, p: v }] : []));
  });

  /** Ships within a step of what you can see. */
  const visible = $derived.by(() => {
    if (!sea || !world) return [];
    const d = sea.map.distTo(world.player);
    return world.ships.filter((s) => s.laidUp <= world!.turn && d[s.node] <= lookout(world!)).map((s) => s.id);
  });

  let chart: SeaChart | null = $state(null);

  function newRun(day: string | null = null) {
    stop();
    daily = day;
    seed = day ? dailySeed(day) : Math.floor(Math.random() * 2 ** 31);
    world = createWorld(sea!, seed);
    logged = false;
    logOpen = false;
    tab = 'location';
    dest = null;
    focus = null;
    said = '';
    shown = null;
    chart?.recentre();
  }

  const captivesOf = (id: number) => world?.ships.find((x) => x.id === id)?.captives ?? null;
  const RENOWN_WORDS = ['unknown', 'getting about', 'known in every port', 'a legend'];
  const ago = (days: number) => (days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days back`);

  const nodeName = (id: NodeId) => {
    const n = sea!.map.nodes[id];
    if (n.port) return n.port.name;
    if (world!.islands.some((i) => i.found && i.node === id)) return 'an uncharted isle';
    return `${Math.abs(n.lat).toFixed(0)}°${n.lat >= 0 ? 'n' : 's'} ${Math.abs(n.lon).toFixed(0)}°${n.lon >= 0 ? 'e' : 'w'}`;
  };
</script>

<svelte:window onkeydown={onkey} onpointerdown={wake} />

{#if !sea || !world}
  <main class="loading"><p>charting the seas…</p></main>
{:else}
  {@const port = sea.map.nodes[world.player].port}
  <main>
    <header>
      <h1>privateer</h1>
      <p class="meta">
        day {world.turn + 1}, {SEASON_NAMES[Math.floor(world.turn / sea.pattern.seasonLength) % 4]} ·
        {#if world.commission === 'active'}letter {world.letter!.act} of {ACTS}{' · '}{:else if world.commission === 'done'}every letter done: home to {HOME}{' · '}{/if}{world.gold} gold{world.commission === 'legacy' ? ` of ${GOAL} to bring home to ${HOME}` : world.pirate ? `, ${GOAL} to retire on` : ''} · seed {seed}
        {#if world.pirate}<span class="wanted"> · a pirate</span>{/if}
        {#if daily}<span> · today's voyage, {daily}</span>{/if}
      </p>
      <div class="row">
        <button onclick={() => (intro = true)}>how to play</button>
        <button onclick={() => (logOpen = true)}>logbook</button>
        <button onclick={todaysVoyage}>today's voyage</button>
        <button onclick={toggleSound} aria-pressed={sound}>sound {sound ? 'on' : 'off'}</button>
        <button onclick={abandon}>a new run</button>
      </div>
    </header>

    <div class="layout">
      <div class="map">
        <div class="chartbox">
          <SeaChart bind:this={chart} {sea} {world} {course} {cloud} {focus} {visible} region={world.letter?.region ? REGIONS[world.letter.region] : null} onpick={(n) => ((dest = n), (halted = ''))} />
          <!-- Why the ship stopped, said on the chart where you're looking. -->
          {#if halted || (said && !port)}
            {#key halted + said}
              <div class="banner" role="status">
                <p>{halted || said}</p>
                <button onclick={() => ((halted = ''), (said = ''))} aria-label="dismiss">×</button>
              </div>
            {/key}
          {/if}
        </div>
        <div class="mapkeys">
          <button onclick={() => chart?.zoom(1 / 1.4)} aria-label="zoom in">+</button>
          <button onclick={() => chart?.zoom(1.4)} aria-label="zoom out">−</button>
          <button onclick={() => chart?.recentre()}>find the ship</button>
        </div>
        <p class="legend">keys: space sets sail or heaves to · f finds the ship · + and − zoom · in a fight, 1 2 3 and enter</p>
        <p class="legend">blue: the current a step out · dashed grey: this season's wind · rings: rumors, in the ship's colours, fading · red cloud: where the selected one's ship could be by now · squares are fortified ports, circles open towns, triangles ships</p>

        <!-- Below the map: where you are, how the powers stand, your ship. -->
        <div class="tabs" role="tablist">
          {#each [['location', port ? port.name : 'at sea'], ['politics', 'politics'], ['ship', 'ship & crew']] as [key, label]}
            <button role="tab" aria-selected={tab === key} class:current={tab === key} onclick={() => (tab = key as Tab)}>{label}</button>
          {/each}
        </div>
        <div class="tabpanel" role="tabpanel">
          {#if tab === 'location'}
            {#if port}
            <h2><Flag nation={port.nation} />{port.name}, {adjective(port.nation)}</h2>
            {#if isHaven(sea, world)}
              <p>a pirate's haven: they'll deal with you here, whoever wants you, and you can retire here when you're rich.</p>
              <div class="row"><button onclick={() => attempt(() => retire(sea!, world!))} disabled={world.gold < GOAL}>retire here ({world.gold} of {GOAL})</button></div>
            {/if}
            {#if port.nation === 'native'}
              <p>islanders: no bar, no yard, no hands to hire, but water, fruit and timber in trade, for the crew and the ship.</p>
              {#if (world.standing.native ?? 0) < 0}
                <p class="wanted">they remember what you did here, and won't trade.</p>
                <div class="row"><button onclick={() => attempt(() => bribe(sea!, world!), 'gifts accepted')}>make them gifts ({bribeCost(world, 'native')})</button></div>
              {:else}
                <div class="row"><button onclick={() => attempt(() => provision(sea!, world!))} disabled={!provisions(sea, world)}>trade for provisions ({PROVISION_COST}): morale +{PROVISION_CHEER}, hull +{PROVISION_HULL}</button></div>
              {/if}
            {:else if world.pirate && port.nation === YOUR_NATION && !isHaven(sea, world)}
              <p>they know you for a pirate here.</p>
              <div class="row"><button onclick={() => attempt(() => buyPardon(sea!, world!), 'pardoned, at a price')}>buy a royal pardon ({PARDON_COST})</button></div>
            {:else if !serves(sea, world)}
              <p>the {adjective(port.nation)} won't deal with you.</p>
              <div class="row"><button onclick={() => attempt(() => bribe(sea!, world!), 'the right palms are greased')}>bribe the officials ({bribeCost(world, port.nation)})</button></div>
            {:else}
              <details class="sub" open><summary><h3>the bar</h3></summary>
              <p class="faint">berths {world.outfit.crew.length} of {SHIP_CLASSES[world.outfit.ship].berths}{world.outfit.crew.length ? ' · let hands go from the ship & crew tab' : ''}</p>
              <ul class="plain shop">
                <li><button onclick={round}>buy a round ({ROUND_COST})</button><span class="faint">somebody may have seen a ship</span></li>
                {#each Object.entries(CREW).filter(([k]) => !world!.outfit.crew.includes(k)) as [key, c]}
                  <li>
                    <button onclick={() => attempt(() => recruit(sea!, world!, key), `the ${c.name} signs on`)} disabled={world.gold < c.cost || world.outfit.crew.length >= SHIP_CLASSES[world.outfit.ship].berths}>hire a {c.name} ({c.cost})</button>
                    <span class="faint">{[cardWords(c.cards) && `+ ${cardWords(c.cards)}`, c.sight ? `sight +${c.sight}` : ''].filter(Boolean).join(' · ')} · wage {c.wage}</span>
                  </li>
                {/each}
              </ul>
              </details>
              <details class="sub" open><summary><h3>the yard</h3></summary>
              <ul class="plain shop">
                {#if world.hull < world.maxHull}
                  <li><button onclick={() => attempt(() => repair(sea!, world!), 'the carpenters are paid')}>repair ({REPAIR_COST} a point)</button><span class="faint">{world.maxHull - world.hull} to mend</span></li>
                {/if}
                {#each Object.entries(UPGRADES) as [key, u]}
                  {@const fitted = world.outfit.upgrades.filter((x) => x === key).length}
                  <li>
                    <button onclick={() => attempt(() => buyUpgrade(sea!, world!, key), `${u.name} fitted`)} disabled={world.gold < u.cost || fitted >= u.max}>{u.name} ({u.cost})</button>
                    <span class="faint">{[u.cards ? `+ ${cardWords(u.cards)}` : '', u.hull ? `hull +${u.hull}` : ''].filter(Boolean).join(' · ')}{fitted ? ` · fitted ${fitted} of ${u.max}` : ''}</span>
                  </li>
                {/each}
              </ul>
              </details>
              <details class="sub"><summary><h3>ships for sale</h3></summary>
              <ul class="plain shop">
                {#each Object.entries(SHIP_CLASSES).filter(([k]) => k !== world!.outfit.ship && k !== 'pinnace') as [key, c]}
                  {@const now = SHIP_CLASSES[world.outfit.ship]}
                  <li>
                    <button onclick={() => attempt(() => buyShip(sea!, world!, key), `you take command of a ${c.name}`)} disabled={world.gold < c.cost || world.outfit.crew.length > c.berths}>a {c.name} ({c.cost})</button>
                    <span class="faint">hull {c.hull} ({c.hull >= now.hull ? '+' : ''}{c.hull - now.hull}), {c.berths} berths{Object.keys(c.cards).length ? ` · + ${cardWords(c.cards)}` : ''}{world.outfit.upgrades.length ? ' · your refits stay with the old ship' : ''}</span>
                  </li>
                {/each}
              </ul>
              </details>
              {#if (world.standing[port.nation] ?? 0) < 0}
                <div class="row"><button onclick={() => attempt(() => bribe(sea!, world!), 'the right palms are greased')}>bribe the officials ({bribeCost(world, port.nation)})</button></div>
              {/if}
            {/if}
            <details class="sub"><summary><h3>a raid</h3></summary>
            {#if (world.sacked[world.player] ?? -1) >= world.turn}
              <p class="faint">sacked lately: there's nothing left here.</p>
            {:else if onGuard(world, world.player)}
              <p class="faint">on its guard after your last raid: the boats would never get ashore. shut till day {guardOf(world, world.player)!.shutUntil + 1}.</p>
            {:else}
              {#if guardOf(world, world.player)}{@const guard = guardOf(world, world.player)!}<p class="wanted">on its guard since your last raid: walls {GUARD_HULL * guard.level} stronger, its relief {GUARD_RELIEF * guard.level} rounds sooner, and {treasury(world, world.player, port.fort ? 'fortress' : 'town')} in the treasury, filling again by {TREASURY_REFILL} a day. on its guard till day {guard.until + 1}.</p>{/if}
              <p class="faint">
                {port.fort ? 'a fortified port: not for a small ship.' : 'an open town.'}
                the {adjective(port.nation)} will remember it three times over and their guard ships will hunt twice as far.
                {port.nation === YOUR_NATION ? ' it is your own flag: you would be a pirate.' : isEnemy(world.wars, port.nation) || reprisal(world, port.nation) ? ' they are at war with England, or named in your letter: fair game.' : ' they are at peace with England: the Crown will hear of it.'}
              </p>
              <div class="row"><button onclick={() => attempt(() => raid(sea!, world!))}>raid {port.name}</button></div>
            {/if}
            </details>
            {#if said}<p class="said">{said}</p>{/if}
            {:else}
              {@const here = sea.map.nodes[world.player]}
              <h2>{nodeName(world.player)}</h2>
              {#if atIsland(world)}
                <p>at anchor off an island nobody has charted: no ship troubles you here, the hull mends a point a day, and the crew take on fresh water.</p>
              {:else}
                <p>{here.kind === 'coast' || here.kind === 'passage' ? 'coastal water' : 'the open sea'}{here.waters ? `, in ${adjective(here.waters)} waters: their guard ships keep them` : ', nobody’s waters'}.</p>
              {/if}
              {#if here.strait}<p>in {here.strait}, where everything that passes is seen.</p>{/if}
              {#if here.shoal}<p class="faint">on {here.shoal}: too shallow for deep keels.</p>{/if}
              {#if here.river}<p class="faint">off the mouth of the {here.river}.</p>{/if}
              {#if here.guns}<p class="wanted">under the guns of {here.guns}.</p>{/if}
              <p class="faint">click the chart to set a course; ports are where the bar, the yard and raids are.</p>
              {#if said}<p class="said">{said}</p>{/if}
            {/if}
          {:else if tab === 'politics'}
                  <h3>at war</h3>
          <p>
            {#each enemiesOf(world.wars, YOUR_NATION) as n}<span class="chip"><Flag nation={n} />{nationName(n)}</span>{/each}
            {#if !enemiesOf(world.wars, YOUR_NATION).length}<span class="faint">England is at peace with everyone.</span>{/if}
          </p>
          {#if world.letter && !isEnemy(world.wars, world.letter.nation)}<p><span class="chip"><Flag nation={world.letter.nation} />{nationName(world.letter.nation)}</span> <span class="faint">at peace, but named in your letter</span></p>{/if}
          <p class="faint">their ships and towns are fair game; anyone else's, the Crown hears of.</p>
          {#each Object.entries(world.tension).filter(([, v]) => v) as [n, v]}
            <p class="wanted"><Flag nation={n as Nation} />the peace with {nationName(n as Nation)} is strained: {v} of {CASUS_BELLI}</p>
          {/each}
                  <h3>standing</h3>
          {#if !Object.values(world.standing).some((v) => v)}<p class="faint">nobody has reason to hunt you.</p>{/if}
          <ul class="plain">
            {#each Object.entries(world.standing).filter(([, v]) => v) as [n, v]}
              <li class:wanted={v! < 0}><Flag nation={n as Nation} />{adjective(n as Nation)}: {v! > 0 ? '+' : ''}{v}{v! < 0 ? ', and their guard ships are out' : ''}</li>
            {/each}
          </ul>
            <h3>your name</h3>
            <p>{RENOWN_WORDS[renown(world)]}{renown(world) ? ': hunters and privateers come farther for you, and better found.' : '.'}</p>
            {#if world.pirate}<p class="wanted">a pirate: English ports are shut to you and London would hang you, until you buy a pardon ({PARDON_COST}) in an English port.</p>{/if}
            <h3>the flags</h3>
            <ul class="key" aria-label="the nations' colours">
              {#each Object.keys(COLORS) as n}<li><Flag nation={n as Nation} size={12} />{adjective(n as Nation)}</li>{/each}
            </ul>
          {:else}
            <ShipSheet {sea} {world} act={attempt} />
          {/if}
        </div>
      </div>

      <aside>
        <details class="panel" open>
          <summary><h2>{nodeName(world.player)}</h2></summary>
          <Gauge label="hull" value={world.hull} max={world.maxHull} />
          <Gauge label="morale" value={world.morale} max={MORALE_MAX} />
          {#if world.morale <= 2}<p class="wanted">the crew are close to mutiny. a prize, a round ashore or fresh water would steady them.</p>{:else if world.turn - world.lastSpoils >= IDLE_DAYS}<p class="faint">{world.turn - world.lastSpoils} days since the last prize: the crew are souring.</p>{/if}
          <p>a {SHIP_CLASSES[world.outfit.ship].name}, {world.outfit.crew.length ? world.outfit.crew.map((c) => CREW[c].name).join(', ') : 'no hands of note'}</p>
          {#if wagesOf(world.outfit)}<p class="faint">wages {wagesOf(world.outfit)} every {WAGE_DAYS} days, next on day {(Math.floor(world.turn / WAGE_DAYS) + 1) * WAGE_DAYS + 1}</p>{/if}
          <div class="row"><button onclick={() => (tab = 'ship')}>ship &amp; crew · deck of {deckSize(world.outfit)}</button></div>
          {#if homeward(world)}<p class="wanted">homeward bound with the score: every enemy privateer is out for you.</p>{/if}
          {#if atIsland(world)}<p>at anchor off an uncharted isle: taking on water, mending the hull.</p>{/if}
          {#if world.pirate}<p class="wanted">a pirate. see politics.</p>{/if}
          {#if port}<p><button class="link" onclick={() => (tab = 'location')}>{port.name}: the bar, the yard, a raid</button></p>{/if}
        </details>

        <details class="panel" open>
          <summary><h2>course</h2></summary>
          {#if dest === null}
            <p class="faint">click the sea to set a course.</p>
          {:else}
            <p>for {nodeName(dest)}, {course.length - 1} days</p>
            <div class="row">
              {#if sailing}<button onclick={() => stop('hove to')}>heave to</button>{:else}<button onclick={setSail} disabled={course.length < 2}>set sail</button><button onclick={oneDay} disabled={course.length < 2}>one day</button>{/if}
              <button onclick={() => ((dest = null), stop())}>clear</button>
            </div>
          {/if}
        </details>


        <details class="panel" open>
          <summary><h2>your letter</h2></summary>
          {#if world.letter}
            {@const told = describeLetter(sea, world, world.letter)}
            <p><Flag nation={world.letter.nation} />{told.title}</p>
            <p>{told.task}</p>
            <p class:wanted={world.letter.deadline - world.turn <= 20} class:faint={world.letter.deadline - world.turn > 20}>{told.terms}</p>
          {:else if world.commission === 'done'}
            <p>every letter done. home to {HOME} and the run is won.</p>
          {:else if world.commission === 'revoked'}
            <p class="wanted">revoked: you sail without a letter, and whatever you take is piracy. a pardon in an English port would bring a new one; or retire rich, {GOAL}, in a pirate's haven.</p>
          {:else}
            <p class="faint">a run from before letters: bring {GOAL} home to {HOME}.</p>
          {/if}
        </details>

        <details class="panel" open>
          <summary><h2>in sight</h2></summary>
          {#if !inSight(sea, world).length}<p class="faint">nothing on the horizon.</p>{/if}
          <ul class="plain sightings">
            {#each inSight(sea, world) as x (x.ship.id)}
              {@const r = readShip(world, x.ship)}
              <li class:wanted={x.hostile}>
                <Flag nation={x.ship.nation} />{sailName(x.ship.kind, x.ship.nation)}, {x.days === 0 ? 'here' : `${x.days} ${x.days === 1 ? 'day' : 'days'} off`}{x.closing ? ', bearing down' : x.hostile ? ', hostile' : ''}
                <span class="faint">hull {r.hull} · {r.traits.join(' · ')}</span>
              </li>
            {/each}
          </ul>
        </details>

        <details class="panel" open>
          <summary><h2>rumors</h2></summary>
          {#if !world.rumors.length}<p class="faint">none worth the name. buy a round in port.</p>{/if}
          <ul class="rumors">
            {#each [...world.rumors].reverse() as r (r.id)}
              <li>
                <button class:focused={focus === r.id} onclick={() => (focus = focus === r.id ? null : r.id)}>
                  <Flag nation={r.nation} />{sailName(r.kind, r.nation)}, {ago(world.turn - r.turn)}
                  <span class="faint">· {Math.round(markerStrength(r, world.turn) * 100)}%</span>
                </button>
              </li>
            {/each}
          </ul>
        </details>



        {#if world.log.length}
          <details class="panel" open>
            <summary><h2>news</h2></summary>
            <ul class="plain">
              {#each world.log.slice(-6).reverse() as l}<li class:wanted={l.stop}><span class="faint">day {l.turn + 1}:</span> {l.text}</li>{/each}
            </ul>
          </details>
        {/if}
      </aside>
    </div>

    {#if intro}
      <div class="overlay">
        <div class="sheet intro">
          <h2>how to play</h2>
          <p>It is 16XX. You are a privateer out of Plymouth with a pinnace and 20 gold, and a letter of marque. <strong>Do the three letters the Crown sends you, come home to {HOME}, and the run is won.</strong> The gold you bring home is your score. Sink, and it is over.</p>
          <dl>
            <dt>sailing</dt>
            <dd>Click the sea to set a course, then set sail. The ship goes a day at a time, and heaves to when a ship comes alongside, when you sight land, or when there is news worth stopping for: a storm, a mutiny, a war.</dd>
            <dt>letters</dt>
            <dd>Each letter names a nation, a region, a task and a deadline: two prizes near home, then a town to sack farther out, then a Spanish plate ship, named, with word of where she is. The region is drawn on the chart. The letter's nation is fair game while it lasts, at war or not. Miss a deadline and the Admiralty grants more time once; miss it again and the letter is revoked, and you are a pirate.</dd>
            <dt>rumors</dt>
            <dd>Buy rounds in a port's bar and somebody may have seen a ship. Rumors show as rings that fade; pick one to see where her ship could be by now. The more of the current and wind you have seen, the tighter the guess.</dd>
            <dt>fair game</dt>
            <dd>England's enemies, listed under "at war", are fair game, and the Crown thinks the better of you for taking them. Anyone else's ships, the Crown hears of, and enough of that starts a war. Fire on an English ship and you are a pirate: London will hang you, but Port Royal and the Barbary coast will let you retire there, rich.</dd>
            <dt>fighting</dt>
            <dd>A fight is cards, yours and hers in one deck. Each round three are dealt: keep two, which play in the order you pick them; the third goes to the bottom. A hull at nothing is sunk; three way and a ship is away. Hover a card, or open "what the cards say", for what its words mean.</dd>
            <dt>in port</dt>
            <dd>Mend the hull, hire hands of note and buy refits and bigger ships. All of them change the cards you fight with. A port of a nation that wants you will not deal with you until its officials are paid.</dd>
            <dt>the crew</dt>
            <dd>Keep them in heart. A long stretch with no prize sours them, and at nothing it is mutiny. Prizes, a round ashore, fresh water and good omens all help.</dd>
          </dl>
          <p class="faint">The run saves as you go. The seed in the address plays the same world again.</p>
          <button onclick={closeIntro}>to sea</button>
        </div>
      </div>
    {:else if logOpen}
      {@const top = best(log)}
      <div class="overlay">
        <div class="sheet">
          <h2>logbook</h2>
          {#if !log.length}
            <p class="faint">no run has ended yet. every one that does is written here.</p>
          {:else}
            <p>your best: {top!.ending === 'home' || top!.ending === 'retired' ? `${top!.gold}, ${top!.ending === 'home' ? 'home to London' : 'retired'} on day ${top!.day}` : `letter ${top!.acts} of ${ACTS} done, ${top!.gold} gold`}{top!.daily ? `, on the voyage of ${top!.daily}` : ''}</p>
            <table class="logbook">
              <thead><tr><th>ended</th><th>how</th><th class="num">gold</th><th class="num">letters</th><th class="num">days</th><th>ship</th><th></th></tr></thead>
              <tbody>
                {#each log as e, i (i)}
                  <tr class:wanted={e.ending === 'sunk'}>
                    <td>{e.when}{e.daily ? ' · today’s voyage' : ''}</td>
                    <td>{e.ending === 'sunk' ? `sunk${e.sunkBy ? ` by ${e.sunkBy}` : ''}` : e.ending === 'home' ? 'home' : e.ending === 'retired' ? 'retired' : 'given up'}</td>
                    <td class="num">{e.gold}</td>
                    <td class="num">{e.acts}</td>
                    <td class="num">{e.day}</td>
                    <td>{e.ship}</td>
                    <td class="faint">seed {e.seed}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          {/if}
          <div class="row">
            <button onclick={() => (logOpen = false)}>close</button>
            {#if log.length}<button onclick={downloadLog}>download the logbook</button>{/if}
          </div>
          <p class="faint">today's voyage is the same world for everyone who sails it today: seed {dailySeed(today())}.</p>
        </div>
      </div>
    {:else if world.hail && !shown}
      {@const h = world.hail}
      {@const flagName = adjective(h.nation)}
      {@const what = h.kind === 'hunter' ? 'guard ship' : h.kind.replace('-', ' ')}
      <div class="overlay">
        <div class="sheet">
          <h2><Flag nation={h.nation} size={18} />{article(flagName)} {flagName} {what} alongside</h2>
          {#if world.ships.find((x) => x.id === h.shipId)}
            {@const r = readShip(world, world.ships.find((x) => x.id === h.shipId)!)}
            <p class="reading">hull {r.hull} to your {world.hull} · {r.traits.join(' · ')}{r.bounty ? ` · a price of ${r.bounty} on her` : ''}</p>
          {/if}
          {#if captivesOf(h.shipId)}{@const laden = captivesOf(h.shipId)!}<p>she's laden with {adjective(laden)} captives. take her and they go free, and the {adjective(laden)} and the Crown will think the better of you.</p>{/if}
          {#if h.nation === YOUR_NATION}
            <p class="wanted">she flies your flag. fire on her and you are a pirate: England will want you, its ports will shut, and London will hang you until you're pardoned.</p>
          {:else if isEnemy(world.wars, h.nation) || reprisal(world, h.nation)}
            <p>the {flagName} are at war with England: she's fair game, and the Crown will think the better of you for taking her. the {flagName} will remember it, and their guard ships will be out for you.</p>
          {:else}
            <p>the {flagName} are at peace with England. fire on her and the Crown will hear of it, and the {flagName} will remember it{h.nation === 'local' ? '' : ': their guard ships will be out for you'}.</p>
          {/if}
          <div class="row">
            <button onclick={() => (world = attack(world!))}>attack</button>
            <button onclick={() => (world = letPass(world!))}>let her pass</button>
          </div>
        </div>
      </div>
    {:else if shown}
      <div class="overlay">
        <div class="sheet">
          <Fight fight={shown} {lastRound} {reckoning} {title} {isRaid} nation={nation} {onact} {oncontinue} />
        </div>
      </div>
    {:else if world.spoil}
      <div class="overlay">
        <div class="sheet">
          <h2>her stores</h2>
          <p>take one into your deck for good, or leave them: every card you add is one more between you and the cards you want.</p>
          <div class="stores">
            {#each world.spoil.offers as key}
              <CardView card={{ id: key, side: 'ship', ...PLAYER_CARDS[key] }} order={null} onpick={() => attempt(() => takePrize(world!, key))} />
            {/each}
          </div>
          <div class="row"><button onclick={() => (world = leavePrize(world!))}>leave them</button></div>
          <p class="faint">your deck: {deckSize(world.outfit)} cards</p>
        </div>
      </div>
    {:else if world.dilemma}
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
    {:else if world.sunk || world.won}
      <div class="overlay">
        <div class="sheet">
          <h2>{world.ending === 'retired' ? 'retired' : world.won ? 'home' : 'lost with all hands'}</h2>
          <p>
            {world.ending === 'retired'
              ? `you retired to ${sea.map.nodes[world.player].port?.name} on day ${world.turn + 1} with ${world.gold}, a pirate rich enough to grow old.`
              : world.won
                ? `you came home to ${HOME} on day ${world.turn + 1} with ${world.gold}${world.commission === 'done' ? ', every letter done' : ''}.`
                : `the sea took you on day ${world.turn + 1}, ${world.gold} in the purse.`}
          </p>
          {#if world.sunk && world.lastFight}
            {@const f = world.lastFight}
            <h3>the last fight: {f.what}</h3>
            <p>you went in with {f.hullIn} hull of {f.maxHull}; she had {f.theirHull} of {f.theirMax} left at the end. it lasted {f.rounds} {f.rounds === 1 ? 'round' : 'rounds'}{f.woundsOnYou ? `, and ${f.woundsOnYou} ${f.woundsOnYou === 1 ? 'wound was' : 'wounds were'} still against you in the deck` : ''}.</p>
            <div class="rounds">
              {#each f.lastRounds as r (r.round)}
                <div>
                  <h4>round {r.round}</h4>
                  <ul class="plain">{#each r.lines as line}<li class:effect={line.startsWith('  ')}>{line.trim()}</li>{/each}</ul>
                </div>
              {/each}
            </div>
          {/if}
          <h3>the run</h3>
          <p>
            {world.tally.fights} {world.tally.fights === 1 ? 'fight' : 'fights'} · {world.tally.taken} taken · {world.tally.sacks} {world.tally.sacks === 1 ? 'town' : 'towns'} sacked · {world.tally.fled} times you got away · {world.tally.escaped} that got away from you
          </p>
          <p>letters done: {world.acts} of {ACTS} · ended in a {SHIP_CLASSES[world.outfit.ship].name}{world.tally.best ? ` · best prize: ${world.tally.best.what}, ${world.tally.best.payout}` : ''}</p>
          {#if best(log)}<p class="faint">your best: {best(log)!.ending === 'home' || best(log)!.ending === 'retired' ? `${best(log)!.gold}, won` : `letter ${best(log)!.acts} done, ${best(log)!.gold} gold`}.</p>{/if}
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
  main { max-width: 84rem; margin: 0 auto; padding: 1.25rem 16px 2rem; display: flex; flex-direction: column; gap: 1rem; }
  .loading { color: var(--faint); }
  h1 { margin: 0; font-size: 1.8rem; font-weight: 400; letter-spacing: -0.025em; }
  h2 { margin: 0 0 0.5rem; font-size: 1.1rem; font-weight: 400; }
  h3 { margin: 0.75rem 0 0.4rem; font-size: 0.95rem; font-weight: 400; color: var(--faint); }
  p { margin: 0.3rem 0; }
  .meta, .faint, .legend { color: var(--faint); }
  .legend { font-size: 0.8rem; }
  .key { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.2rem 0.9rem; font-size: 0.8rem; color: var(--faint); }
  .layout { display: grid; grid-template-columns: minmax(0, 1fr) 22rem; gap: 1.25rem; align-items: start; }
  .map { display: flex; flex-direction: column; gap: 0.5rem; height: min(78vh, 52rem); }
  .mapkeys { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .mapkeys button { padding: 0.25rem 0.7rem; }
  aside { display: flex; flex-direction: column; gap: 1.25rem; }
  aside .panel { border-top: 1px dashed var(--rule); padding-top: 0.75rem; }
  .row { display: flex; flex-direction: row; flex-wrap: wrap; gap: 0.4rem; margin: 0.4rem 0; }
  .row button, aside button { padding: 0.3rem 0.6rem; font-size: 0.9rem; }
  .said { font-style: italic; }
  .rumors, .plain { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.3rem; }
  .rumors button { width: 100%; border-color: var(--rule); }
  .rumors button.focused { border-color: var(--theirs); color: var(--theirs); }
  .wanted { color: var(--theirs); }
  .chip { display: inline-block; margin-right: 0.8rem; }
  .overlay { position: fixed; inset: 0; background: rgba(255, 255, 255, 0.92); display: grid; place-items: start center; overflow: auto; padding: 2rem 16px; }
  .choices { flex-direction: row; flex-wrap: wrap; gap: 0.75rem; margin-top: 0.75rem; }
  .choices li { display: flex; flex-direction: column; align-items: flex-start; gap: 0.25rem; flex: 1 1 12rem; max-width: 18rem; }
  .stores { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; margin: 1rem 0; }
  @media (max-width: 34rem) { .stores { grid-template-columns: 1fr; } }
  .sightings li { margin-top: 0.4rem; }
  .sightings .faint { display: block; font-size: 0.85rem; }
  .reading { color: var(--faint); }
  .tabs { display: flex; gap: 0; margin-top: 1.25rem; border-bottom: 1.5px solid var(--ink); }
  .tabs button { border: 1.5px solid var(--rule); border-bottom: none; margin-right: -1.5px; padding: 0.35rem 0.9rem; background: var(--paper); }
  .tabs button.current { border-color: var(--ink); position: relative; top: 1.5px; background: var(--paper); border-bottom: 1.5px solid var(--paper); }
  .tabpanel { padding: 1rem 0; }
  .tabpanel h2 { margin: 0 0 0.5rem; font-size: 1.3rem; font-weight: 400; letter-spacing: -0.025em; }
  .tabpanel h3 { margin: 1rem 0 0.4rem; font-size: 1.05rem; font-weight: 400; }
  .link { border: none; padding: 0; text-decoration: underline; background: none; }
  .panel > summary, .sub > summary { list-style: none; cursor: pointer; }
  .panel > summary::-webkit-details-marker, .sub > summary::-webkit-details-marker { display: none; }
  .panel > summary h2, .sub > summary h3 { display: inline; }
  .panel > summary::after, .sub > summary::after { content: ' +'; color: var(--faint); }
  .panel[open] > summary::after, .sub[open] > summary::after { content: ' −'; }
  .sub { margin-top: 0.6rem; }
  .shop { flex-direction: row; flex-wrap: wrap; gap: 0.6rem 0.75rem; margin-top: 0.4rem; }
  .shop li { display: flex; flex-direction: column; align-items: flex-start; gap: 0.2rem; flex: 0 1 14rem; }
  .shop .faint { font-size: 0.85rem; }
  .logbook { width: 100%; border-collapse: collapse; font-size: 0.9rem; margin: 0.75rem 0; }
  .logbook th, .logbook td { text-align: left; padding: 0.25rem 0.6rem 0.25rem 0; border-bottom: 1px dashed var(--rule); vertical-align: top; }
  .logbook th { font-weight: 400; color: var(--faint); }
  .logbook .num { text-align: right; font-variant-numeric: tabular-nums; }
  .rounds { display: flex; flex-direction: row; flex-wrap: wrap; gap: 1rem; }
  .rounds > div { flex: 1 1 14rem; }
  .rounds h4 { margin: 0 0 0.3rem; font-weight: 400; color: var(--faint); }
  .rounds .effect { padding-left: 1rem; color: var(--faint); }
  .chartbox { position: relative; }
  /* The banner: paper on the chart, ink-ruled, no shadow; ink on paper casts none. */
  .banner { position: absolute; top: 14px; left: 14px; right: 14px; max-width: 34rem; display: flex; align-items: flex-start; gap: 0.6rem; padding: 0.5rem 0.5rem 0.5rem 0.8rem; background: var(--paper); border: 1.5px solid var(--ink); animation: drop 0.25s ease-out; }
  .banner p { margin: 0; flex: 1; }
  .banner button { flex: none; width: 1.6rem; height: 1.6rem; padding: 0; display: grid; place-items: center; }
  @keyframes drop { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
  @media (prefers-reduced-motion: reduce) { .banner { animation: none; } }
  .intro dl { margin: 1rem 0; }
  .intro dt { margin-top: 0.75rem; }
  .intro dd { margin: 0.2rem 0 0; }
  .sheet { width: min(44rem, 100%); background: var(--paper); border: 1.5px solid var(--ink); padding: 1.25rem; }
  @media (max-width: 60rem) {
    .layout { grid-template-columns: 1fr; }
    .map { height: 60vh; }
  }
</style>
