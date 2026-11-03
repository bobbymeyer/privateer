/**
 * The game's sounds, made in the browser rather than recorded: the sea
 * under the hull, the ship's bell, the guns, a storm, coin. All WebAudio,
 * no files. Off until asked for — a page that starts making noise uninvited
 * is a page people close — and the choice is remembered.
 *
 * Nothing here throws: no audio, or a browser that refuses it, is silence.
 */

const KEY = 'privateer:sound';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sea: { gain: GainNode; stop: () => void } | null = null;
let on = read();

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === 'on';
  } catch {
    return false;
  }
}

export const soundOn = () => on;

/** Turn sound on or off. Must be called from a click: browsers only start audio for one. */
export function setSound(value: boolean): void {
  on = value;
  try {
    localStorage.setItem(KEY, value ? 'on' : 'off');
  } catch {
    // Remembered for this page only, then.
  }
  if (on) {
    start();
    ambient(true);
  } else ambient(false);
}

/** The audio context, made on first use and resumed if the browser suspended it. */
function start(): AudioContext | null {
  try {
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** A buffer of noise, a little browner than white: the raw stuff of sea, storm and gunfire. */
function noise(c: AudioContext, seconds: number): AudioBuffer {
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    last = (last + 0.04 * (Math.random() * 2 - 1)) / 1.04;
    d[i] = last * 3.5;
  }
  return buf;
}

/** The sea under the hull: low noise, swelling and falling slowly. */
export function ambient(play: boolean): void {
  if (!play || !on) {
    if (sea) {
      sea.stop();
      sea = null;
    }
    return;
  }
  const c = start();
  if (!c || !master || sea) return;
  const src = c.createBufferSource();
  src.buffer = noise(c, 4);
  src.loop = true;
  const low = c.createBiquadFilter();
  low.type = 'lowpass';
  low.frequency.value = 520;
  const gain = c.createGain();
  gain.gain.value = 0.0;
  gain.gain.linearRampToValueAtTime(0.16, c.currentTime + 2);
  // The swell: a slow wobble on the volume and the brightness.
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.11;
  const depth = c.createGain();
  depth.gain.value = 0.07;
  lfo.connect(depth).connect(gain.gain);
  const lfo2 = c.createOscillator();
  lfo2.frequency.value = 0.07;
  const depth2 = c.createGain();
  depth2.gain.value = 180;
  lfo2.connect(depth2).connect(low.frequency);
  src.connect(low).connect(gain).connect(master);
  src.start();
  lfo.start();
  lfo2.start();
  sea = {
    gain,
    stop: () => {
      const t = c.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.6);
      setTimeout(() => [src, lfo, lfo2].forEach((n) => n.stop()), 700);
    },
  };
}

/** A sound, if sound is on: the context, and when to start. */
function begin(delay = 0): [AudioContext, number] | null {
  if (!on) return null;
  const c = start();
  return c && master ? [c, c.currentTime + delay] : null;
}

/** The ship's bell: two strokes, as at a change of watch. Heaving to, arriving, news. */
export function bell(strokes = 2): void {
  const b = begin();
  if (!b) return;
  const [c, t0] = b;
  for (let s = 0; s < strokes; s++) {
    const t = t0 + s * 0.42;
    for (const [f, a] of [[880, 0.22], [2212, 0.08], [1320, 0.05]] as const) {
      const o = c.createOscillator();
      o.frequency.value = f;
      const g = c.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(a, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      o.connect(g).connect(master!);
      o.start(t);
      o.stop(t + 1.7);
    }
  }
}

/** A gun: a crack of noise and a deep thump, heavier for heavier shot. `delay` in seconds. */
export function gun(weight = 1, delay = 0): void {
  const b = begin(delay);
  if (!b) return;
  const [c, t] = b;
  const src = c.createBufferSource();
  src.buffer = noise(c, 1.2);
  const low = c.createBiquadFilter();
  low.type = 'lowpass';
  low.frequency.setValueAtTime(1800, t);
  low.frequency.exponentialRampToValueAtTime(140, t + 0.9);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.5 * Math.min(1.5, weight), t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
  src.connect(low).connect(g).connect(master!);
  src.start(t);
  const o = c.createOscillator();
  o.frequency.setValueAtTime(70, t);
  o.frequency.exponentialRampToValueAtTime(34, t + 0.4);
  const og = c.createGain();
  og.gain.setValueAtTime(0.0001, t);
  og.gain.exponentialRampToValueAtTime(0.6 * Math.min(1.5, weight), t + 0.01);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
  o.connect(og).connect(master!);
  o.start(t);
  o.stop(t + 0.6);
}

/** Coin into the chest: a few bright clinks. A prize. */
export function coin(): void {
  const b = begin();
  if (!b) return;
  const [c, t0] = b;
  for (let i = 0; i < 4; i++) {
    const t = t0 + i * 0.07 + Math.random() * 0.03;
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.value = 2400 + Math.random() * 1600;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g).connect(master!);
    o.start(t);
    o.stop(t + 0.3);
  }
}

/** A storm: the wind getting up, a long rising roar. */
export function storm(): void {
  const b = begin();
  if (!b) return;
  const [c, t] = b;
  const src = c.createBufferSource();
  src.buffer = noise(c, 4);
  const band = c.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = 0.8;
  band.frequency.setValueAtTime(300, t);
  band.frequency.linearRampToValueAtTime(900, t + 2);
  band.frequency.linearRampToValueAtTime(400, t + 3.8);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.45, t + 1.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 3.9);
  src.connect(band).connect(g).connect(master!);
  src.start(t);
}

/** The end of a run, under: one low stroke, long. */
export function knell(): void {
  const b = begin();
  if (!b) return;
  const [c, t] = b;
  for (const [f, a] of [[110, 0.3], [165, 0.12], [262, 0.05]] as const) {
    const o = c.createOscillator();
    o.frequency.value = f;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(a, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 4);
    o.connect(g).connect(master!);
    o.start(t);
    o.stop(t + 4.1);
  }
}
