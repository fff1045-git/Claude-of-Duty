/**
 * Story HUD: the current objective (under the minimap), radio subtitles (bottom
 * centre, queued), the boss bar (under the compass, where the TDM scoreboard was)
 * and a full-screen vignette pulse for haunts.
 *
 * DOM writes are cached so a frame that changes nothing touches nothing.
 */

import { storyRoot, h } from './style.js';

const RADIO_BASE = 2.2; // s on screen
const RADIO_PER_CHAR = 0.07;

export class StoryHud {
  constructor() {
    const root = storyRoot();
    this.root = h('div', 'st-layer', root);

    this.vig = h('div', 'st-vig', this.root);
    this.vigT = 0;
    this.vigLife = 1;

    this.obj = h('div', 'st-obj off', this.root);
    h('div', 'st-obj-label', this.obj, '목표');
    this.objText = h('div', 'st-obj-text', this.obj, '');

    this.radioWrap = h('div', 'st-radio', this.root);
    this.radioBox = h('div', 'st-radio-box off', this.radioWrap);
    this.radioWho = h('span', 'st-radio-who', this.radioBox, '');
    this.radioText = h('span', 'st-radio-text', this.radioBox, '');
    this.queue = [];
    this.current = null;
    this.radioT = 0;

    this.bossEl = h('div', 'st-boss off', this.root);
    this.bossName = h('div', 'st-boss-name', this.bossEl, '');
    const bar = h('div', 'st-boss-bar', this.bossEl);
    this.bossFill = h('i', null, bar);
    this._bossFrac = -1;
    this._visible = true;
  }

  setObjective(text) {
    if (!text) {
      this.obj.classList.add('off');
      return;
    }
    this.objText.textContent = text;
    this.obj.classList.remove('off', 'flash');
    void this.obj.offsetWidth;
    this.obj.classList.add('flash');
  }

  /** Queue a radio line. opts.ghost styles it as a ghost voice. */
  radio(who, text, opts = {}) {
    this.queue.push({ who, text, ghost: !!opts.ghost });
  }

  get radioBusy() {
    return !!this.current || this.queue.length > 0;
  }

  /** Boss bar: a 0..1 fraction shows it, null hides it. */
  boss(frac, name) {
    if (frac === null || frac === undefined) {
      this.bossEl.classList.add('off');
      this._bossFrac = -1;
      return;
    }
    if (name) this.bossName.textContent = name;
    this.bossEl.classList.remove('off');
    const f = Math.max(0, Math.min(1, frac));
    if (Math.abs(f - this._bossFrac) > 0.002) {
      this._bossFrac = f;
      this.bossFill.style.transform = `scaleX(${f.toFixed(4)})`;
    }
  }

  pulse(red = false, life = 1.2) {
    this.vig.classList.toggle('red', !!red);
    this.vigT = 0;
    this.vigLife = life;
  }

  setVisible(v) {
    if (v === this._visible) return;
    this._visible = v;
    this.root.style.display = v ? '' : 'none';
  }

  /**
   * Scaled dt: subtitles hold while the game is paused. onLine(entry) fires as
   * each radio line goes up (the squelch sound).
   */
  update(dt, onLine) {
    if (this.current) {
      this.radioT -= dt;
      if (this.radioT <= 0) {
        this.current = null;
        this.radioBox.classList.add('off');
        this.radioT = 0.35; // gap between lines
      }
    } else if (this.radioT > 0) {
      this.radioT -= dt;
    } else if (this.queue.length) {
      const l = (this.current = this.queue.shift());
      this.radioWho.textContent = l.who ? `[${l.who}]` : '';
      this.radioText.textContent = l.text;
      this.radioBox.classList.toggle('ghost', l.ghost);
      this.radioBox.classList.remove('off');
      this.radioT = RADIO_BASE + l.text.length * RADIO_PER_CHAR;
      onLine?.(l);
    }

    if (this.vigT < this.vigLife) {
      this.vigT += dt;
      const u = Math.min(1, this.vigT / this.vigLife);
      const a = u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85;
      this.vig.style.opacity = Math.max(0, a).toFixed(3);
    }
  }

  dispose() {
    this.root.remove();
  }
}
