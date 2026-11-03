<script lang="ts">
  /**
   * The open sea, engraved and moving: the chart's wave marks drawn by a
   * shader under the SVG, in the chart's own coordinates so they pan and
   * zoom with it. Each mark is a short double curve, as the engravers cut
   * them; their curl rolls slowly, and long swells pass across the marks,
   * thickening and thinning the ink, the way a sea looks from a masthead.
   * Ink on paper: two colours, the sea's and the sepia's, nothing else.
   *
   * Without WebGL, or with motion turned off, it does what the SVG pattern
   * did: still marks, drawn once.
   */
  import { onDestroy, onMount } from 'svelte';

  let { lon, lat, span, width, height, onready }: { lon: number; lat: number; span: number; width: number; height: number; onready?: (ok: boolean) => void } = $props();

  let canvas: HTMLCanvasElement;
  let gl: WebGLRenderingContext | null = null;
  let program: WebGLProgram | null = null;
  let frame = 0;
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const t0 = performance.now();

  const VERT = `attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }`;
  const FRAG = `
    precision highp float;
    uniform vec2 res;      // canvas pixels
    uniform vec2 centre;   // lon, lat at the middle
    uniform float span;    // degrees across
    uniform float time;    // seconds
    uniform vec3 sea;
    uniform vec3 ink;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
    }

    void main() {
      float px = span / res.x;                       // degrees per pixel
      vec2 frag = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y);
      vec2 w = vec2(centre.x - span * 0.5 + frag.x * px, centre.y + (res.y * px) * 0.5 - frag.y * px); // lon, lat
      vec2 q = vec2(w.x, -w.y) / px;                 // in pixels, fixed to the sea

      // Marks on a staggered grid, a few to a cell, each cell its own offset.
      vec2 cell = vec2(46.0, 26.0);
      vec2 c = floor(q / cell);
      vec2 local = q - c * cell;
      float h = hash(c);
      vec2 at = vec2(6.0 + h * 26.0, 7.0 + fract(h * 7.13) * 12.0);
      vec2 d = local - at;

      // A double curve, ten pixels long, its curl rolling with time.
      float roll = time * 0.6 + h * 6.2831;
      float y = -2.2 * sin(d.x * 0.63 + roll) * smoothstep(0.0, 1.5, d.x) * smoothstep(10.0, 8.5, d.x);
      float line = 1.0 - smoothstep(0.35, 1.0, abs(d.y - y));
      line *= step(0.0, d.x) * step(d.x, 10.0);

      // Long swells crossing the sea: the ink thickens on their faces.
      vec2 s = w / max(span, 6.0) * 6.0;
      float swell = noise(s * 1.3 + vec2(time * 0.05, time * 0.02)) * 0.7 + noise(s * 3.1 - vec2(time * 0.03, 0.0)) * 0.3;
      float strength = mix(0.12, 0.42, smoothstep(0.25, 0.75, swell));

      gl_FragColor = vec4(mix(sea, ink, line * strength), 1.0);
    }`;

  /** A CSS colour, as the shader's three floats. */
  function rgb(name: string): [number, number, number] {
    const probe = document.createElement('span');
    probe.style.color = `var(${name})`;
    document.body.appendChild(probe);
    const m = getComputedStyle(probe).color.match(/[\d.]+/g) ?? ['0', '0', '0'];
    probe.remove();
    return [Number(m[0]) / 255, Number(m[1]) / 255, Number(m[2]) / 255];
  }

  function compile(type: number, src: string) {
    const sh = gl!.createShader(type)!;
    gl!.shaderSource(sh, src);
    gl!.compileShader(sh);
    if (!gl!.getShaderParameter(sh, gl!.COMPILE_STATUS)) throw new Error(gl!.getShaderInfoLog(sh) ?? 'shader');
    return sh;
  }

  let colours: { sea: [number, number, number]; ink: [number, number, number] } | null = null;

  function draw() {
    if (!gl || !program || !colours) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const [w, h] = [Math.round(width * dpr), Math.round(height * dpr)];
    if (canvas.width !== w || canvas.height !== h) [canvas.width, canvas.height] = [w, h];
    gl.viewport(0, 0, w, h);
    const u = (n: string) => gl!.getUniformLocation(program!, n);
    gl.uniform2f(u('res'), w, h);
    gl.uniform2f(u('centre'), lon, lat);
    gl.uniform1f(u('span'), span);
    gl.uniform1f(u('time'), still ? 0 : (performance.now() - t0) / 1000);
    gl.uniform3f(u('sea'), ...colours.sea);
    gl.uniform3f(u('ink'), ...colours.ink);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function loop() {
    draw();
    frame = requestAnimationFrame(loop);
  }

  onMount(() => {
    try {
      gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false });
      if (!gl) throw new Error('no webgl');
      program = gl.createProgram()!;
      gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'link');
      gl.useProgram(program);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(program, 'p');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      colours = { sea: rgb('--sea'), ink: rgb('--sepia') };
      onready?.(true);
      if (still) draw();
      else loop();
    } catch {
      gl = null;
      onready?.(false);
    }
  });

  // Still: draw again whenever the view moves.
  $effect(() => {
    void [lon, lat, span, width, height];
    if (still) draw();
  });

  onDestroy(() => cancelAnimationFrame(frame));
</script>

<canvas bind:this={canvas} style="width: {width}px; height: {height}px" aria-hidden="true"></canvas>

<style>
  canvas { position: absolute; inset: 0; display: block; pointer-events: none; }
</style>
