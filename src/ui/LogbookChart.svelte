<script lang="ts">
  /**
   * The logbook as a chart: every voyage you've sailed, drawn along the
   * lanes as the route chart draws the way; the graves you left, the Queen's
   * arms, and the coasts that remember an English ship. Choosing a voyage in
   * the table picks its track out of the rest.
   */
  import type { Sea } from '../world/world.ts';
  import type { LogChart, Ended } from '../logchart.ts';
  import { landmark } from '../world/landmarks.ts';
  import { PEOPLES } from '../world/peoples.ts';
  import { BOUNDS, X, Y, coastPath, legPath } from './chart.ts';

  let { sea, chart, selected = null }: { sea: Sea; chart: LogChart; selected?: number | null } = $props();
  const { W, E, N, S } = BOUNDS;

  let width = $state(700);
  const px = $derived((E - W) / Math.max(320, width));

  // Each leg's way, worked out once whichever voyages sailed it.
  const paths = new Map<string, string>();
  const leg = (a: string, b: string) => {
    const k = `${a}>${b}`;
    if (!paths.has(k)) paths.set(k, legPath(sea.map, sea.map.landmarks[a], sea.map.landmarks[b]));
    return paths.get(k)!;
  };
  const at = (key: string) => sea.map.nodes[sea.map.landmarks[key]];

  const STYLE: Record<Ended, { stroke: string; dash: string; opacity: number }> = {
    home: { stroke: 'var(--ink)', dash: 'none', opacity: 0.8 },
    lost: { stroke: 'var(--sepia)', dash: '3 3', opacity: 0.8 },
    pirate: { stroke: 'var(--theirs)', dash: 'none', opacity: 0.8 },
    abandoned: { stroke: 'var(--sepia)', dash: '1 3', opacity: 0.5 },
  };
  // The chosen voyage drawn last, on top.
  const order = $derived([...chart.tracks].sort((a, b) => Number(a.index === selected) - Number(b.index === selected)));
</script>

<div class="chart" bind:clientWidth={width}>
  <svg viewBox="{W} {-N} {E - W} {N - S}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="the voyages in the logbook, on a chart">
    <rect x={W} y={-N} width={E - W} height={N - S} fill="var(--sea)" />
    <path d={coastPath} fill="var(--land)" stroke="var(--sepia)" stroke-width="0.6" vector-effect="non-scaling-stroke" stroke-linejoin="round" />

    {#each order as t (t.index)}
      {@const st = STYLE[t.ended]}
      {@const picked = t.index === selected}
      {#each t.legs as [a, b], i (i)}
        <path
          d={leg(a, b)}
          fill="none"
          stroke={st.stroke}
          stroke-dasharray={st.dash}
          stroke-opacity={selected === null ? st.opacity : picked ? 1 : 0.15}
          stroke-width={picked ? 2.4 : 1.2}
          vector-effect="non-scaling-stroke"
          stroke-linecap="round"
        />
      {/each}
    {/each}

    <!-- The coasts that remember an English ship: a ring for a friend, a cross-hatched ring for an enemy. -->
    {#each chart.coasts as c (c.at)}
      {@const n = at(c.at)}
      <circle cx={X(n.lon)} cy={Y(n.lat)} r={px * 6} fill="none" stroke={c.word === 'hostile' ? 'var(--theirs)' : 'var(--ink)'} stroke-width="1.2" stroke-dasharray={c.word === 'hostile' ? '2 2' : 'none'} vector-effect="non-scaling-stroke"><title>{c.people ? PEOPLES[c.people].name : ''}: {c.word}</title></circle>
    {/each}

    <!-- The Queen's arms: a post with a plate. -->
    {#each chart.arms as k (k)}
      {@const n = at(k)}
      <path d="M{X(n.lon)},{Y(n.lat)}V{Y(n.lat) - px * 9}M{X(n.lon)},{Y(n.lat) - px * 9}h{px * 5}v{px * 4}h{-px * 5}" fill="var(--paper)" stroke="var(--ink)" stroke-width="1.2" vector-effect="non-scaling-stroke"><title>the Queen’s arms at {landmark(k).name}</title></path>
    {/each}

    <!-- Graves: a small cross where each lies. -->
    {#each chart.graves as g (g.id)}
      {@const n = sea.map.nodes[g.node]}
      {#if n}
        <path d="M{X(n.lon)},{Y(n.lat) - px * 4}V{Y(n.lat) + px * 4}M{X(n.lon) - px * 2.5},{Y(n.lat) - px * 1.5}H{X(n.lon) + px * 2.5}" stroke="var(--sepia)" stroke-width="1.2" vector-effect="non-scaling-stroke"><title>{g.name}, {g.title}, {g.date}</title></path>
      {/if}
    {/each}
  </svg>
</div>
<ul class="legend" aria-label="the chart's key">
  <li><svg width="22" height="8" aria-hidden="true"><line x1="1" y1="4" x2="21" y2="4" stroke="var(--ink)" stroke-width="2" /></svg>home</li>
  <li><svg width="22" height="8" aria-hidden="true"><line x1="1" y1="4" x2="21" y2="4" stroke="var(--sepia)" stroke-width="2" stroke-dasharray="3 3" /></svg>lost</li>
  <li><svg width="22" height="8" aria-hidden="true"><line x1="1" y1="4" x2="21" y2="4" stroke="var(--theirs)" stroke-width="2" /></svg>named a pirate</li>
  <li><svg width="12" height="12" aria-hidden="true"><path d="M6,1V11M2.5,4.5H9.5" stroke="var(--sepia)" stroke-width="1.5" /></svg>a grave</li>
  <li><svg width="12" height="12" aria-hidden="true"><path d="M3,11V1h6v5H3" fill="var(--paper)" stroke="var(--ink)" stroke-width="1.2" /></svg>the Queen’s arms</li>
  <li><svg width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="4.5" fill="none" stroke="var(--ink)" stroke-width="1.2" /></svg>a friendly coast</li>
  <li><svg width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="4.5" fill="none" stroke="var(--theirs)" stroke-width="1.2" stroke-dasharray="2 2" /></svg>a hostile one</li>
</ul>

<style>
  .chart { width: 100%; border: 1.5px solid var(--ink); background: var(--sea); }
  svg { display: block; }
  .chart svg { width: 100%; height: auto; }
  .legend { list-style: none; margin: 0.4rem 0 0.8rem; padding: 0; display: flex; flex-wrap: wrap; gap: 0.3rem 1rem; font-size: 0.85rem; color: var(--faint); }
  .legend li { display: flex; align-items: center; gap: 0.35rem; }
</style>
