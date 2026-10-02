/**
 * AUDIO — the story mode's ghost voices and radio. Synthesized like everything
 * else here (no files). Builder contract, as in foley.js:
 *   fn(actx, bank, rng, o) -> { node, end, send }
 *
 *   ghostWhisper  breathy formant noise with a slow tremolo, ~1.6 s
 *   ghostSwell    reversed-cymbal style rush that snaps off (blink, death), ~1.3 s
 *   ghostDrone    two detuned low saws through a moving lowpass (boss), ~3.2 s
 *   radioSquelch  band-limited burst + click (radio key-up), ~0.3 s
 */

import { ad, adsr, sweep, biquad, gain, osc, series } from './dsp.js';

export function ghostWhisper(actx, bank, rng, o = {}) {
  const t0 = o.when ?? actx.currentTime;
  const lvl = o.level ?? 1;
  const dur = 1.4 + rng.float() * 0.5;
  const out = gain(actx, 0.55);
  // two formant bands give the noise a vowel without a pitch
  const src = bank.source('pink', rng, 0.85 + rng.float() * 0.3);
  const f1 = biquad(actx, 'bandpass', 520 + rng.float() * 300, 4);
  const f2 = biquad(actx, 'bandpass', 1500 + rng.float() * 900, 5);
  const g = gain(actx, 0);
  const trem = gain(actx, 1);
  const lfo = osc(actx, 'sine', 5 + rng.float() * 4);
  const lfoDepth = gain(actx, 0.45);
  lfo.connect(lfoDepth);
  lfoDepth.connect(trem.gain);
  src.connect(f1);
  src.connect(f2);
  f1.connect(g);
  f2.connect(g);
  g.connect(trem);
  trem.connect(out);
  sweep(f2.frequency, t0, f2.frequency.value, f2.frequency.value * (0.6 + rng.float() * 0.6), dur);
  adsr(g.gain, t0, 0.5 * lvl, 0.35, 0.3, dur - 0.95, 0.6, 0.3);
  src.start(t0, src._offset, dur + 0.1);
  lfo.start(t0);
  lfo.stop(t0 + dur + 0.1);
  return { node: out, end: t0 + dur + 0.15, send: 0.5 };
}

export function ghostSwell(actx, bank, rng, o = {}) {
  const t0 = o.when ?? actx.currentTime;
  const lvl = o.level ?? 1;
  const out = gain(actx, 0.6);
  const src = bank.source('white', rng, 1);
  const bp = biquad(actx, 'bandpass', 400, 1.4);
  const g = gain(actx, 0);
  series(src, bp, g).connect(out);
  // rising rush: slow exponential attack, hard cut
  const rise = 1.0;
  sweep(bp.frequency, t0, 300, 4200, rise);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.45 * lvl, t0 + rise);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + rise + 0.08);
  g.gain.setValueAtTime(0, t0 + rise + 0.1);
  // a low sub thump under the cut
  const sub = osc(actx, 'sine', 70);
  const sg = gain(actx, 0);
  sub.connect(sg);
  sg.connect(out);
  sweep(sub.frequency, t0 + rise, 70, 34, 0.3);
  ad(sg.gain, t0 + rise, 0.5 * lvl, 0.005, 0.28);
  src.start(t0, src._offset, rise + 0.12);
  sub.start(t0 + rise);
  sub.stop(t0 + rise + 0.32);
  return { node: out, end: t0 + rise + 0.35, send: 0.6 };
}

export function ghostDrone(actx, bank, rng, o = {}) {
  const t0 = o.when ?? actx.currentTime;
  const lvl = o.level ?? 1;
  const dur = 3.2;
  const out = gain(actx, 0.5);
  const lp = biquad(actx, 'lowpass', 180, 6);
  const g = gain(actx, 0);
  lp.connect(g);
  g.connect(out);
  const base = 41 + rng.float() * 6;
  const a = osc(actx, 'sawtooth', base);
  const b = osc(actx, 'sawtooth', base * 1.5, 9);
  a.connect(lp);
  b.connect(lp);
  sweep(lp.frequency, t0, 140, 620, dur * 0.5);
  sweep(lp.frequency, t0 + dur * 0.5, 620, 120, dur * 0.5);
  adsr(g.gain, t0, 0.42 * lvl, 0.6, 0.6, dur - 1.8, 0.7, 0.6);
  a.start(t0);
  b.start(t0);
  a.stop(t0 + dur);
  b.stop(t0 + dur);
  return { node: out, end: t0 + dur + 0.05, send: 0.45 };
}

export function radioSquelch(actx, bank, rng, o = {}) {
  const t0 = o.when ?? actx.currentTime;
  const lvl = o.level ?? 1;
  const out = gain(actx, 0.5);
  const src = bank.source('white', rng, 1);
  const hp = biquad(actx, 'highpass', 900, 0.8);
  const lp = biquad(actx, 'lowpass', 3200, 0.8);
  const g = gain(actx, 0);
  series(src, hp, lp, g).connect(out);
  ad(g.gain, t0, 0.32 * lvl, 0.004, 0.22);
  const click = osc(actx, 'square', 1800);
  const cg = gain(actx, 0);
  click.connect(cg);
  cg.connect(out);
  ad(cg.gain, t0 + 0.22, 0.12 * lvl, 0.001, 0.025);
  src.start(t0, src._offset, 0.3);
  click.start(t0 + 0.22);
  click.stop(t0 + 0.26);
  return { node: out, end: t0 + 0.32, send: 0 };
}
