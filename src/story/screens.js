/**
 * Full-screen story cards: the boot wait / start gate, KIA, episode clear and
 * the ending. Plain DOM over everything.
 */

import { storyRoot, h } from './style.js';

/**
 * Covers the screen while the engine finishes booting, then asks for one click.
 * That click is the user gesture the browser needs for pointer lock and audio.
 */
export function waitForStart(ready, { ep, name }) {
  const root = storyRoot();
  const el = h('div', 'st-full st-screen', root);
  h('div', 'st-card-ep', el, `EPISODE ${ep}`);
  h('h1', null, el, `「${name}」`).style.fontSize = 'calc(48px * var(--st-k))';
  const status = h('div', 'st-screen-sub', el, '작전 준비 중…');
  const bar = h('div', 'st-load-bar', el);
  h('i', null, bar);
  return Promise.resolve(ready).then(
    () =>
      new Promise((resolve) => {
        bar.remove();
        status.textContent = '클릭하여 작전 개시';
        status.classList.add('st-blink');
        el.classList.add('st-start');
        const go = () => {
          removeEventListener('keydown', onKey);
          el.remove();
          resolve();
        };
        const onKey = (e) => {
          if (e.code === 'Space' || e.code === 'Enter') go();
        };
        addEventListener('keydown', onKey);
        el.addEventListener('click', go, { once: true });
      })
  );
}

export function deathScreen({ onRetry, onTitle }) {
  const root = storyRoot();
  const el = h('div', 'st-full st-screen death', root);
  el.style.opacity = '0';
  el.style.transition = 'opacity 1.2s';
  h('h1', null, el, '전사');
  h('div', 'st-screen-sub', el, 'KIA · 레이븐 2');
  const row = h('div', 'st-row', el);
  button(row, '다시 시도', onRetry, 'primary');
  button(row, '타이틀로', onTitle);
  requestAnimationFrame(() => (el.style.opacity = '1'));
  return el;
}

export function clearScreen({ ep, name, next, onNext, onTitle }) {
  const root = storyRoot();
  const el = h('div', 'st-full st-screen', root);
  h('div', 'st-card-ep', el, `EPISODE ${ep} 완료`);
  h('h1', null, el, `「${name}」`).style.fontSize = 'calc(48px * var(--st-k))';
  h('div', 'st-screen-sub', el, next ? `다음 · EPISODE ${next.id} 「${next.title}」` : '');
  const row = h('div', 'st-row', el);
  if (next) button(row, '계속', onNext, 'primary');
  button(row, '타이틀로', onTitle);
  return el;
}

export function endingScreen({ onTitle }) {
  const root = storyRoot();
  const el = h('div', 'st-full st-screen', root);
  el.style.opacity = '0';
  el.style.transition = 'opacity 2s';
  h('div', 'st-card-ep', el, 'CLAUDE OF DUTY · 스토리 작전');
  h('h1', null, el, '사르말의 원혼').style.fontSize = 'calc(56px * var(--st-k))';
  h('div', 'st-screen-sub', el, '— 끝 —');
  const row = h('div', 'st-row', el);
  button(row, '타이틀로', onTitle, 'primary');
  requestAnimationFrame(() => (el.style.opacity = '1'));
  return el;
}

function button(parent, label, fn, cls = '') {
  const b = h('button', `st-btn ${cls}`, parent, label);
  b.type = 'button';
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    fn?.();
  });
  return b;
}
