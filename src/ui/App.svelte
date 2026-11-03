<script lang="ts">
  import { onDestroy } from 'svelte';
  import { act, type Action, type EncounterState, type GameEvent } from '../rules.ts';
  import { CREW, MIN_DECK, PLAYER_CARDS, SHIP_CLASSES, STRIKE_COST, UPGRADES, WAGE_DAYS, cardsOf, deckSize, wagesOf } from '../outfit.ts';
  import { buyRound, ROUND_COST } from '../world/bar.ts';
  import { plotCourse, sailToward } from '../world/course.ts';
  import type { NodeId } from '../world/map.ts';
  import { attack, fight, GUARD_HULL, GUARD_RELIEF, guardOf, letPass, onGuard, treasury, TREASURY_REFILL, raid, raidable, repair, REPAIR_COST, YOUR_NATION, type Reckoning } from '../world/meet.ts';
  import { CASUS_BELLI, enemiesOf, isEnemy } from '../world/wars.ts';
  import { TARGETS } from '../setup.ts';
  import { SEASON_NAMES } from '../world/ocean.ts';
  import { bribe, bribeCost, buyPardon, buyShip, buyUpgrade, dismiss, isHaven, leavePrize, PARDON_COST, strikable, strikeCard, takePrize, PROVISION_CHEER, PROVISION_COST, PROVISION_HULL, provision, provisions, recruit, retire, serves } from '../world/port.ts';
  import { IDLE_DAYS, MORALE_MAX } from '../world/events.ts';
  import { inSight, lookout, readShip } from '../world/scout.ts';
  import { choices, choose, describe as describeDilemma } from '../world/dilemmas.ts';
  import CardView from './CardView.svelte';
  import { explainCard } from '../describe.ts';
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
  import { forget, load, store } from '../save.ts';

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
    if (confirm('give up this run and start another?')) newRun();
  }

  // Saved after every change; a finished run is forgotten, so the next visit starts afresh.
  $effect(() => {
    if (!world) return;
    if (world.sunk || world.won) forget();
    else store(seed, world);
  });

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
    sailing = true;
    halted = '';
    timer ??= setInterval(day, 140);
  }
  function stop(why = '') {
    sailing = false;
    halted = why;
    if (timer) clearInterval(timer);
    timer = null;
  }
  function day() {
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
    lastRound = next.events.slice(before).filter((e) => e.type === 'played' || e.type === 'effect' || e.type === 'rejected');
    world = fight(sea, world, a);
    shown = next;
    if (next.outcome) reckoning = world.reckoning;
  }
  function oncontinue() {
    shown = null;
    reckoning = null;
  }

  // --- In port ---------------------------------------------------------------

  let said = $state('');
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

  function newRun() {
    stop();
    seed = Math.floor(Math.random() * 2 ** 31);
    world = createWorld(sea!, seed);
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

{#if !sea || !world}
  <main class="loading"><p>charting the seas…</p></main>
{:else}
  {@const port = sea.map.nodes[world.player].port}
  <main>
    <header>
      <h1>privateer</h1>
      <p class="meta">
        day {world.turn + 1}, {SEASON_NAMES[Math.floor(world.turn / sea.pattern.seasonLength) % 4]} ·
        {world.gold} gold of {GOAL} to bring home to {HOME} · seed {seed}
        {#if world.pirate}<span class="wanted"> · a pirate</span>{/if}
      </p>
      <div class="row">
        <button onclick={() => (intro = true)}>how to play</button>
        <button onclick={abandon}>a new run</button>
      </div>
    </header>

    <div class="layout">
      <div class="map">
        <SeaChart bind:this={chart} {sea} {world} {course} {cloud} {focus} {visible} onpick={(n) => ((dest = n), (halted = ''))} />
        <div class="mapkeys">
          <button onclick={() => chart?.zoom(1 / 1.4)} aria-label="zoom in">+</button>
          <button onclick={() => chart?.zoom(1.4)} aria-label="zoom out">−</button>
          <button onclick={() => chart?.recentre()}>find the ship</button>
        </div>
        <p class="legend">blue: the current a step out · dashed grey: this season's wind · rings: rumors, in the ship's colours, fading · red cloud: where the selected one's ship could be by now · squares are fortified ports, circles open towns, triangles ships</p>
        <ul class="key" aria-label="the nations' colours">
          {#each Object.keys(COLORS) as n}<li><Flag nation={n as Nation} size={12} />{adjective(n as Nation)}</li>{/each}
        </ul>
      </div>

      <aside>
        <section>
          <h2>{nodeName(world.player)}</h2>
          <Gauge label="hull" value={world.hull} max={world.maxHull} />
          <Gauge label="morale" value={world.morale} max={MORALE_MAX} />
          {#if world.morale <= 2}<p class="wanted">the crew are close to mutiny. a prize, a round ashore or fresh water would steady them.</p>{:else if world.turn - world.lastSpoils >= IDLE_DAYS}<p class="faint">{world.turn - world.lastSpoils} days since the last prize: the crew are souring.</p>{/if}
          <p>a {SHIP_CLASSES[world.outfit.ship].name}, {world.outfit.crew.length ? world.outfit.crew.map((c) => CREW[c].name).join(', ') : 'no hands of note'}</p>
          {#if wagesOf(world.outfit)}<p class="faint">wages {wagesOf(world.outfit)} every {WAGE_DAYS} days, next on day {(Math.floor(world.turn / WAGE_DAYS) + 1) * WAGE_DAYS + 1}</p>{/if}
          <details class="deck">
            <summary>your deck: {deckSize(world.outfit)} cards</summary>
            <ul class="plain">
              {#each Object.entries(cardsOf(world.outfit)) as [key, n]}
                <li title={explainCard(PLAYER_CARDS[key].text)}>
                  {PLAYER_CARDS[key].name} <span class="faint">{PLAYER_CARDS[key].text}{n > 1 ? ` · ×${n}` : ''}</span>
                  {#if port && serves(sea, world)}<button class="strike" onclick={() => attempt(() => strikeCard(sea!, world!, key), `${PLAYER_CARDS[key].name} struck from the deck`)} disabled={!strikable(sea, world, key)}>strike ({STRIKE_COST})</button>{/if}
                </li>
              {/each}
            </ul>
            <p class="faint">{port && serves(sea, world) ? `a yard will strike a card for ${STRIKE_COST}, down to ${MIN_DECK} cards: a thinner deck deals what you want more often.` : 'a yard in port will strike cards out of it.'}</p>
          </details>
          <p class="faint">your name: {RENOWN_WORDS[renown(world)]}{renown(world) ? ', and the hunters come farther for it' : ''}</p>
          {#if homeward(world)}<p class="wanted">homeward bound with the score: every enemy privateer is out for you.</p>{/if}
          <p class="faint">sight {world.sight} · {world.outfit.upgrades.length ? world.outfit.upgrades.map((u) => UPGRADES[u].name).join(', ') : 'no refits'}</p>
          {#if atIsland(world)}<p>at anchor off an uncharted isle: taking on water, mending the hull.</p>{/if}
          {#if world.pirate}<p class="wanted">a pirate: English ports are shut to you and London would hang you, until you buy a pardon ({PARDON_COST}) in an English port.</p>{/if}
        </section>

        <section>
          <h2>course</h2>
          {#if dest === null}
            <p class="faint">click the sea to set a course.</p>
          {:else}
            <p>for {nodeName(dest)}, {course.length - 1} days</p>
            <div class="row">
              {#if sailing}<button onclick={() => stop('hove to')}>heave to</button>{:else}<button onclick={setSail} disabled={course.length < 2}>set sail</button><button onclick={oneDay} disabled={course.length < 2}>one day</button>{/if}
              <button onclick={() => ((dest = null), stop())}>clear</button>
            </div>
          {/if}
          {#if halted}<p class="said">{halted}</p>{/if}
        </section>

        {#if port}
          <section>
            <h2><Flag nation={port.nation} />{port.name}, {adjective(port.nation)}</h2>
            {#if isHaven(sea, world)}
              <p>a pirate's haven: they'll deal with you here, whoever wants you, and you can retire here when you're rich.</p>
              <button onclick={() => attempt(() => retire(sea!, world!))} disabled={world.gold < GOAL}>retire here ({world.gold} of {GOAL})</button>
            {/if}
            {#if port.nation === 'native'}
              <p>islanders: no bar, no yard, no hands to hire, but water, fruit and timber in trade, for the crew and the ship.</p>
              {#if (world.standing.native ?? 0) < 0}
                <p class="wanted">they remember what you did here, and won't trade.</p>
                <button onclick={() => attempt(() => bribe(sea!, world!), 'gifts accepted')}>make them gifts ({bribeCost(world, 'native')})</button>
              {:else}
                <button onclick={() => attempt(() => provision(sea!, world!))} disabled={!provisions(sea, world)}>trade for provisions ({PROVISION_COST}): morale +{PROVISION_CHEER}, hull +{PROVISION_HULL}</button>
              {/if}
            {:else if world.pirate && port.nation === YOUR_NATION && !isHaven(sea, world)}
              <p>they know you for a pirate here.</p>
              <button onclick={() => attempt(() => buyPardon(sea!, world!), 'pardoned, at a price')}>buy a royal pardon ({PARDON_COST})</button>
            {:else if !serves(sea, world)}
              <p>the {adjective(port.nation)} won't deal with you.</p>
              <button onclick={() => attempt(() => bribe(sea!, world!), 'the right palms are greased')}>bribe the officials ({bribeCost(world, port.nation)})</button>
            {:else}
              <h3>the bar</h3>
              <button onclick={round}>buy a round ({ROUND_COST})</button>
              <div class="list">
                {#each Object.entries(CREW).filter(([k]) => !world!.outfit.crew.includes(k)) as [key, c]}
                  <button onclick={() => attempt(() => recruit(sea!, world!, key), `the ${c.name} signs on`)}>hire a {c.name} ({c.cost})</button>
                {/each}
                {#each world.outfit.crew as key}
                  <button onclick={() => attempt(() => dismiss(world!, key), `the ${CREW[key].name} goes ashore`)}>let the {CREW[key].name} go</button>
                {/each}
              </div>
              <h3>the yard</h3>
              {#if world.hull < world.maxHull}
                <button onclick={() => attempt(() => repair(sea!, world!), 'the carpenters are paid')}>repair ({REPAIR_COST} a point)</button>
              {/if}
              <div class="list">
                {#each Object.entries(UPGRADES) as [key, u]}
                  <button onclick={() => attempt(() => buyUpgrade(sea!, world!, key), `${u.name} fitted`)}>{u.name} ({u.cost})</button>
                {/each}
                {#each Object.entries(SHIP_CLASSES).filter(([k]) => k !== world!.outfit.ship && k !== 'pinnace') as [key, c]}
                  <button onclick={() => attempt(() => buyShip(sea!, world!, key), `you take command of a ${c.name}`)}>a {c.name}: hull {c.hull}, {c.berths} berths ({c.cost})</button>
                {/each}
              </div>
              {#if (world.standing[port.nation] ?? 0) < 0}
                <button onclick={() => attempt(() => bribe(sea!, world!), 'the right palms are greased')}>bribe the officials ({bribeCost(world, port.nation)})</button>
              {/if}
            {/if}
            <h3>a raid</h3>
            {#if (world.sacked[world.player] ?? -1) >= world.turn}
              <p class="faint">sacked lately: there's nothing left here.</p>
            {:else if onGuard(world, world.player)}
              <p class="faint">on its guard after your last raid: the boats would never get ashore. shut till day {guardOf(world, world.player)!.shutUntil + 1}.</p>
            {:else}
              {#if guardOf(world, world.player)}{@const guard = guardOf(world, world.player)!}<p class="wanted">on its guard since your last raid: walls {GUARD_HULL * guard.level} stronger, its relief {GUARD_RELIEF * guard.level} rounds sooner, and {treasury(world, world.player, port.fort ? 'fortress' : 'town')} in the treasury, filling again by {TREASURY_REFILL} a day. on its guard till day {guard.until + 1}.</p>{/if}
              <p class="faint">
                {port.fort ? 'a fortified port: not for a small ship.' : 'an open town.'}
                the {adjective(port.nation)} will remember it three times over and their guard ships will hunt twice as far.
                {port.nation === YOUR_NATION ? ' it is your own flag: you would be a pirate.' : isEnemy(world.wars, port.nation) ? ' they are at war with England: fair game.' : ' they are at peace with England: the Crown will hear of it.'}
              </p>
              <button onclick={() => attempt(() => raid(sea!, world!))}>raid {port.name}</button>
            {/if}
            {#if said}<p class="said">{said}</p>{/if}
          </section>
        {/if}

        <section>
          <h2>in sight</h2>
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
        </section>

        <section>
          <h2>rumors</h2>
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
        </section>

        <section>
          <h2>at war</h2>
          <p>
            {#each enemiesOf(world.wars, YOUR_NATION) as n}<span class="chip"><Flag nation={n} />{nationName(n)}</span>{/each}
            {#if !enemiesOf(world.wars, YOUR_NATION).length}<span class="faint">England is at peace with everyone.</span>{/if}
          </p>
          <p class="faint">their ships and towns are fair game; anyone else's, the Crown hears of.</p>
          {#each Object.entries(world.tension).filter(([, v]) => v) as [n, v]}
            <p class="wanted"><Flag nation={n as Nation} />the peace with {nationName(n as Nation)} is strained: {v} of {CASUS_BELLI}</p>
          {/each}
        </section>

        <section>
          <h2>standing</h2>
          {#if !Object.values(world.standing).some((v) => v)}<p class="faint">nobody has reason to hunt you.</p>{/if}
          <ul class="plain">
            {#each Object.entries(world.standing).filter(([, v]) => v) as [n, v]}
              <li class:wanted={v! < 0}><Flag nation={n as Nation} />{adjective(n as Nation)}: {v! > 0 ? '+' : ''}{v}{v! < 0 ? ', and their guard ships are out' : ''}</li>
            {/each}
          </ul>
        </section>

        {#if world.log.length}
          <section>
            <h2>news</h2>
            <ul class="plain">
              {#each world.log.slice(-6).reverse() as l}<li class:wanted={l.stop}><span class="faint">day {l.turn + 1}:</span> {l.text}</li>{/each}
            </ul>
          </section>
        {/if}
      </aside>
    </div>

    {#if intro}
      <div class="overlay">
        <div class="sheet intro">
          <h2>how to play</h2>
          <p>It is 16XX. You are a privateer out of Plymouth with a pinnace and 20 gold. <strong>Bring {GOAL} home to {HOME} and the run is won.</strong> Sink, and it is over.</p>
          <dl>
            <dt>sailing</dt>
            <dd>Click the sea to set a course, then set sail. The ship goes a day at a time, and heaves to when a ship comes alongside, when you sight land, or when there is news worth stopping for: a storm, a mutiny, a war.</dd>
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
          {:else if isEnemy(world.wars, h.nation)}
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
                ? `you came home to ${HOME} on day ${world.turn + 1} with ${world.gold}.`
                : `the sea took you on day ${world.turn + 1}, ${world.gold} in the purse.`}
          </p>
          <button onclick={newRun}>a new run</button>
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
  .mapkeys { display: flex; gap: 0.5rem; }
  .mapkeys button { padding: 0.25rem 0.7rem; }
  aside { display: flex; flex-direction: column; gap: 1.25rem; }
  aside section { border-top: 1px dashed var(--rule); padding-top: 0.75rem; }
  .row, .list { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .list button, .row button, aside button { padding: 0.3rem 0.6rem; font-size: 0.9rem; }
  .said { font-style: italic; }
  .rumors, .plain { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.3rem; }
  .rumors button { width: 100%; border-color: var(--rule); }
  .rumors button.focused { border-color: var(--theirs); color: var(--theirs); }
  .wanted { color: var(--theirs); }
  .chip { display: inline-block; margin-right: 0.8rem; }
  .overlay { position: fixed; inset: 0; background: rgba(255, 255, 255, 0.92); display: grid; place-items: start center; overflow: auto; padding: 2rem 16px; }
  .choices li { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.3rem 0.75rem; margin-top: 0.6rem; }
  .stores { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; margin: 1rem 0; }
  @media (max-width: 34rem) { .stores { grid-template-columns: 1fr; } }
  .deck summary { cursor: pointer; }
  .deck li { margin-top: 0.3rem; }
  .strike { margin-left: 0.4rem; padding: 0.1rem 0.4rem; font-size: 0.8rem; }
  .sightings li { margin-top: 0.4rem; }
  .sightings .faint { display: block; font-size: 0.85rem; }
  .reading { color: var(--faint); }
  .intro dl { margin: 1rem 0; }
  .intro dt { margin-top: 0.75rem; }
  .intro dd { margin: 0.2rem 0 0; }
  .sheet { width: min(44rem, 100%); background: var(--paper); border: 1.5px solid var(--ink); padding: 1.25rem; }
  @media (max-width: 60rem) {
    .layout { grid-template-columns: 1fr; }
    .map { height: 60vh; }
  }
</style>
