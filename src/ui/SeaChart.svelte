<script lang="ts">
  import coast from '../world/data/coast.json';
  import type { NodeId } from '../world/map.ts';
  import { markerStrength } from '../world/rumors.ts';
  import type { Sea } from '../world/ships.ts';
  import type { WorldState } from '../world/world.ts';

  let {
    sea,
    world,
    course,
    cloud,
    focus,
    visible,
    onpick,
  }: {
    sea: Sea;
    world: WorldState;
    /** The course set, from here. */
    course: NodeId[];
    /** The selected rumor's prediction: node and probability. */
    cloud: { node: NodeId; p: number }[];
    /** The selected rumor, by id. */
    focus: number | null;
    /** Ships you can see. */
    visible: number[];
    onpick: (node: NodeId) => void;
  } = $props();

  // The sea never changes under a chart; only the world on it does.
  const map = $derived(sea.map);
  const pattern = $derived(sea.pattern);
  const here = () => map.nodes[world.player];

  let width = $state(800);
  let height = $state(500);
  const start = () => ({ lon: here().lon, lat: here().lat });
  let center = $state(start());
  /** Degrees across. */
  let span = $state(36);
  const tall = $derived((span * height) / width);
  /** Degrees per pixel: for sizes that should stay the same on screen. */
  const px = $derived(span / width);

  /** A longitude moved to the copy of the world nearest the middle of the view. */
  const X = (lon: number) => lon + 360 * Math.round((center.lon - lon) / 360);
  const Y = (lat: number) => -lat;

  // Three copies of the coast, so the dateline can be panned across.
  const coastPaths = [-360, 0, 360].map((dx) =>
    (coast.rings as number[][])
      .map((r) => {
        let d = '';
        for (let i = 0; i < r.length; i += 2) d += `${i ? 'L' : 'M'}${(r[i] + dx).toFixed(2)},${(-r[i + 1]).toFixed(2)}`;
        return d + 'Z';
      })
      .join(''),
  );

  export function recentre() {
    center = { lon: here().lon, lat: here().lat };
  }

  // Panning by drag; a click that didn't move picks a destination.
  let drag: { x: number; y: number; lon: number; lat: number; moved: boolean } | null = null;
  function down(e: PointerEvent) {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag = { x: e.clientX, y: e.clientY, lon: center.lon, lat: center.lat, moved: false };
  }
  function move(e: PointerEvent) {
    if (!drag) return;
    const [dx, dy] = [e.clientX - drag.x, e.clientY - drag.y];
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    center = { lon: drag.lon - dx * px, lat: Math.max(-70, Math.min(80, drag.lat + dy * px)) };
  }
  function up(e: PointerEvent) {
    const was = drag;
    drag = null;
    if (!was || was.moved) return;
    const rect = (e.currentTarget as Element).getBoundingClientRect();
    const lon = center.lon - span / 2 + (e.clientX - rect.left) * px;
    const lat = center.lat + tall / 2 - (e.clientY - rect.top) * px;
    // Nearest real node: not one a day along a longer leg.
    let best = -1;
    let bestD = Infinity;
    for (const n of map.nodes) {
      if (n.kind === 'underway') continue;
      const d = Math.hypot((((n.lon - lon + 540) % 360) - 180) * Math.cos((lat * Math.PI) / 180), n.lat - lat);
      if (d < bestD) [best, bestD] = [n.id, d];
    }
    if (bestD < 3) onpick(best);
  }
  function wheel(e: WheelEvent) {
    e.preventDefault();
    span = Math.max(6, Math.min(360, span * (e.deltaY > 0 ? 1.15 : 1 / 1.15)));
  }
  export function zoom(by: number) {
    span = Math.max(6, Math.min(360, span * by));
  }

  const ports = $derived(map.nodes.filter((n) => n.port));
  const ARROW = 18; // px
  const arrow = (n: NodeId, v: [number, number], scale = 1) => {
    const len = Math.hypot(...v);
    const k = (ARROW * px * Math.min(1.5, len)) / (len || 1) * scale;
    const [x, y] = [X(map.nodes[n].lon), Y(map.nodes[n].lat)];
    return { x1: x, y1: y, x2: x + v[0] * k, y2: y - v[1] * k, len };
  };
  const season = $derived(Math.floor(world.turn / pattern.seasonLength) % 4);
  const neighbours = $derived([world.player, ...map.adj[world.player]]);
</script>

<div class="chart" bind:clientWidth={width} bind:clientHeight={height}>
  <svg
    viewBox="{center.lon - span / 2} {-center.lat - tall / 2} {span} {tall}"
    width={width}
    height={height}
    role="application"
    aria-label="the chart: drag to pan, wheel to zoom, click the sea to set a course"
    onpointerdown={down}
    onpointermove={move}
    onpointerup={up}
    onwheel={wheel}
  >
    <rect x={center.lon - span} y={-center.lat - tall} width={span * 2} height={tall * 2} fill="var(--paper)" />
    {#each coastPaths as d}<path {d} fill="var(--land)" stroke="var(--coast)" stroke-width={px * 0.8} />{/each}

    <!-- The selected rumor: where the ship could be by now. -->
    {#each cloud as c}
      <circle cx={X(map.nodes[c.node].lon)} cy={Y(map.nodes[c.node].lat)} r={px * (2 + 14 * Math.sqrt(c.p))} fill="var(--theirs)" fill-opacity="0.28" />
    {/each}

    <!-- Rumor markers, fading. -->
    {#each world.rumors as r (r.id)}
      {@const n = map.nodes[r.reported]}
      <circle cx={X(n.lon)} cy={Y(n.lat)} r={px * 9} fill="none" stroke="var(--theirs)" stroke-width={px * (r.id === focus ? 3 : 1.5)} stroke-opacity={Math.max(0.15, markerStrength(r, world.turn))} />
    {/each}

    <!-- Ports and charted islands. -->
    {#each ports as n (n.id)}
      <rect x={X(n.lon) - px * 3.5} y={Y(n.lat) - px * 3.5} width={px * 7} height={px * 7} fill={n.port!.fort ? 'var(--ink)' : 'var(--paper)'} stroke="var(--ink)" stroke-width={px} />
      {#if span < 50}<text x={X(n.lon) + px * 7} y={Y(n.lat) + px * 4} font-size={px * 12} fill="var(--ink)">{n.port!.name}</text>{/if}
    {/each}
    {#each world.islands.filter((i) => i.found) as isle}
      {@const n = map.nodes[isle.node]}
      <circle cx={X(n.lon)} cy={Y(n.lat)} r={px * 6} fill="var(--land)" stroke="var(--ink)" stroke-width={px} />
      {#if span < 50}<text x={X(n.lon) + px * 8} y={Y(n.lat) + px * 4} font-size={px * 12} font-style="italic" fill="var(--ink)">uncharted isle</text>{/if}
    {/each}

    <!-- The course. -->
    {#if course.length > 1}
      <polyline points={course.map((id) => `${X(map.nodes[id].lon)},${Y(map.nodes[id].lat)}`).join(' ')} fill="none" stroke="var(--ink)" stroke-width={px * 1.5} stroke-dasharray="{px * 5} {px * 4}" />
    {/if}

    <!-- What you can see of the sea: current and wind, a step out. -->
    {#each neighbours as id}
      {@const c = arrow(id, pattern.current[id])}
      {@const w = arrow(id, pattern.wind[season][id], 0.8)}
      {#if c.len > 0.05}<line x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2} stroke="var(--water)" stroke-width={px * 2} /><circle cx={c.x2} cy={c.y2} r={px * 2.2} fill="var(--water)" />{/if}
      {#if w.len > 0.05}<line x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} stroke="var(--faint)" stroke-width={px * 1.2} stroke-dasharray="{px * 3} {px * 2}" /><circle cx={w.x2} cy={w.y2} r={px * 1.6} fill="var(--faint)" />{/if}
    {/each}

    <!-- Ships in sight. -->
    {#each visible as id (id)}
      {@const s = world.ships[id]}
      {@const n = map.nodes[s.node]}
      {@const danger = s.kind === 'hunter' || s.kind === 'armada'}
      <path d="M{X(n.lon)},{Y(n.lat) - px * 6}l{px * 5},{px * 10}h{-px * 10}z" fill={danger ? 'var(--theirs)' : 'var(--ink)'}>
        <title>{s.kind.replace('-', ' ')}</title>
      </path>
    {/each}

    <!-- You. -->
    <circle cx={X(here().lon)} cy={Y(here().lat)} r={px * 7} fill="var(--paper)" stroke="var(--ink)" stroke-width={px * 2.5} />
    <circle cx={X(here().lon)} cy={Y(here().lat)} r={px * 2.5} fill="var(--ink)" />
  </svg>
</div>

<style>
  .chart { position: relative; width: 100%; height: 100%; min-height: 22rem; overflow: hidden; border: 1.5px solid var(--ink); touch-action: none; }
  svg { display: block; cursor: crosshair; user-select: none; }
  text { font-family: inherit; }
</style>
