/**
 * GHOST — behaviour. A GhostAgent is an Agent (same RIG skeleton, hitboxes,
 * animator, character controller, gun) with the soldier brain swapped out:
 *
 *   - it always knows where the player is, never takes cover, and walks at them
 *   - out of sight for a few seconds it blinks: dissolves and re-forms nearer
 *   - a burst of damage scatters it into mist; it re-forms a few metres aside
 *   - inside 2.5 m its cold hurts (damage over time + a screen warp)
 *   - it does not ragdoll: it burns away over two seconds
 *   - the officer (EP3 boss) blinks and summons three soldiers at 66 % and 33 %
 *
 * The look is a swappable body (./bodies): this file only calls the body
 * contract (update / setDissolve / setFlicker / setGlitch / setGain).
 *
 * Phases: rise -> active <-> blinkOut -> blinkIn, scatter -> blinkIn,
 *         dying -> gone (removed from ai.agents)
 * Colliders are off whenever the ghost is not 'active', so rounds pass through
 * a ghost that is mid-blink.
 *
 * Events emitted: ghost:death { actor, point }, ghost:boss { actor, phase, fraction }
 */

import * as THREE from 'three';
import { Agent, STATE } from '../agent.js';
import { createGhostBody } from './bodies/index.js';
import { DEFAULT_GAIN } from './material.js';

export const GHOST_TUNING = {
  soldier: {
    health: 160, walk: 1.6, fireRate: 3, spread: 0.09, damage: 6,
    scatter: true, blinkUnseen: 3.5, auraDps: 12, mist: [0.45, 0.75, 1.0], additiveMist: true,
  },
  officer: {
    health: 2000, walk: 1.3, fireRate: 5, spread: 0.06, damage: 10,
    scatter: false, blinkUnseen: 2.5, auraDps: 20, mist: [0.9, 0.07, 0.04], additiveMist: true,
  },
};

/**
 * Ghost brightness for the current light: brighter at dusk (no exposure lift to
 * lean on) and pushed up when story mode darkens the night with an exposure
 * bias, so a ghost still glows in a street that has gone properly dark.
 */
export function ghostGain(ctx) {
  const day = ctx.peek('ai')?._daylight?.() ?? 0;
  const ev = ctx.peek('render')?.settings?.exposureBias ?? 0;
  return DEFAULT_GAIN * (1 + 3 * day) * Math.pow(2, 0.7 * Math.max(0, ev));
}

const RISE_TIME = 1.2;
const BLINK_OUT = 0.35;
const BLINK_IN = 0.5;
const DEATH_TIME = 2.0;
const AURA_RANGE = 2.6;

export class GhostAgent extends Agent {
  constructor(ai, opts = {}) {
    const kind = opts.kind ?? 'soldier';
    // 'fabric' rather than 'flesh': a round through a ghost kicks up dust and
    // cloth, never blood
    super(ai, { ...opts, surface: 'fabric', scale: opts.scale ?? (kind === 'officer' ? 1.25 : undefined) });
    this.kind = kind;
    this.isGhost = true;
    const T = (this.tune = GHOST_TUNING[kind] ?? GHOST_TUNING.soldier);
    this.health = this.maxHealth = opts.health ?? T.health;
    this.fireRate = T.fireRate;
    this.spread = T.spread;
    this.weaponDamage = T.damage;
    this.hasGrenade = false;
    this.grenadeCooldown = Infinity;
    this.viewRange = 90;
    this.noGroundShadow = true;
    this.mesh.castShadow = false;

    this.body = createGhostBody(kind, this, this.ctx);
    this.body.setDissolve(1);

    this.phase = 'rise';
    this.phaseT = 0;
    this.unseen = 0;
    this.dmgWindow = 0;
    this.scatterCooldown = 0;
    this.auraTick = 0;
    this.glitchT = 0;
    this.mistT = 0;
    this.whisperT = this.rng.range(1.5, 5);
    this.bossPhase = 0;
    this.summonPending = 0;
    this.pathFails = 0;
    this.progressT = 0;
    this.lastDist = Infinity;

    this._dest = new THREE.Vector3();
    this._feet = new THREE.Vector3();
    this._pp = new THREE.Vector3();
    this._tmp = new THREE.Vector3();
    this._dmgEvent = {
      target: null, amount: 0, headshot: false, killed: false,
      point: new THREE.Vector3(), from: new THREE.Vector3(), source: this,
    };
    this._setColliders(false);
    this._sfx('ghost_swell', 0.7);
  }

  /* ================================================================== */
  /* frame                                                              */
  /* ================================================================== */

  update(dt, ctx) {
    if (!this.alive) return;
    const t = this.ctx.time.elapsed;
    this.phaseT += dt;
    this.scatterCooldown -= dt;
    // ~45 damage has to land inside ~0.6 s to scatter
    this.dmgWindow = Math.max(0, this.dmgWindow - dt * 75);

    switch (this.phase) {
      case 'rise': {
        const k = Math.min(1, this.phaseT / RISE_TIME);
        this.body.setDissolve(1 - k);
        this.body.setGlitch(0.7 * (1 - k));
        if (k >= 1) this._setPhase('active');
        break;
      }
      case 'blinkOut':
      case 'scatter': {
        const k = Math.min(1, this.phaseT / BLINK_OUT);
        this.body.setDissolve(k);
        this.body.setGlitch(0.8);
        if (k >= 1) {
          this._teleport(this._dest);
          this._setPhase('blinkIn');
        }
        break;
      }
      case 'blinkIn': {
        const k = Math.min(1, this.phaseT / BLINK_IN);
        this.body.setDissolve(1 - k);
        this.body.setGlitch(0.6 * (1 - k));
        if (k >= 1) {
          this._setPhase('active');
          if (this.summonPending > 0) this._summon();
        }
        break;
      }
      default:
        break;
    }

    super.update(dt, ctx);

    this._ghostFx(dt, t);
    this.body.update(dt, t);
  }

  /** The soldier brain, replaced. */
  _think(dt) {
    const p = this.ai.playerPosition(this._pp);
    this.hasTarget = true;
    this.target = p;
    this.lastKnown.copy(p);
    this.lastKnownAge = 0;
    this.alertness = 1;
    this.suppression = 0;
    this.crouch = false;
    this.cover = null;
    if (this.state !== STATE.COMBAT) this._setState(STATE.COMBAT);

    if (this.phase !== 'active') {
      this.desiredSpeed = 0;
      this.wantFire = false;
      this.hasMoveTarget = false;
      return;
    }

    const T = this.tune;
    const dist = Math.hypot(p.x - this.position.x, p.z - this.position.z);

    // walk at the player; re-aim the path a little more than once a second
    if (dist > 2.0) {
      if (this.repathTimer <= 0 || (!this.hasMoveTarget && !this.pathPending)) {
        const ok = this._goTo(this._playerFeet(this._feet));
        if (ok) this.pathFails = 0;
        else if (!this.pathPending) this.pathFails++;
        this.repathTimer = 1.1;
      }
      this.desiredSpeed = T.walk;
    } else {
      this.desiredSpeed = 0;
      this.hasMoveTarget = false;
    }

    this.aimWeight = 1;
    this.peeking = true;
    this.wantFire = this.targetVisible && dist > 3 && dist < 34;

    if (dist < AURA_RANGE) {
      this.auraTick -= dt;
      if (this.auraTick <= 0) {
        this.auraTick = 0.25;
        this._chill(T.auraDps * 0.25);
      }
    } else {
      this.auraTick = 0;
    }

    // A ghost that cannot get to you (no path, or walking into a wall) does
    // not stand there: it simply arrives some other way.
    this.progressT += dt;
    let stuck = this.pathFails >= 3;
    if (this.progressT > 4) {
      stuck = stuck || (dist > 4 && this.lastDist - dist < 0.5);
      this.lastDist = dist;
      this.progressT = 0;
    }

    this.unseen = this.targetVisible ? 0 : this.unseen + dt;
    if (stuck || (this.unseen > T.blinkUnseen && dist > 10) || dist > 40) {
      if (this._pickNear(stuck ? 5 : 8, stuck ? 9 : 12, this._dest)) this._startBlink('blinkOut');
      this.unseen = 0;
      this.pathFails = 0;
      this.lastDist = Infinity;
    }
  }

  /* ================================================================== */
  /* damage and death                                                   */
  /* ================================================================== */

  applyDamage(amount, part, point, dir) {
    if (!this.alive || this.phase !== 'active') return;
    this.health -= amount;
    this.dmgWindow += amount;
    this.glitchT = 0.25;
    if (this.health <= 0) {
      this.die(point, dir, amount);
      return;
    }
    this.animator.hit('torso', 1, Math.min(1.2, 0.4 + amount / 60));
    if (this.kind === 'officer') this._bossCheck();
    else if (this.tune.scatter && this.dmgWindow > 45 && this.scatterCooldown <= 0) this._scatter();
  }

  die(point, dir) {
    if (!this.alive) return;
    this.alive = false;
    this.state = STATE.DEAD;
    this.wantFire = false;
    this.ai.cover?.release(this.id);
    if (this.controller) this.phys.removeCharacter(this.controller);
    this.controller = null;
    for (const c of this.colliders) this.phys?.removeCollider(c);
    this.colliders.length = 0;
    this.phase = 'dying';
    this.phaseT = 0;
    this.deadTime = 0;
    const at = point ?? this.position;
    this.ctx.events.emit('ghost:death', { actor: this, point: at });
    this._sfx('ghost_swell', 1.2);
    this._mistBurst(10);
  }

  /** Called by AiSystem.update for dead agents (see the afterDeath hook). */
  afterDeath(dt) {
    if (this.phase !== 'dying') return;
    this.phaseT += dt;
    const k = Math.min(1, this.phaseT / DEATH_TIME);
    this.body.setDissolve(k);
    this.body.setGlitch(0.5 * (1 - k));
    this.body.update(dt, this.ctx.time.elapsed);
    this.mistT -= dt;
    if (this.mistT <= 0 && k < 0.9) {
      this.mistT = 0.12;
      this._mistBurst(2);
    }
    if (k >= 1) {
      this.phase = 'gone';
      // after this frame's agent loop, so the list is not spliced under it
      queueMicrotask(() => this.ai.remove(this));
    }
  }

  /** Story mode: the ghost is released (EP3 dawn). */
  banish() {
    if (this.alive) this.die(null, null);
  }

  dispose() {
    super.dispose();
    this.body?.dispose();
    this.body = null;
  }

  /* ================================================================== */
  /* internals                                                          */
  /* ================================================================== */

  _setPhase(p) {
    this.phase = p;
    this.phaseT = 0;
    this._setColliders(p === 'active');
    if (p === 'active') {
      this.body.setDissolve(0);
      this.body.setGlitch(0);
    }
  }

  _setColliders(on) {
    for (const c of this.colliders) c.enabled = on;
  }

  _startBlink(kind) {
    this._setPhase(kind);
    this.wantFire = false;
    this._sfx('ghost_swell', 0.8);
    this._mistBurst(6);
  }

  _scatter() {
    this.scatterCooldown = 4;
    this.dmgWindow = 0;
    // re-form 3-5 m to the side of the line to the player
    const p = this._pp;
    const dx = p.x - this.position.x, dz = p.z - this.position.z;
    const d = Math.hypot(dx, dz) || 1;
    const side = this.rng.float() < 0.5 ? -1 : 1;
    const r = this.rng.range(3, 5);
    const x = this.position.x + (-dz / d) * side * r;
    const z = this.position.z + (dx / d) * side * r;
    if (!this.ai.snapToNav(x, z, this.position.y, this._dest, 6)) this._dest.copy(this.position);
    this._startBlink('scatter');
  }

  _bossCheck() {
    const f = this.health / this.maxHealth;
    const next = f < 0.33 ? 2 : f < 0.66 ? 1 : 0;
    if (next <= this.bossPhase) return;
    this.bossPhase = next;
    this.ctx.events.emit('ghost:boss', { actor: this, phase: next, fraction: f });
    this._sfx('ghost_drone', 1.4);
    this.summonPending = 3;
    if (!this._pickNear(10, 15, this._dest)) this._dest.copy(this.position);
    this._startBlink('blinkOut');
  }

  _summon() {
    const n = this.summonPending;
    this.summonPending = 0;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + this.rng.range(0, 1);
      const x = this.position.x + Math.cos(a) * 2.5;
      const z = this.position.z + Math.sin(a) * 2.5;
      if (this.ai.snapToNav(x, z, this.position.y, this._tmp, 5)) {
        this.ai.spawnGhost('soldier', this._tmp.clone(), this.yaw, { summonedBy: this });
      }
    }
  }

  /** A random walkable point rMin..rMax from the player. */
  _pickNear(rMin, rMax, out) {
    const f = this._playerFeet(this._feet);
    for (let i = 0; i < 8; i++) {
      const a = this.rng.range(0, Math.PI * 2);
      const r = this.rng.range(rMin, rMax);
      if (!this.ai.snapToNav(f.x + Math.cos(a) * r, f.z + Math.sin(a) * r, f.y, out, 4)) continue;
      const d = Math.hypot(out.x - f.x, out.z - f.z);
      if (d >= rMin * 0.8) return true;
    }
    return false;
  }

  _playerFeet(out) {
    const p = this.ctx.peek('player')?.position;
    if (p && Number.isFinite(p.x)) return out.copy(p);
    this.ai.playerPosition(out);
    out.y -= 1.35;
    return out;
  }

  _teleport(dest) {
    const c = this.controller;
    if (c) {
      c.teleport(dest.x, dest.y, dest.z);
      this.position.set(c.position.x, c.position.y, c.position.z);
    } else {
      this.position.copy(dest);
    }
    this.velocity.set(0, 0, 0);
    this.hasMoveTarget = false;
    this.pathLen = 0;
    this.pathIndex = 0;
    this.pathPending = false;
    this.vaultT = undefined;
    this.vaultFrom = null;
    this.speed = 0;
    this.repathTimer = 0;
    this.group.position.copy(this.position);
    this.group.updateMatrixWorld(true);
  }

  /** Cold damage to the player, plus a warp at the eye. */
  _chill(amount) {
    const player = this.ctx.peek('player');
    const e = this._dmgEvent;
    e.target = player ?? 'player';
    e.amount = amount;
    e.killed = false;
    e.point.copy(this._pp);
    e.from.copy(this.position);
    e.from.y += 1.4;
    this.ctx.events.emit('damage:dealt', e);
    const fx = this.ctx.peek('fx');
    const cam = this.ctx.camera;
    fx?.haze?.(cam.position.x, cam.position.y - 0.1, cam.position.z, 0.9, 2.4, 0.6, 0.9);
  }

  _ghostFx(dt, t) {
    // glitch spikes on hits, decays fast; random flicker now and then
    if (this.phase === 'active') {
      this.glitchT = Math.max(0, this.glitchT - dt);
      this.body.setGlitch(this.glitchT > 0 ? 0.9 : 0);
      this.body.setFlicker(Math.sin(t * 0.7 + this.id * 1.7) > 0.93 ? 1 : 0.15);
    }
    this.body.setGain(ghostGain(this.ctx));

    this.mistT -= dt;
    if (this.mistT <= 0) {
      this.mistT = this.kind === 'officer' ? 0.08 : 0.18;
      const fx = this.ctx.peek('fx');
      const m = this.tune.mist;
      fx?.mist?.(this.position.x, this.position.y + 0.05, this.position.z, {
        r: m[0], g: m[1], b: m[2], count: 1, radius: 0.35 * this.scale,
        spread: 0.35, rise: 0.15, life: 1.4, alpha: this.tune.additiveMist ? 0.25 : 0.45,
        additive: this.tune.additiveMist, intensity: 0.35,
      });
    }

    this.whisperT -= dt;
    if (this.whisperT <= 0) {
      this.whisperT = this.rng.range(4, 9);
      this._sfx(this.kind === 'officer' ? 'ghost_drone' : 'ghost_whisper', 0.8);
    }
  }

  _mistBurst(n) {
    const fx = this.ctx.peek('fx');
    const m = this.tune.mist;
    fx?.mist?.(this.position.x, this.position.y + 0.6, this.position.z, {
      r: m[0], g: m[1], b: m[2], count: n, radius: 0.45 * this.scale, spread: 0.5,
      height: 1.2, rise: 0.5, life: 1.6, alpha: this.tune.additiveMist ? 0.3 : 0.5,
      additive: this.tune.additiveMist, intensity: 0.5,
    });
  }

  _sfx(kind, level) {
    this.ctx.peek('audio')?.play?.(kind, this.position, { level, maxDist: 60 });
  }
}
