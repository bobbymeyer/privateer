<script lang="ts">
  import coast from '../world/data/coast.json';
  import type { NodeId } from '../world/map.ts';
  import { COLORS } from '../world/colors.ts';
  import { adjective, type Nation } from '../world/ports.ts';
  import { markerStrength } from '../world/rumors.ts';
  import { ROSES, SEA_NAMES, SERPENT, SHIP, TOWER, TOWN, fade, rhumbs, windRose } from './woodcut.ts';
  import type { Sea } from '../world/ships.ts';
  import type { WorldState } from '../world/world.ts';
  import { onDestroy, untrack } from 'svelte';
  import SeaShader from './SeaShader.svelte';
  import { LANDMARKS } from '../world/landmarks.ts';
  import { choices } from '../world/journey.ts';

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

  // The coast, drawn only where it can be seen and only as fine as a pixel.
  // It's drawn nine times over for the water lines, so this is what keeps a
  // pan smooth: rings out of view are skipped (across three copies of the
  // world, so the dateline can be panned across), rings smaller than a few
  // pixels too, and points closer than a pixel and a half are dropped.
  const rings = (coast.rings as number[][]).map((r) => {
    let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
    for (let i = 0; i < r.length; i += 2) [w, s, e, n] = [Math.min(w, r[i]), Math.min(s, r[i + 1]), Math.max(e, r[i]), Math.max(n, r[i + 1])];
    return { r, w, s, e, n };
  });
  const coastPaths = $derived.by(() => {
    const margin = WATER_LINES * WATER_GAP * px + 1;
    const [vw, ve] = [center.lon - span / 2 - margin, center.lon + span / 2 + margin];
    const [vs, vn] = [center.lat - tall / 2 - margin, center.lat + tall / 2 + margin];
    const minSize = px * 3;
    const step = px * 1.5;
    let d = '';
    for (const dx of [-360, 0, 360]) {
      for (const ring of rings) {
        if (ring.e + dx < vw || ring.w + dx > ve || ring.n < vs || ring.s > vn) continue;
        if (ring.e - ring.w < minSize && ring.n - ring.s < minSize) continue;
        const r = ring.r;
        let [lx, ly] = [r[0], r[1]];
        d += `M${(lx + dx).toFixed(2)},${(-ly).toFixed(2)}`;
        for (let i = 2; i < r.length; i += 2) {
          if (Math.abs(r[i] - lx) < step && Math.abs(r[i + 1] - ly) < step) continue;
          [lx, ly] = [r[i], r[i + 1]];
          d += `L${(lx + dx).toFixed(2)},${(-ly).toFixed(2)}`;
        }
        d += 'Z';
      }
    }
    return [d];
  });

  // Motion: the camera eases to follow the ship, and the ship glides from
  // node to node, facing the way she goes, with a short wake astern. None
  // of it with motion turned off.
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  /** The sea is drawn by the shader: the SVG's own sea and wave marks stand aside. */
  let shaded = $state(false);
  let target: { lon: number; lat: number } | null = null;
  let ship = $state({ lon: here().lon, lat: here().lat });
  let facing = $state(1);
  let wake: { lon: number; lat: number }[] = $state([]);
  let from = { lon: here().lon, lat: here().lat, at: 0 };
  let lastNode = untrack(() => world.player);
  const GLIDE = 130;
  const WAKE = 6;

  $effect(() => {
    const n = here();
    if (world.player === lastNode) return;
    const neighbour = map.adj[lastNode]?.includes(world.player);
    // The nearer copy of the new position, across the dateline.
    const lon = n.lon + 360 * Math.round((ship.lon - n.lon) / 360);
    if (neighbour) {
      if (Math.abs(lon - ship.lon) > 0.01) facing = lon < ship.lon ? -1 : 1;
      wake = [...wake, { lon: ship.lon, lat: ship.lat }].slice(-WAKE);
    } else wake = [];
    from = { lon: ship.lon, lat: ship.lat, at: performance.now() };
    if (still || !neighbour) ship = { lon, lat: n.lat };
    lastNode = world.player;
    tick();
  });

  let frame = 0;
  function tick() {
    cancelAnimationFrame(frame);
    const step = () => {
      let busy = false;
      const n = here();
      const lon = n.lon + 360 * Math.round((from.lon - n.lon) / 360);
      const k = Math.min(1, (performance.now() - from.at) / GLIDE);
      if (k < 1 && !still) {
        const e = k * (2 - k);
        ship = { lon: from.lon + (lon - from.lon) * e, lat: from.lat + (n.lat - from.lat) * e };
        busy = true;
      } else if (ship.lon !== lon || ship.lat !== n.lat) ship = { lon, lat: n.lat };
      if (target && !drag) {
        const [dl, dt] = [target.lon - center.lon, target.lat - center.lat];
        if (still || Math.abs(dl) + Math.abs(dt) < span * 0.002) {
          center = target;
          target = null;
        } else {
          center = { lon: center.lon + dl * 0.2, lat: center.lat + dt * 0.2 };
          busy = true;
        }
      }
      if (busy) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
  }
  onDestroy(() => cancelAnimationFrame(frame));

  export function recentre() {
    const n = here();
    target = { lon: n.lon + 360 * Math.round((center.lon - n.lon) / 360), lat: n.lat };
    tick();
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
    // The nearest node on a lane: off them is water and nothing more.
    for (const n of map.nodes) {
      if (!map.adj[n.id].length) continue;
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
  /**
   * Protected water by nation, as one path each: a round blob at every node
   * and a thick stroke along every leg between two of its nodes, three copies
   * of the world wide. Built once — it never changes — so a pan moves it
   * rather than rewriting thousands of shapes.
   */
  const waterPaths = $derived.by(() => {
    const blobs = new Map<Nation, string>();
    const legs = new Map<Nation, string>();
    const R = 0.8;
    for (const dx of [-360, 0, 360]) {
      for (const n of map.nodes) {
        if (!n.waters) continue;
        const [x, y] = [n.lon + dx, -n.lat];
        blobs.set(n.waters, (blobs.get(n.waters) ?? '') + `M${(x - R).toFixed(2)},${y.toFixed(2)}a${R},${R} 0 1,0 ${2 * R},0a${R},${R} 0 1,0 ${-2 * R},0`);
        for (const m of map.open[n.id]) {
          const o = map.nodes[m];
          if (m < n.id || o.waters !== n.waters) continue;
          const ox = x + (((o.lon - n.lon + 540) % 360) - 180);
          legs.set(n.waters, (legs.get(n.waters) ?? '') + `M${x.toFixed(2)},${y.toFixed(2)}L${ox.toFixed(2)},${(-o.lat).toFixed(2)}`);
        }
      }
    }
    return [...blobs.keys()].map((nation) => ({ nation, blobs: blobs.get(nation)!, legs: legs.get(nation) ?? '' }));
  });
  /** The sea lanes, as one path three copies of the world wide: built once, they never change. */
  const lanePath = $derived.by(() => {
    let d = '';
    for (const dx of [-360, 0, 360]) {
      for (const [a, b] of map.lanes) {
        const [na, nb] = [map.nodes[a], map.nodes[b]];
        const bx = na.lon + dx + (((nb.lon - na.lon + 540) % 360) - 180);
        d += `M${(na.lon + dx).toFixed(2)},${(-na.lat).toFixed(2)}L${bx.toFixed(2)},${(-nb.lat).toFixed(2)}`;
      }
    }
    return d;
  });
  const ARROW = 18; // px
  const arrow = (n: NodeId, v: [number, number], scale = 1) => {
    const len = Math.hypot(...v);
    const k = (ARROW * px * Math.min(1.5, len)) / (len || 1) * scale;
    const [x, y] = [X(map.nodes[n].lon), Y(map.nodes[n].lat)];
    return { x1: x, y1: y, x2: x + v[0] * k, y2: y - v[1] * k, len };
  };
  // The engraving. Sepia and sea as numbers, for the water lines' fade.
  const SEPIA: [number, number, number] = [74, 53, 32];
  const SEA: [number, number, number] = [234, 216, 173];
  /** Water-lining: lines following the coast out to sea, this many, this far apart (px). */
  const WATER_LINES = 4;
  const WATER_GAP = 3.2;
  const allWaterLines = Array.from({ length: WATER_LINES }, (_, i) => WATER_LINES - i).map((k) => ({ k, ink: fade(SEPIA, SEA, k, WATER_LINES) }));
  const rose = windRose(34);
  const rays = rhumbs(70);
  /** A glyph's place: at a node, one screen pixel to a unit. */
  const glyph = (lon: number, lat: number, k = 1) => `translate(${X(lon)} ${Y(lat)}) scale(${px * k})`;
  /** The frame's graduated border: alternating bars, this long (px). */
  const BAR = 36;

  /** Fewer water lines far out, where they'd be too fine to see: all of them close in, two at an ocean's breadth, none for the world. */
  const waterLines = $derived(allWaterLines.filter((w) => w.k <= (span > 150 ? 0 : span > 70 ? 2 : WATER_LINES)));

  const season = $derived(Math.floor(world.turn / pattern.seasonLength) % 4);
  const neighbours = $derived([world.player, ...map.adj[world.player]]);
</script>

<div class="chart" bind:clientWidth={width} bind:clientHeight={height}>
  <SeaShader lon={center.lon} lat={center.lat} {span} {width} {height} onready={(ok) => (shaded = ok)} />
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
    <defs>
      <!-- Land is cut with diagonal hatching, the same density at any zoom. -->
      <pattern id="hatch" patternUnits="userSpaceOnUse" width={px * 5} height={px * 5} patternTransform="rotate(40)">
        <line x1="0" y1="0" x2="0" y2={px * 5} stroke="var(--sepia)" stroke-width={px * 0.7} stroke-opacity="0.38" />
      </pattern>
      <!-- The open sea, with the engraver's little wave marks. -->
      <pattern id="waves" patternUnits="userSpaceOnUse" width={px * 46} height={px * 26}>
        <path d="M{px * 4},{px * 8} q{px * 2.5},{-px * 2.4} {px * 5},0 t{px * 5},0 M{px * 26},{px * 21} q{px * 2.5},{-px * 2.4} {px * 5},0 t{px * 5},0" fill="none" stroke="var(--sepia)" stroke-width={px * 0.7} stroke-opacity="0.3" />
      </pattern>
    </defs>

    {#if !shaded}
      <rect x={center.lon - span} y={-center.lat - tall} width={span * 2} height={tall * 2} fill="var(--sea)" />
      <rect x={center.lon - span} y={-center.lat - tall} width={span * 2} height={tall * 2} fill="url(#waves)" />
    {/if}

    <!-- Rhumb lines, fanning from a rose in each ocean. -->
    {#each ROSES as [lon, lat]}
      <g transform="translate({X(lon)} {Y(lat)})" stroke="var(--sepia)" stroke-opacity="0.22" stroke-width={px * 0.6}>
        {#each rays as [dx, dy], i}<line x1="0" y1="0" x2={dx} y2={dy} stroke-dasharray={i % 2 ? `${px * 4} ${px * 3}` : 'none'} />{/each}
      </g>
    {/each}

    <!-- Water-lining: the coast drawn again and again out to sea. Each line is
         a wide ink stroke with a slightly narrower sea stroke on top, widest
         first; the land is laid over the inner half. -->
    {#each waterLines as w (w.k)}
      {#each coastPaths as d}
        <path {d} fill="none" stroke={w.ink} stroke-width={px * WATER_GAP * 2 * w.k} stroke-linejoin="round" />
        <path {d} fill="none" stroke="var(--sea)" stroke-width={px * (WATER_GAP * 2 * w.k - 1.3)} stroke-linejoin="round" />
      {/each}
    {/each}

    <!-- Protected waters: a faint, even wash of the owner's colour. Each
         nation's is drawn opaque — round blobs at its nodes, thick strokes
         joining neighbours — inside one group faded as a whole, so overlaps
         don't darken and gaps between nodes fill. -->
    {#each waterPaths as g (g.nation)}
      <g opacity="0.2">
        <path d={g.blobs} fill={COLORS[g.nation].field} />
        <path d={g.legs} fill="none" stroke={COLORS[g.nation].field} stroke-width="1.6" stroke-linecap="round" />
      </g>
    {/each}
    {#each coastPaths as d}
      <path {d} fill="var(--land)" />
      <path {d} fill="url(#hatch)" stroke="var(--sepia)" stroke-width={px * 1.3} stroke-linejoin="round" />
    {/each}

    <!-- The sea lanes: where everyone sails, you too. A dotted track, as charts marked a course. -->
    <path d={lanePath} fill="none" stroke="var(--sepia)" stroke-width={px * 1.4} stroke-opacity="0.55" stroke-dasharray="{px * 2} {px * 3}" stroke-linecap="round" />

    <!-- The seas, lettered as on charts of the time. -->
    {#if span > 22}
      {#each SEA_NAMES as s}
        <text x={X(s.at[0])} y={Y(s.at[1])} font-size={s.size} font-style="italic" letter-spacing={s.size * 0.25} fill="var(--sepia)" fill-opacity="0.6" text-anchor="middle">{s.name}</text>
      {/each}
    {/if}

    <!-- The selected rumor: where the ship could be by now. -->
    {#each cloud as c}
      <circle cx={X(map.nodes[c.node].lon)} cy={Y(map.nodes[c.node].lat)} r={px * (2 + 14 * Math.sqrt(c.p))} fill="var(--theirs)" fill-opacity="0.28" />
    {/each}

    <!-- Rumor markers, fading: a ring in the ship's colours. -->
    {#each world.rumors as r (r.id)}
      {@const n = map.nodes[r.reported]}
      {@const c = COLORS[r.nation]}
      {@const o = Math.max(0.15, markerStrength(r, world.turn))}
      <circle cx={X(n.lon)} cy={Y(n.lat)} r={px * 9} fill="none" stroke={c.border} stroke-width={px * (r.id === focus ? 5 : 3.5)} stroke-opacity={o} />
      <circle cx={X(n.lon)} cy={Y(n.lat)} r={px * 9} fill="none" stroke={c.field} stroke-width={px * (r.id === focus ? 2.5 : 1.5)} stroke-opacity={o} />
    {/each}

    <!-- Ports and charted islands. -->
    {#each ports as n (n.id)}
      {@const c = COLORS[n.port!.nation]}
      <g transform={glyph(n.lon, n.lat)} stroke-linejoin="round">
        {#if n.port!.fort}
          <!-- A fortified port: a tower. -->
          <path d={TOWER.body} fill={c.field} stroke={c.border} stroke-width="2" />
          <path d={TOWER.body} fill="none" stroke="var(--sepia)" stroke-width="0.7" />
          <path d={TOWER.gate} fill="none" stroke="var(--sepia)" stroke-width="1" />
        {:else}
          <!-- An open town: two houses. -->
          <path d={TOWN.body} fill={c.field} stroke={c.border} stroke-width="2" />
          <path d={TOWN.body} fill="none" stroke="var(--sepia)" stroke-width="0.7" />
          <path d={TOWN.windows} fill="none" stroke="var(--sepia)" stroke-width="1" />
        {/if}
      </g>
      {#if span < 50}<text x={X(n.lon) + px * 9} y={Y(n.lat) + px * 5} font-size={px * 12} fill="var(--sepia)">{n.port!.name}</text>{/if}
    {/each}
    {#each world.islands.filter((i) => i.found) as isle}
      {@const n = map.nodes[isle.node]}
      <circle cx={X(n.lon)} cy={Y(n.lat)} r={px * 6} fill="var(--land)" stroke="var(--sepia)" stroke-width={px} />
      {#if span < 50}<text x={X(n.lon) + px * 8} y={Y(n.lat) + px * 4} font-size={px * 12} font-style="italic" fill="var(--sepia)">uncharted isle</text>{/if}
    {/each}

    <!-- The course. -->
    {#if course.length > 1}
 <polyline points={course.map((id) => `${X(map.nodes[id].lon)},${Y(map.nodes[id].lat)}`).join(' ')} fill="none" stroke="var(--sepia)" stroke-width={px * 1.5} stroke-dasharray="{px * 5} {px * 4}" />
    {/if}

    <!-- What you can see of the sea: current and wind, a step out. -->
    {#each neighbours as id}
      {@const c = arrow(id, pattern.current[id])}
      {@const w = arrow(id, pattern.wind[season][id], 0.8)}
      {#if c.len > 0.05}<line x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2} stroke="var(--water)" stroke-width={px * 2} /><circle cx={c.x2} cy={c.y2} r={px * 2.2} fill="var(--water)" />{/if}
      {#if w.len > 0.05}<line x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} stroke="var(--faint)" stroke-width={px * 1.2} stroke-dasharray="{px * 3} {px * 2}" /><circle cx={w.x2} cy={w.y2} r={px * 1.6} fill="var(--faint)" />{/if}
    {/each}

    <!-- The voyage's landmarks: where you've been faded, where you can make for next in ink, where you're bound ringed. -->
    {#each LANDMARKS.filter((l) => l.key !== 'plymouth-home' && l.key !== 'strait-east' && l.key !== 'brazil-home') as l (l.key)}
      {@const n = map.nodes[map.landmarks[l.key]]}
      {@const next = choices(world.voyage).includes(l.key)}
      {@const been = world.voyage.visited.includes(l.key)}
      <g opacity={next ? 1 : been ? 0.35 : 0.6}>
        <circle cx={X(n.lon)} cy={Y(n.lat)} r={px * 4} fill={next ? 'var(--ink)' : 'var(--paper)'} stroke="var(--ink)" stroke-width={px * 1.2} />
        {#if world.voyage.bound === l.key}<circle cx={X(n.lon)} cy={Y(n.lat)} r={px * 9} fill="none" stroke="var(--ink)" stroke-width={px * 1.4} />{/if}
        <text x={X(n.lon) + px * 7} y={Y(n.lat) - px * 6} font-size={px * 12} font-style="italic" fill="var(--ink)">{l.name}</text>
      </g>
    {/each}

    <!-- Ships in sight. -->
    {#each visible as id (id)}
      {@const s = world.ships[id]}
      {@const n = map.nodes[s.node]}
      {@const warship = s.kind === 'hunter' || s.kind === 'armada'}
      {@const c = COLORS[s.nation]}
      {#if s.kind === 'monster'}
      <!-- A monster: coils in the water, drawn in ink, on its own ground of paper. -->
      <g transform={glyph(n.lon, n.lat, 1.3)} stroke-linejoin="round" stroke-linecap="round">
        <title>the monster of the {s.routeName}</title>
        <path d={SERPENT.coils} fill="none" stroke="var(--ink)" stroke-width="2.2" />
        <path d={SERPENT.head} fill="var(--ink)" stroke="var(--ink)" stroke-width="0.8" />
        <path d={SERPENT.eye} stroke="var(--paper)" stroke-width="1.4" />
        <path d={SERPENT.waves} fill="none" stroke="var(--water)" stroke-width="0.9" />
      </g>
      {:else}
      <!-- A ship under sail: her flag's field on the sails and pennant, its border on the hull. Warships larger. -->
      <g transform={glyph(n.lon, n.lat, warship ? 1.4 : 1)} stroke-linejoin="round">
        <title>{adjective(s.nation)} {s.kind === 'hunter' ? 'guard ship' : s.kind.replace('-', ' ')}</title>
        <path d={SHIP.masts} stroke="var(--sepia)" stroke-width="1" />
        <path d={SHIP.sails} fill={c.field} stroke="var(--sepia)" stroke-width="0.9" />
        <path d={SHIP.pennant} fill={c.border} stroke="var(--sepia)" stroke-width="0.5" />
        <path d={SHIP.hull} fill={c.border} stroke="var(--sepia)" stroke-width="1" />
      </g>
      {/if}
    {/each}

    <!-- You: a short wake astern, fading, then the ship, facing the way she goes. -->
    {#each wake as p, i}
      <circle cx={X(p.lon)} cy={Y(p.lat)} r={px * (1.2 + (i / WAKE) * 1.8)} fill="var(--ink)" fill-opacity={0.12 + (i / WAKE) * 0.4} />
    {/each}
    <circle cx={X(ship.lon)} cy={Y(ship.lat)} r={px * 15} fill="none" stroke="var(--ink)" stroke-width={px * 1.6} stroke-dasharray="{px * 3} {px * 2.5}" />
    <g transform="{glyph(ship.lon, ship.lat, 1.25)} scale({facing} 1)" stroke-linejoin="round">
      <path d={SHIP.masts} stroke="var(--ink)" stroke-width="1.2" />
      <path d={SHIP.sails} fill="var(--paper)" stroke="var(--ink)" stroke-width="1.2" />
      <path d={SHIP.pennant} fill={COLORS.england.border} stroke="var(--ink)" stroke-width="0.5" />
      <path d={SHIP.hull} fill="var(--ink)" stroke="var(--ink)" stroke-width="1" />
    </g>
  </svg>

  <!-- The frame: a graduated border and a wind rose, fixed to the glass, not the sea. -->
  <svg class="frame" width={width} height={height} aria-hidden="true">
    <rect x="0.75" y="0.75" width={width - 1.5} height={height - 1.5} fill="none" stroke="var(--ink)" stroke-width="1.5" />
    <rect x="7" y="7" width={width - 14} height={height - 14} fill="none" stroke="var(--ink)" stroke-width="0.8" />
    {#each Array.from({ length: Math.ceil(width / BAR) }) as _, i}
      {#if i % 2 === 0}
        <rect x={2 + i * BAR} y="2" width={Math.min(BAR, width - 4 - i * BAR)} height="4" fill="var(--ink)" />
        <rect x={2 + i * BAR} y={height - 6} width={Math.min(BAR, width - 4 - i * BAR)} height="4" fill="var(--ink)" />
      {/if}
    {/each}
    {#each Array.from({ length: Math.ceil(height / BAR) }) as _, i}
      {#if i % 2 === 1}
        <rect x="2" y={2 + i * BAR} width="4" height={Math.min(BAR, height - 4 - i * BAR)} fill="var(--ink)" />
        <rect x={width - 6} y={2 + i * BAR} width="4" height={Math.min(BAR, height - 4 - i * BAR)} fill="var(--ink)" />
      {/if}
    {/each}
    <g transform="translate(58 {height - 58})">
      <circle r={rose.ring} fill="var(--sea)" stroke="var(--sepia)" stroke-width="1" />
      <circle r={rose.ring - 4} fill="none" stroke="var(--sepia)" stroke-width="0.6" />
      <path d={rose.paper} fill="var(--sea)" stroke="var(--sepia)" stroke-width="0.8" stroke-linejoin="round" />
      <path d={rose.ink} fill="var(--sepia)" stroke="var(--sepia)" stroke-width="0.8" stroke-linejoin="round" />
      <text y="-38" text-anchor="middle" font-size="11" fill="var(--sepia)">N</text>
    </g>
  </svg>
</div>

<style>
  .chart { position: relative; width: 100%; height: 100%; min-height: 22rem; overflow: hidden; touch-action: none; }
  .frame { position: absolute; inset: 0; pointer-events: none; }
  svg { position: relative; display: block; cursor: crosshair; user-select: none; }
  text { font-family: inherit; }
</style>
