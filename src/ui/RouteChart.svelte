<script lang="ts">
  /**
   * The chart of the whole voyage, fixed: the world's coasts, the way from
   * landmark to landmark along the lanes, where you've been, and the ship.
   * Nothing to pan or zoom; everything that matters is always in view.
   */
  import coast from '../world/data/coast.json';
  import { FAR, type NodeId } from '../world/map.ts';
  import { HOME_LANDMARK, LANDMARKS } from '../world/landmarks.ts';
  import { choices } from '../world/journey.ts';
  import { DETOUR_KEYS, followed } from '../world/rumors.ts';
  import type { Sea, WorldState } from '../world/world.ts';
  import { SHIP } from './woodcut.ts';

  let { sea, world }: { sea: Sea; world: WorldState } = $props();

  // The world from 180°W to 180°E, and from the Arctic to below the Horn.
  const [W, E, N, S] = [-180, 180, 72, -60];
  const X = (lon: number) => lon;
  const Y = (lat: number) => -lat;

  let width = $state(900);
  /** Degrees a screen pixel covers: glyphs and type are sized by it. */
  const px = $derived((E - W) / Math.max(320, width));

  // The coast, drawn once, coarse enough for a chart of the world.
  const coastPath = (() => {
    let d = '';
    for (const r of coast.rings as number[][]) {
      let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
      for (let i = 0; i < r.length; i += 2) [w, s, e, n] = [Math.min(w, r[i]), Math.min(s, r[i + 1]), Math.max(e, r[i]), Math.max(n, r[i + 1])];
      if (e - w < 0.8 && n - s < 0.8) continue;
      let [lx, ly] = [r[0], r[1]];
      d += `M${lx.toFixed(1)},${(-ly).toFixed(1)}`;
      for (let i = 2; i < r.length; i += 2) {
        if (Math.abs(r[i] - lx) < 0.35 && Math.abs(r[i + 1] - ly) < 0.35) continue;
        [lx, ly] = [r[i], r[i + 1]];
        d += `L${lx.toFixed(1)},${(-ly).toFixed(1)}`;
      }
      d += 'Z';
    }
    return d;
  })();

  /** A leg's way along the lanes, as a path broken where it crosses the edge of the chart. */
  function legPath(a: NodeId, b: NodeId): string {
    const map = sea.map;
    const d = map.distTo(b);
    if (d[a] >= FAR) return '';
    let at = a;
    let path = `M${X(map.nodes[at].lon)},${Y(map.nodes[at].lat)}`;
    for (let guard = 0; at !== b && guard < 2000; guard++) {
      const next = map.adj[at].find((m) => d[m] === d[at] - 1);
      if (next === undefined) break;
      const [p, q] = [map.nodes[at], map.nodes[next]];
      path += `${Math.abs(q.lon - p.lon) > 180 ? 'M' : 'L'}${X(q.lon)},${Y(q.lat)}`;
      at = next;
    }
    return path;
  }

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
</script>

<div class="chart" bind:clientWidth={width}>
  <svg viewBox="{W} {-N} {E - W} {N - S}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="the chart of the voyage">
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
      <circle cx={X(n.lon)} cy={Y(n.lat)} r={px * (next ? 4.5 : 3)} fill={been ? 'var(--ink)' : 'var(--paper)'} stroke="var(--ink)" stroke-width="1.2" vector-effect="non-scaling-stroke" />
      {#if been || next || width > 700}
        <text x={X(n.lon) + px * 6} y={Y(n.lat) + px * 4} font-size={px * 11} font-style="italic" fill="var(--ink)" fill-opacity={been || next ? 1 : 0.6}>{l.name}</text>
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
