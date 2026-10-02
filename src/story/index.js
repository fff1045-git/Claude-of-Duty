/**
 * STORY — the story-mode subsystem. Registered by main.js only when the title
 * screen (or ?mode=story) picked story mode; free mode never loads this file.
 *
 * It owns no rendering and no gameplay of its own. It sets the episode's sky and
 * start point, then runs the episode's step list (src/story/episodes) through a
 * Director, translating each step into calls on the other subsystems' public
 * APIs: ai.spawn / ai.spawnGhost, ui.setObjectives / setPrompt, sky.setTimeOfDay,
 * player.teleport, ...
 *
 * Episode changes and retries reload the page (?mode=story&ep=N[&skipIntro=1]):
 * every system then starts from a clean boot instead of needing a reset path.
 *
 * Dev: ?step=N starts the director at step N; window.__STORY__.skip() completes
 * the current blocking step.
 */

import * as THREE from 'three';
import { Director } from './director.js';
import { episode } from './episodes/index.js';
import { StoryHud } from './hud.js';
import { Haunt } from './haunt.js';
import { playCutscene } from './cutscene.js';
import { deathScreen, clearScreen, endingScreen } from './screens.js';
import { markCleared } from './progress.js';

const EYE = 1.66; // player stand eye height (src/player/tuning.js)

export const storyUrl = (ep, extra = '') => `?mode=story&ep=${ep}${extra}`;

export class StorySystem {
  static id = 'story';
  static deps = ['ai', 'ui', 'player', 'sky', 'world', 'fx'];

  async init(ctx) {
    this.ctx = ctx;
    const cfg = (this.cfg = ctx.config.story ?? { ep: 1 });
    this.ep = episode(cfg.ep);
    this.rng = ctx.rng.fork();
    this.groups = new Map();
    this.state = 'boot';
    this.objId = null;
    this.bossName = '';
    this._v = new THREE.Vector3();
    this._w = new THREE.Vector3();
    this._pp = new THREE.Vector3();
    this._chest = new THREE.Vector3();

    const sky = ctx.get('sky');
    sky.setTimeOfDay(this.ep.hour);
    if (this.ep.weather) sky.setWeather(this.ep.weather);
    ctx.peek('render')?.setExposureBias?.(this.ep.exposure ?? 0);
    this._placePlayer();

    const ui = ctx.get('ui');
    ui.matchBar?.root?.classList.add('ow-hidden');
    this.hud = new StoryHud();
    this.haunt = new Haunt(ctx, this);

    // nothing moves or fires until the start gate is clicked
    ctx.input.enabled = false;
    ctx.get('player').setControlEnabled(false);

    this._off = [
      ctx.events.on('player:death', () => this._onDeath()),
      ctx.events.on('ui:pause', (e) => {
        // closing the pause menu re-enables the player; keep a cutscene locked
        if (e && !e.paused && this.state !== 'play') this._lock();
      }),
    ];
    this.director = new Director(this.ep.steps, this._runtime());
    window.__STORY__ = {
      story: this,
      director: this.director,
      skip: () => this.director.skip(),
      step: () => ({ index: this.director.index, step: this.director.current }),
    };
  }

  /** main.js calls this once the player has clicked through the start gate. */
  begin() {
    this.state = 'play';
    const ctx = this.ctx;
    ctx.input.enabled = true;
    ctx.get('player').setControlEnabled(true);
    ctx.input.requestPointerLock?.();
    this.director.start(this.cfg.step ?? 0);
  }

  update(dt, ctx) {
    this.hud.update(dt, (line) => {
      ctx.peek('audio')?.play?.(line.ghost ? 'ghost_whisper' : 'radio', null, { level: line.ghost ? 0.9 : 0.7 });
    });
    if (this.state === 'play') this.director.update(dt);
    this.haunt.update(dt);
  }

  /* ================================================================== */
  /* geometry helpers                                                   */
  /* ================================================================== */

  /** LEVEL [x, z] -> world point, optionally snapped onto the nav grid. */
  worldPoint(at, out, snap = false) {
    const world = this.ctx.get('world');
    world.levelToWorld(at[0], 0, at[1], out);
    if (snap) {
      // Same storey as the street: without a height the nearest walkable cell
      // can be a rooftop or the top of the arched gate.
      const ground = world.groundHeight(out.x, out.z);
      const ai = this.ctx.get('ai');
      if (!ai.snapToNav(out.x, out.z, ground, out, 10)) out.y = ground;
    }
    return out;
  }

  /** World yaw for the player facing LEVEL yaw `ly` (0 = towards the gate) at LEVEL [x, z]. */
  worldYaw(x, z, ly) {
    const world = this.ctx.get('world');
    const a = world.levelToWorld(x, 0, z, this._v);
    const ax = a.x, az = a.z;
    const b = world.levelToWorld(x - Math.sin(ly), 0, z - Math.cos(ly), this._w);
    // player forward at yaw θ is (-sin θ, 0, -cos θ)
    return Math.atan2(-(b.x - ax), -(b.z - az));
  }

  playerFeet(out) {
    const p = this.ctx.peek('player')?.position;
    if (p && Number.isFinite(p.x)) return out.copy(p);
    return out.copy(this.ctx.camera.position);
  }

  _placePlayer() {
    const [x, z] = this.ep.spawn.at;
    const p = this.worldPoint([x, z], new THREE.Vector3(), false);
    const gy = this.ctx.peek('physics')?.groundHeight?.(p.x, p.z, p.y + 6);
    const feet = Number.isFinite(gy) ? gy + 0.03 : 0;
    const yaw = this.worldYaw(x, z, this.ep.spawn.yaw ?? 0);
    this.ctx.get('player').teleport(new THREE.Vector3(p.x, feet + EYE, p.z), yaw);
  }

  /* ================================================================== */
  /* the runtime the Director drives                                    */
  /* ================================================================== */

  _runtime() {
    const s = this;
    const ctx = this.ctx;
    const ui = ctx.get('ui');
    return {
      distanceTo(at) {
        const p = s.worldPoint(at, s._w, false);
        const f = s.playerFeet(s._pp);
        return Math.hypot(p.x - f.x, p.z - f.z);
      },
      setObjective(o) {
        s.objId = o.id;
        s.hud.setObjective(o.text);
        if (o.at) {
          const p = s.worldPoint(o.at, new THREE.Vector3(), true);
          p.y += 1.3;
          ui.setObjectives([{ id: o.id, position: p, label: o.label ?? '◆', name: '목표' }]);
        } else {
          ui.setObjectives([]);
        }
      },
      clearObjective(id) {
        if (s.objId !== id) return;
        s.objId = null;
        s.hud.setObjective(null);
        ui.setObjectives([]);
      },
      radio: (who, text, opts) => s.hud.radio(who, text, opts),
      radioBusy: () => s.hud.radioBusy,
      spawn: (unit, group) => s._spawn(unit, group),
      aliveCount(group) {
        let n = 0;
        for (const a of s.groups.get(group) ?? []) if (a.alive) n++;
        return n;
      },
      usePressed: () => ctx.input.actionPressed('use'),
      prompt: (p) => ui.setPrompt(p),
      clearPrompt: () => ui.clearPrompt(),
      haunt: (kind, step) => s.haunt.trigger(kind, step),
      setSky(step) {
        const sky = ctx.get('sky');
        if (step.hour !== undefined) sky.setTimeOfDay(step.hour);
        if (step.weather) sky.setWeather(step.weather);
        if (step.rate !== undefined) sky.setTimeRate(step.rate);
        if (step.exposure !== undefined) ctx.peek('render')?.setExposureBias?.(step.exposure);
      },
      bossBar: (f) => s.hud.boss(f, s.bossName),
      banish() {
        for (const a of ctx.get('ai').agents) if (a.isGhost && a.alive) a.banish();
      },
      outro: () => s._outro(),
    };
  }

  _spawn(unit, group) {
    const ai = this.ctx.get('ai');
    const pos = new THREE.Vector3();
    const f = this.playerFeet(this._pp);
    if (unit.around === 'player') {
      const [r0, r1] = unit.r ?? [9, 13];
      let ok = false;
      for (let i = 0; i < 10 && !ok; i++) {
        const a = this.rng.range(0, Math.PI * 2);
        const r = this.rng.range(r0, r1);
        ok = ai.snapToNav(f.x + Math.cos(a) * r, f.z + Math.sin(a) * r, f.y, pos, 4) &&
          Math.hypot(pos.x - f.x, pos.z - f.z) > r0 * 0.75;
      }
      if (!ok) return null;
    } else {
      this.worldPoint(unit.at, pos, true);
    }
    const yaw = Math.atan2(f.x - pos.x, f.z - pos.z);
    let agent;
    if (unit.type === 'ghost') {
      agent = ai.spawnGhost('soldier', pos, yaw);
    } else if (unit.type === 'officer') {
      agent = ai.spawnGhost('officer', pos, yaw);
      this.bossName = unit.name ?? '검은 장교';
    } else {
      agent = ai.spawn(unit.type, pos, yaw);
      let sq = this.groups.get(`${group}:squad`);
      if (!sq) {
        sq = ai.createSquad();
        this.groups.set(`${group}:squad`, sq);
      }
      sq.add(agent);
      // they have heard the shooting: come looking
      agent.hear(ai.playerPosition(this._chest), 200);
    }
    let list = this.groups.get(group);
    if (!list) this.groups.set(group, (list = []));
    list.push(agent);
    return agent;
  }

  /* ================================================================== */
  /* endings                                                            */
  /* ================================================================== */

  _lock() {
    const ctx = this.ctx;
    ctx.input.enabled = false;
    ctx.get('player').setControlEnabled(false);
    ctx.get('ui').clearPrompt();
    document.exitPointerLock?.();
  }

  _onDeath() {
    if (this.state !== 'play') return;
    this.state = 'dead';
    this._lock();
    this.hud.setVisible(false);
    this.ctx.time.scale = 0.3;
    setTimeout(() => {
      this.ctx.time.scale = 0;
      deathScreen({
        onRetry: () => (location.search = storyUrl(this.ep.id, '&skipIntro=1')),
        onTitle: () => (location.search = ''),
      });
    }, 1600);
  }

  async _outro() {
    if (this.state !== 'play') return;
    this.state = 'outro';
    this._lock();
    this.hud.setVisible(false);
    this.ctx.get('ui').setHudVisible(false);
    // freeze the world under the cutscene: nothing can shoot you mid-story
    this.ctx.time.scale = 0;
    await playCutscene(this.ep.outro);
    markCleared(this.ep.id);
    const next = this.ep.next ? episode(this.ep.next) : null;
    if (next) {
      clearScreen({
        ep: this.ep.id,
        name: this.ep.title,
        next,
        onNext: () => (location.search = storyUrl(next.id)),
        onTitle: () => (location.search = ''),
      });
    } else {
      endingScreen({ onTitle: () => (location.search = '') });
    }
  }

  dispose() {
    for (const off of this._off ?? []) off?.();
    this.haunt?.dispose();
    this.hud?.dispose();
    if (window.__STORY__?.story === this) delete window.__STORY__;
  }
}
