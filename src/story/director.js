/**
 * STORY — the episode step runner.
 *
 * An episode is data: an ordered list of steps (`{ do: 'reach', at: [x, z], ... }`).
 * The Director walks it. Instant steps (objective, radio, spawn, sky...) run back
 * to back inside one update; a blocking step (reach, killAll, hold...) holds the
 * cursor until its handler reports done.
 *
 * No THREE and no DOM here: everything that touches the game goes through `rt`,
 * the runtime adapter StorySystem builds (src/story/index.js). That is what lets
 * src/story/selftest.mjs drive this file in plain Node.
 *
 * rt contract:
 *   distanceTo([x, z]) -> metres          setObjective({ id, text, at })   clearObjective(id)
 *   radio(who, text, opts)                radioBusy() -> bool
 *   spawn(unit, group) -> { alive, health?, maxHealth? }
 *   aliveCount(group) -> int              usePressed() -> bool
 *   prompt({ key, text, sub, progress })  clearPrompt()
 *   haunt(kind, step)                     setSky(step)
 *   bossBar(fraction | null)              banish()          outro()
 */

const instant = (fn) => ({
  start(step, rt) {
    fn(step, rt);
    return true;
  },
});

export const STEPS = {
  objective: instant((s, rt) => rt.setObjective({ id: s.id, text: s.text, at: s.at ?? null })),
  clearObjective: instant((s, rt) => rt.clearObjective(s.id)),
  haunt: instant((s, rt) => rt.haunt(s.kind, s)),
  sky: instant((s, rt) => rt.setSky(s)),
  banish: instant((s, rt) => rt.banish()),

  spawn: instant((s, rt) => {
    for (const u of s.units ?? []) rt.spawn(u, s.group ?? 'default');
  }),

  radio: {
    start(s, rt) {
      rt.radio(s.who, s.text, s);
      return !s.wait;
    },
    update(dt, s, rt) {
      return !rt.radioBusy();
    },
  },

  wait: {
    start(s, rt, st) {
      st.t = 0;
    },
    update(dt, s, rt, st) {
      st.t += dt;
      return st.t >= (s.seconds ?? 0);
    },
  },

  reach: {
    update(dt, s, rt) {
      return rt.distanceTo(s.at) <= (s.radius ?? 4);
    },
  },

  killAll: {
    update(dt, s, rt) {
      return rt.aliveCount(s.group ?? 'default') === 0;
    },
  },

  interact: {
    start(s, rt, st) {
      st.shown = false;
    },
    update(dt, s, rt, st) {
      const near = rt.distanceTo(s.at) <= (s.radius ?? 2.5);
      if (near && !st.shown) {
        rt.prompt({ key: 'F', text: s.text ?? '상호작용' });
        st.shown = true;
      } else if (!near && st.shown) {
        rt.clearPrompt();
        st.shown = false;
      }
      return near && rt.usePressed();
    },
    end(s, rt, st) {
      if (st.shown) rt.clearPrompt();
    },
  },

  hold: {
    start(s, rt, st) {
      st.t = 0;
      st.spawnT = 0;
    },
    update(dt, s, rt, st) {
      const seconds = s.seconds ?? 30;
      // The clock only runs while the player is defending the spot.
      if (rt.distanceTo(s.at) <= (s.radius ?? 8)) st.t += dt;
      if (s.spawnEvery && s.units?.length) {
        st.spawnT += dt;
        while (st.spawnT >= s.spawnEvery) {
          st.spawnT -= s.spawnEvery;
          for (const u of s.units) rt.spawn(u, s.group ?? 'default');
        }
      }
      rt.prompt({
        key: '◆',
        text: s.text ?? '지점 사수',
        sub: `${Math.max(0, Math.ceil(seconds - st.t))}초`,
        progress: Math.min(1, st.t / seconds),
      });
      return st.t >= seconds;
    },
    end(s, rt) {
      rt.clearPrompt();
    },
  },

  boss: {
    start(s, rt, st) {
      st.boss = rt.spawn(s.unit, s.group ?? 'boss');
    },
    update(dt, s, rt, st) {
      const b = st.boss;
      if (!b || !b.alive) return true;
      rt.bossBar(b.maxHealth ? Math.max(0, b.health / b.maxHealth) : 1);
      return false;
    },
    end(s, rt) {
      rt.bossBar(null);
    },
  },

  outro: instant((s, rt) => rt.outro()),
};

export class Director {
  constructor(steps, rt, { handlers = STEPS } = {}) {
    this.steps = steps;
    this.rt = rt;
    this.handlers = handlers;
    for (const s of steps) {
      if (!handlers[s.do]) throw new Error(`[story] unknown step type "${s.do}"`);
    }
    this._index = 0;
    this._active = false; // current step has been started
    this._state = {};
    this._skip = false;
    this._running = false;
  }

  get index() {
    return this._index;
  }
  get done() {
    return this._index >= this.steps.length;
  }
  get current() {
    return this.steps[this._index] ?? null;
  }

  start(index = 0) {
    this._index = Math.max(0, Math.min(index, this.steps.length));
    this._active = false;
    this._running = true;
  }

  /** Force-complete the current blocking step on the next update (dev). */
  skip() {
    this._skip = true;
  }

  update(dt) {
    if (!this._running) return;
    // Bounded: a malformed episode of nothing but instant steps cannot spin forever.
    for (let guard = 0; guard < 256 && !this.done; guard++) {
      const step = this.steps[this._index];
      const h = this.handlers[step.do];
      if (!this._active) {
        this._state = {};
        this._active = true;
        if (h.start?.(step, this.rt, this._state) === true) {
          this._finish(step, h);
          continue;
        }
        // The step gets its first look this same frame, with this frame's dt:
        // a step that starts mid-frame owns the time that frame covers.
        if (!h.update) {
          this._finish(step, h);
          continue;
        }
        if (this._skip || h.update(dt, step, this.rt, this._state)) {
          this._finish(step, h);
          continue;
        }
        return;
      }
      if (this._skip || h.update?.(dt, step, this.rt, this._state)) {
        this._finish(step, h);
        continue;
      }
      return;
    }
  }

  _finish(step, h) {
    h.end?.(step, this.rt, this._state);
    this._skip = false;
    this._active = false;
    this._index++;
  }
}
