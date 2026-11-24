<script lang="ts">
  /**
   * The chart of the whole voyage, fixed: the world's coasts, the way from
   * landmark to landmark along the lanes, where you've been, and the ship.
   * Nothing to pan or zoom; everything that matters is always in view.
   */
  import type { NodeId } from '../world/map.ts';
  import { BOUNDS, X, Y, coastPath, legPath as chartLeg } from './chart.ts';
  import { HOME_LANDMARK, LANDMARKS } from '../world/landmarks.ts';
  import { choices } from '../world/journey.ts';
  import { DETOUR_KEYS, followed } from '../world/rumors.ts';
  import type { Sea, WorldState } from '../world/world.ts';
  import { SHIP } from './woodcut.ts';
  import type { Grave } from '../world/hands.ts';
  import { LABEL_FONT, layoutLabels, shortName } from '../world/labels.ts';
  import { chartSummary } from './access.ts';

  let { sea, world, graves = [] }: { sea: Sea; world: WorldState; graves?: Grave[] } = $props();

  const { W, E, N, S } = BOUNDS;

  let width = $state(900);
  /** Degrees a screen pixel covers: glyphs and type are sized by it. */
  const px = $derived((E - W) / Math.max(320, width));

  const legPath = (a: NodeId, b: NodeId) => chartLeg(sea.map, a, b);

  /** Every leg of the voyage, from each landmark to each that follows it; and each detour's ways in and out, marked with it. */
  const legs = (() => {
    const out: { from: string; to: string; d: string; detour: string | null }[] = [];
    const leg = (a: string, b: string, detour: string | null) => out.push({ from: a, to: b, d: legPath(sea.map.landmarks[a], sea.map.landmarks[b]), detour });
    for (const l of LANDMARKS) {
      if (l.landfall) continue;
      for (const k of l.next) leg(l.key, k, l.detour ? l.key : null);
      for (const k of l.detour?.from ?? []) leg(k, l.key, l.key);
    }
    return out;
  })();
  /** Detours you know of: the ones you mean to follow, and the ones you've sailed. Only those are drawn. */
  const known = $derived(new Set([...followed(world), ...world.voyage.visited.filter((k) => DETOUR_KEYS.includes(k))]));

  /** The legs you've sailed: each landmark raised after the one before. */
  const sailed = $derived.by(() => {
    const v = world.voyage.visited;
    const done = new Set<string>();
    for (let i = 1; i < v.length; i++) done.add(`${v[i - 1]}>${v[i]}`);
    return done;
  });
  const ahead = $derived(new Set(choices(world.voyage, followed(world))));
  /** The leg you're on now, if you've chosen one. */
  const onLeg = $derived(world.voyage.bound ? `${world.voyage.at}>${world.voyage.bound}` : '');
  /** The way home from here, when you've turned for it: not a leg of the chain, so drawn on its own. */
  const homeward = $derived(world.voyage.bound === HOME_LANDMARK && !LANDMARKS.find((l) => l.key === world.voyage.at)?.next.includes(HOME_LANDMARK) ? legPath(world.player, sea.map.landmarks[HOME_LANDMARK]) : '');

  /** The landmarks drawn: the way's, the detours you know of, and the islands a storm has put you on. */
  const shown = $derived(LANDMARKS.filter((l) => l.key !== HOME_LANDMARK && l.key !== 'strait-east' && (l.detour ? known.has(l.key) : l.landfall ? world.seen.includes(l.key) : true)));
  /** Lying at an island a storm put you on: the way from it to where you're bound. */
  const fromIsland = $derived(world.landfall && sea.map.landmarks[world.landfall] === world.player && world.voyage.bound ? legPath(world.player, sea.map.landmarks[world.voyage.bound]) : '');
  const ship = $derived(sea.map.nodes[world.player]);

  /** The names, set where none falls on another: where you are and might go next first, then where you've been, latest first. See labels.ts. */
  const names = $derived(
    layoutLabels(
      shown
        .filter((l) => world.voyage.visited.includes(l.key) || ahead.has(l.key) || width > 700)
        .map((l) => {
          const n = sea.map.nodes[sea.map.landmarks[l.key]];
          const been = world.voyage.visited.indexOf(l.key);
          const priority = l.key === world.voyage.at || ahead.has(l.key) ? 3 : been >= 0 ? 2 + been / 100 : l.detour || l.landfall ? 1 : 0;
          return { key: l.key, x: X(n.lon), y: Y(n.lat), name: l.name, short: shortName(l.name), priority };
        }),
      px,
      [W, -N, E, -S],
      LABEL_FONT,
      shown.map((l) => {
        const n = sea.map.nodes[sea.map.landmarks[l.key]];
        return { key: l.key, x: X(n.lon), y: Y(n.lat) };
      }),
    ),
  );
</script>

<div class="chart" bind:clientWidth={width}>
  <svg viewBox="{W} {-N} {E - W} {N - S}" preserveAspectRatio="xMidYMid meet" role="img" aria-label={chartSummary(sea, world)}>
    <rect x={W} y={-N} width={E - W} height={N - S} fill="var(--sea)" />
    <path d={coastPath} fill="var(--land)" stroke="var(--sepia)" stroke-width="0.6" vector-effect="non-scaling-stroke" stroke-linejoin="round" />

    <!-- The way: every leg dotted, the ones ahead darker, the ones sailed in ink. -->
    {#each legs.filter((l) => !l.detour || known.has(l.detour)) as leg (`${leg.from}>${leg.to}`)}
      {@const key = `${leg.from}>${leg.to}`}
      {@const done = sailed.has(key)}
      {@const now = key === onLeg}
      {@const next = leg.from === world.voyage.at && ahead.has(leg.to)}
      <path
        d={leg.d}
        fill="none"
        stroke={done || now ? 'var(--ink)' : 'var(--sepia)'}
        stroke-opacity={done || now ? 1 : next ? 0.75 : 0.35}
        stroke-width={done ? 1.8 : now ? 1.4 : 1}
        stroke-dasharray={done ? 'none' : '2 3'}
        vector-effect="non-scaling-stroke"
        stroke-linecap="round"
      />
    {/each}
    {#if fromIsland}<path d={fromIsland} fill="none" stroke="var(--ink)" stroke-width="1.4" stroke-dasharray="2 3" vector-effect="non-scaling-stroke" />{/if}
    {#if homeward}<path d={homeward} fill="none" stroke="var(--ink)" stroke-width="1.4" stroke-dasharray="2 3" vector-effect="non-scaling-stroke" />{/if}

    <!-- The landmarks: raised ones filled, the next ones ringed, all named. -->
    {#each shown as l (l.key)}
      {@const n = sea.map.nodes[sea.map.landmarks[l.key]]}
      {@const been = world.voyage.visited.includes(l.key)}
      {@const next = ahead.has(l.key)}
      <circle cx={X(n.lon)} cy={Y(n.lat)} r={px * (next ? 4.5 : 3)} fill={been ? 'var(--ink)' : 'var(--paper)'} stroke="var(--ink)" stroke-width="1.2" vector-effect="non-scaling-stroke"><title>{l.name}</title></circle>
    {/each}
    {#each names as t (t.key)}
      {@const strong = world.voyage.visited.includes(t.key) || ahead.has(t.key)}
      <text x={t.x} y={t.y} text-anchor={t.anchor} font-size={px * LABEL_FONT} font-style="italic" fill="var(--ink)" fill-opacity={strong ? 1 : 0.6}>{t.text}</text>
    {/each}

    <!-- Graves from voyages before: a small cross where each lies. -->
    {#each graves as g (g.id)}
      {@const n = sea.map.nodes[g.node]}
      {#if n}
        <path d="M{X(n.lon)},{Y(n.lat) - px * 4}V{Y(n.lat) + px * 4}M{X(n.lon) - px * 2.5},{Y(n.lat) - px * 1.5}H{X(n.lon) + px * 2.5}" stroke="var(--sepia)" stroke-width="1.2" vector-effect="non-scaling-stroke"><title>{g.name}, {g.title}, {g.date}</title></path>
      {/if}
    {/each}

    <!-- You. -->
    <g transform="translate({X(ship.lon)} {Y(ship.lat) - px * 4}) scale({px * 1.2})" stroke-linejoin="round">
      <path d={SHIP.masts} stroke="var(--ink)" stroke-width="1.2" />
      <path d={SHIP.sails} fill="var(--paper)" stroke="var(--ink)" stroke-width="1.2" />
      <path d={SHIP.pennant} fill="var(--theirs)" stroke="var(--ink)" stroke-width="0.5" />
      <path d={SHIP.hull} fill="var(--ink)" stroke="var(--ink)" stroke-width="1" />
    </g>
  </svg>
</div>

<style>
  .chart { width: 100%; border: 1.5px solid var(--ink); background: var(--sea); }
  svg { display: block; width: 100%; height: auto; }
  text { font-family: inherit; }
</style>
