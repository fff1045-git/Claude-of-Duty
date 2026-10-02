/**
 * Cutscene player: full-screen illustration with a slow push-in (Ken Burns),
 * letterbox bars, and subtitles one line at a time.
 *
 *   playCutscene(slides, { card }) -> Promise<void>
 *     slides: [{ img, lines: [string | { who, text, ghost }] }]
 *     card:   optional title card first: { ep, name, meta }
 *
 * Click / Space / Enter: next line. Esc or the skip button: end now.
 * Lines also advance on their own after a reading time.
 *
 * Motion is CSS transitions (transform/opacity), which the compositor runs even
 * while the main thread is busy booting the engine underneath.
 */

import { storyRoot, h, art } from './style.js';

const LINE_BASE = 2.4; // s
const LINE_PER_CHAR = 0.075; // s per character

export function playCutscene(slides, { card = null } = {}) {
  const root = storyRoot();
  const el = h('div', 'st-full st-cut st-bars', root);
  const imgs = [h('div', 'st-cut-img', el), h('div', 'st-cut-img', el)];
  h('div', 'st-cut-shade', el);
  const text = h('div', 'st-cut-text', el);
  const who = h('div', 'st-cut-who', text);
  const line = h('div', 'st-cut-line', text);
  const skip = h('button', 'st-btn st-cut-skip', el, '건너뛰기  ▸▸');
  skip.type = 'button';
  h('div', 'st-cut-hint', el, '클릭 · SPACE 다음  /  ESC 건너뛰기');

  // warm the cache so the next slide is decoded before it is needed
  for (const s of slides) {
    const im = new Image();
    im.src = art(s.img);
  }

  let cardEl = null;
  if (card) {
    cardEl = h('div', 'st-cut-card', el);
    h('div', 'st-card-ep', cardEl, `EPISODE ${card.ep}`);
    h('div', 'st-cc-name', cardEl, `「${card.name}」`);
    h('div', 'st-cc-meta', cardEl, card.meta ?? '');
  }

  return new Promise((resolve) => {
    let si = -1;
    let li = -1;
    let front = 0;
    let timer = 0;
    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      removeEventListener('keydown', onKey, true);
      el.style.transition = 'opacity .6s';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 650);
      resolve();
    };

    const showSlide = (i) => {
      si = i;
      li = -1;
      const s = slides[i];
      const next = imgs[front ^ 1];
      const prev = imgs[front];
      front ^= 1;
      // reset the push-in on the incoming layer, then start it on the next frame
      next.classList.remove('kb');
      next.style.backgroundImage = `url("${art(s.img)}")`;
      const lines = s.lines.length;
      const dur = lines * 4 + 3;
      next.style.setProperty('--st-kb', `${dur}s`);
      next.style.setProperty('--st-kx', `${i % 2 ? 1.2 : -1.2}%`);
      next.style.setProperty('--st-ky', `${i % 3 === 1 ? 0.8 : -0.8}%`);
      void next.offsetWidth;
      next.classList.add('on', 'kb');
      prev.classList.remove('on');
      advance();
    };

    const advance = () => {
      clearTimeout(timer);
      const s = slides[si];
      if (!s) return finish();
      li++;
      if (li >= s.lines.length) {
        if (si + 1 < slides.length) return showSlide(si + 1);
        return finish();
      }
      const l = s.lines[li];
      const t = typeof l === 'string' ? { who: '', text: l } : l;
      line.classList.remove('on');
      // let the fade-out land before swapping the words
      setTimeout(() => {
        if (finished) return;
        who.textContent = t.who ?? '';
        line.textContent = t.text;
        line.style.color = t.ghost ? '#cfeeff' : '';
        line.style.textShadow = t.ghost ? '0 0 12px rgba(159,220,255,.75), 2px 0 rgba(255,60,60,.25), -2px 0 rgba(60,200,255,.25)' : '';
        line.classList.add('on');
      }, li === 0 ? 350 : 220);
      timer = setTimeout(advance, (LINE_BASE + t.text.length * LINE_PER_CHAR) * 1000 + 400);
    };

    const onKey = (e) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        finish();
      } else if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (si >= 0) advance();
      }
    };
    addEventListener('keydown', onKey, true);
    skip.addEventListener('click', (e) => {
      e.stopPropagation();
      finish();
    });
    el.addEventListener('click', () => {
      if (si >= 0) advance();
    });

    if (cardEl) {
      setTimeout(() => {
        if (finished) return;
        cardEl.classList.add('out');
        showSlide(0);
      }, 2600);
    } else {
      showSlide(0);
    }
  });
}
