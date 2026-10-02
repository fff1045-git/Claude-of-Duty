/**
 * Title screen + episode select. Runs BEFORE the engine boots (main.js awaits
 * it), so it touches nothing but the DOM.
 *
 *   showTitle() -> Promise<{ mode: 'story', ep } | { mode: 'free' }>
 */

import { storyRoot, h, art } from './style.js';
import { EPISODES } from './episodes/index.js';
import { loadProgress } from './progress.js';

export function showTitle() {
  const root = storyRoot();
  const screen = h('div', 'st-full', root);
  const bg = h('div', 'st-title-bg', screen);
  bg.style.backgroundImage = `url("${art('title_key')}")`;
  h('div', 'st-title-shade', screen);

  const col = h('div', 'st-title-col', screen);
  h('div', 'st-kicker', col, 'CLAUDE OF DUTY · 스토리 작전');
  h('div', 'st-title', col, '사르말의 원혼');
  h('div', 'st-sub', col, '전쟁터 한복판, 기록에서 지워진 41명이 돌아왔다.');
  const menu = h('div', 'st-menu', col);
  const storyBtn = btn(menu, '스토리 모드', '에피소드 3개 · 귀신이 나오는 시가전', 'primary');
  const freeBtn = btn(menu, '자유 전투', '원작 그대로의 시장 거리 교전');
  h('div', 'st-foot', screen, 'WASD 이동 · 마우스 조준/사격 · R 재장전 · F 상호작용 · SHIFT 질주 · ESC 일시정지');

  return new Promise((resolve) => {
    const done = (result) => {
      removeEventListener('keydown', onKey);
      screen.remove();
      resolve(result);
    };
    let eps = null;
    const onKey = (e) => {
      if (e.code === 'Escape' && eps) {
        eps.remove();
        eps = null;
        storyBtn.focus();
      }
    };
    addEventListener('keydown', onKey);

    freeBtn.addEventListener('click', () => done({ mode: 'free' }));
    storyBtn.addEventListener('click', () => {
      eps = episodeSelect(screen, (ep) => done({ mode: 'story', ep }), () => {
        eps.remove();
        eps = null;
        storyBtn.focus();
      });
    });
    storyBtn.focus();
  });
}

function btn(parent, label, sub, cls = '') {
  const b = h('button', `st-btn ${cls}`, parent);
  b.type = 'button';
  b.append(label);
  if (sub) h('span', 'st-btn-sub', b, sub);
  return b;
}

function episodeSelect(parent, onPick, onBack) {
  const prog = loadProgress();
  const wrap = h('div', 'st-eps', parent);
  h('h2', null, wrap, '에피소드 선택');
  h('div', 'st-eps-sub', wrap, '사르말 시장 거리 · 실종된 정찰분대 「섀도」 수색 작전');
  const cards = h('div', 'st-cards', wrap);
  for (const ep of EPISODES) {
    const locked = ep.id > prog.unlocked;
    const c = h('button', 'st-card' + (locked ? ' locked' : '') + (prog.cleared.includes(ep.id) ? ' cleared' : ''), cards);
    c.type = 'button';
    const img = h('img', null, c);
    img.src = art(ep.intro[0].img);
    img.alt = '';
    if (locked) h('div', 'st-lock', c, `EPISODE ${ep.id - 1} 클리어 후 해금`);
    const body = h('div', 'st-card-body', c);
    h('div', 'st-card-ep', body, `EPISODE ${ep.id}`);
    h('div', 'st-card-name', body, `「${ep.title}」`);
    h('div', 'st-card-log', body, ep.logline);
    h('div', 'st-card-meta', body, `${ep.place} · ${ep.clock}`);
    if (locked) c.disabled = true;
    else c.addEventListener('click', () => onPick(ep.id));
  }
  const back = btn(wrap, '← 뒤로', null, 'st-back');
  back.addEventListener('click', onBack);
  wrap.querySelector('.st-card:not(.locked)')?.focus();
  return wrap;
}
