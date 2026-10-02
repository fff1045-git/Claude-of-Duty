/**
 * Haunts — the scripted scares that are not enemies.
 *
 *   apparition { at, seconds }   a civilian wraith at the end of an alley; fades
 *                                in, watches, and is gone before you reach it
 *   flicker    { seconds }       the street lamps and interior bulbs stutter
 *   pulse      { red }           vignette flash + air warp + swell + a jolt
 *
 * Lamp flicker writes through the same `intensity` field the world drives, and
 * restores the world's own value (14·mix lamps, 5+17·mix bulbs — see
 * src/world/index.js) rather than whatever the renderer's distance fade left in
 * the field. Never touches `.visible`: the point-light count is a shader key.
 */

import * as THREE from 'three';
import { createWraithBody } from '../ai/ghost/bodies/wraith.js';
import { DEFAULT_GAIN } from '../ai/ghost/material.js';

const FADE_IN = 0.8;
const FADE_OUT = 1.0;
const NOTICE = 6; // m: walk this close and it goes

export class Haunt {
  constructor(ctx, story) {
    this.ctx = ctx;
    this.story = story;
    this.rng = ctx.rng.fork();
    this.apparitions = [];
    this.flickerT = 0;
    this._v = new THREE.Vector3();
    this._p = new THREE.Vector3();
  }

  trigger(kind, step = {}) {
    if (kind === 'apparition') this._apparition(step);
    else if (kind === 'flicker') this.flickerT = Math.max(this.flickerT, step.seconds ?? 3);
    else if (kind === 'pulse') this._pulse(step);
  }

  _apparition(step) {
    const pos = this.story.worldPoint(step.at, new THREE.Vector3(), true);
    const body = createWraithBody(this.ctx);
    const o = body.object3D;
    o.position.copy(pos);
    const pl = this.story.playerFeet(this._p);
    o.rotation.y = Math.atan2(pl.x - pos.x, pl.z - pos.z);
    body.setDissolve(1);
    this.ctx.scene.add(o);
    this.apparitions.push({ body, pos, t: 0, life: step.seconds ?? 3, out: -1 });
    this.ctx.peek('audio')?.play?.('ghost_whisper', pos, { level: 1.1, maxDist: 80 });
  }

  _pulse(step) {
    this.story.hud.pulse(!!step.red);
    const cam = this.ctx.camera;
    this.ctx.peek('fx')?.hazeRing?.(cam.position.x, cam.position.y - 0.2, cam.position.z, 0.6, 7, 0.5, 1.6);
    this.ctx.peek('audio')?.play?.('ghost_swell', null, { level: 1.2 });
    this.ctx.peek('player')?.addTrauma?.(0.35);
  }

  update(dt) {
    const t = this.ctx.time.elapsed;
    const day = this.ctx.peek('ai')?._daylight?.() ?? 0;
    const gain = DEFAULT_GAIN * (1 + 3 * day);
    const pl = this.story.playerFeet(this._p);
    for (let i = this.apparitions.length - 1; i >= 0; i--) {
      const a = this.apparitions[i];
      a.t += dt;
      const near = Math.hypot(pl.x - a.pos.x, pl.z - a.pos.z) < NOTICE;
      if (a.out < 0 && (a.t > a.life || near)) a.out = 0;
      let d;
      if (a.out >= 0) {
        a.out += dt;
        d = Math.min(1, a.out / FADE_OUT);
        a.body.setGlitch(0.6);
      } else {
        d = 1 - Math.min(1, a.t / FADE_IN);
        a.body.setGlitch(d > 0 ? 0.4 : 0);
      }
      a.body.setDissolve(d);
      a.body.setGain(gain);
      a.body.update(dt, t);
      if (a.out >= FADE_OUT) {
        a.body.dispose();
        this.apparitions.splice(i, 1);
      }
    }
    this._updateFlicker(dt);
  }

  _updateFlicker(dt) {
    if (this.flickerT <= 0) return;
    const world = this.ctx.peek('world');
    if (!world) return;
    this.flickerT -= dt;
    const mix = world._lampMix ?? 1;
    const done = this.flickerT <= 0;
    for (const l of world.lamps ?? []) {
      const on = done || this.rng.float() > 0.45;
      l.intensity = 14 * mix * (on ? 1 : 0.04);
    }
    for (const l of world.bulbs ?? []) {
      const on = done || this.rng.float() > 0.35;
      l.intensity = (5 + 17 * mix) * (on ? 1 : 0.05);
    }
    if (world.lampLens) world.lampLens.emissiveIntensity = 9 * mix * (done || this.rng.float() > 0.45 ? 1 : 0.1);
  }

  dispose() {
    for (const a of this.apparitions) a.body.dispose();
    this.apparitions.length = 0;
    if (this.flickerT > 0) {
      this.flickerT = 0.0001;
      this._updateFlicker(0.001);
    }
  }
}
