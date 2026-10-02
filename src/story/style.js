/**
 * Story-mode stylesheet: title, cutscenes, screens and the story HUD. Injected
 * once as <style id="story-style">. Lives outside the game HUD (.ow-hud) on its
 * own root so the HUD's fade (ui.setHudVisible) never hides a cutscene.
 *
 * Fonts are system fonts only: the game runs offline by design, and the HUD's
 * condensed Latin stacks have no Hangul.
 */

const CSS = `
:root {
  --st-bg: #07090b;
  --st-ink: rgba(236, 241, 244, .96);
  --st-ink-2: rgba(214, 224, 230, .64);
  --st-ink-3: rgba(200, 212, 220, .34);
  --st-hair: rgba(255, 255, 255, .14);
  --st-ghost: #9fdcff;
  --st-red: #e0433a;
  --st-amber: #ffb02a;
  --st-k: 1;
  --st-font: "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", "Nanum Gothic", system-ui, sans-serif;
}
#story-ui { position: fixed; inset: 0; z-index: 20; pointer-events: none; font-family: var(--st-font);
  color: var(--st-ink); -webkit-font-smoothing: antialiased; user-select: none; }
#story-ui * { box-sizing: border-box; }
.st-layer { position: absolute; inset: 0; }
.st-full { position: absolute; inset: 0; pointer-events: auto; background: var(--st-bg); overflow: hidden; cursor: default; }
.st-hidden { display: none !important; }

/* ---------- buttons ---------- */
.st-btn { pointer-events: auto; appearance: none; border: 1px solid var(--st-hair); background: rgba(10, 14, 18, .55);
  color: var(--st-ink); font: 600 calc(17px * var(--st-k)) var(--st-font); letter-spacing: .04em;
  padding: calc(13px * var(--st-k)) calc(26px * var(--st-k)); cursor: pointer; text-align: left;
  transition: background .18s, border-color .18s, transform .18s, color .18s; min-width: calc(250px * var(--st-k)); }
.st-btn:hover, .st-btn:focus-visible { background: rgba(159, 220, 255, .12); border-color: rgba(159, 220, 255, .55);
  transform: translateX(4px); outline: none; }
.st-btn.primary { border-color: rgba(159, 220, 255, .5); }
.st-btn .st-btn-sub { display: block; font-weight: 400; font-size: .72em; color: var(--st-ink-2); margin-top: 3px; letter-spacing: .02em; }
.st-btn[disabled] { opacity: .4; cursor: not-allowed; transform: none; }

/* ---------- title ---------- */
.st-title-bg { position: absolute; inset: -4%; background-size: cover; background-position: center;
  animation: st-drift 40s ease-in-out infinite alternate; filter: saturate(.85); }
@keyframes st-drift { from { transform: scale(1.02) translate(0, 0); } to { transform: scale(1.1) translate(-2%, -1%); } }
.st-title-shade { position: absolute; inset: 0;
  background: linear-gradient(90deg, rgba(4,6,8,.92) 0%, rgba(4,6,8,.72) 34%, rgba(4,6,8,.1) 70%, rgba(4,6,8,.35) 100%),
              linear-gradient(0deg, rgba(4,6,8,.85) 0%, transparent 30%); }
.st-title-col { position: absolute; left: 7vw; top: 50%; transform: translateY(-50%); width: min(560px, 86vw); }
.st-kicker { font-size: calc(12px * var(--st-k)); letter-spacing: .38em; color: var(--st-ghost); opacity: .85; }
.st-title { font-size: calc(64px * var(--st-k)); font-weight: 800; letter-spacing: .02em; line-height: 1.05; margin: 14px 0 10px;
  text-shadow: 0 0 30px rgba(159, 220, 255, .25); }
.st-sub { font-size: calc(17px * var(--st-k)); color: var(--st-ink-2); line-height: 1.6; margin-bottom: calc(36px * var(--st-k)); }
.st-menu { display: flex; flex-direction: column; gap: 10px; }
.st-foot { position: absolute; left: 7vw; bottom: 4vh; font-size: calc(12px * var(--st-k)); color: var(--st-ink-3); letter-spacing: .08em; }

/* ---------- episode select ---------- */
.st-eps { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; padding: 0 6vw;
  background: rgba(4, 6, 8, .78); backdrop-filter: blur(6px); }
.st-eps h2 { font-size: calc(30px * var(--st-k)); font-weight: 700; margin: 0 0 6px; }
.st-eps .st-eps-sub { color: var(--st-ink-2); margin-bottom: calc(28px * var(--st-k)); font-size: calc(15px * var(--st-k)); }
.st-cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: calc(18px * var(--st-k)); }
.st-card { pointer-events: auto; position: relative; border: 1px solid var(--st-hair); background: #0b0f13; cursor: pointer;
  text-align: left; color: var(--st-ink); font-family: var(--st-font); padding: 0; transition: transform .2s, border-color .2s; }
.st-card:hover, .st-card:focus-visible { transform: translateY(-4px); border-color: rgba(159, 220, 255, .6); outline: none; }
.st-card img { display: block; width: 100%; aspect-ratio: 3 / 2; object-fit: cover; filter: saturate(.8); }
.st-card-body { padding: calc(14px * var(--st-k)) calc(16px * var(--st-k)) calc(18px * var(--st-k)); }
.st-card-ep { font-size: calc(11px * var(--st-k)); letter-spacing: .32em; color: var(--st-ghost); }
.st-card-name { font-size: calc(22px * var(--st-k)); font-weight: 700; margin: 6px 0 6px; }
.st-card-log { font-size: calc(13px * var(--st-k)); color: var(--st-ink-2); line-height: 1.55; min-height: 3.1em; }
.st-card-meta { font-size: calc(12px * var(--st-k)); color: var(--st-ink-3); margin-top: 10px; }
.st-card.locked { cursor: not-allowed; }
.st-card.locked img { filter: grayscale(1) brightness(.35); }
.st-card.locked:hover { transform: none; border-color: var(--st-hair); }
.st-lock { position: absolute; left: 0; right: 0; top: 0; aspect-ratio: 3 / 2; display: flex; align-items: center;
  justify-content: center; font-size: calc(14px * var(--st-k)); color: var(--st-ink-2); letter-spacing: .08em; }
.st-card.cleared .st-card-ep::after { content: '  ·  완료'; color: var(--st-ink-3); letter-spacing: .1em; }
.st-back { margin-top: calc(26px * var(--st-k)); min-width: 0; align-self: flex-start; }

/* ---------- cutscene ---------- */
.st-cut { background: #000; }
.st-cut-img { position: absolute; inset: 0; background-size: cover; background-position: center; opacity: 0;
  transition: opacity 1.2s ease, transform var(--st-kb, 9s) linear; transform: scale(1.0); will-change: transform, opacity; }
.st-cut-img.on { opacity: 1; }
.st-cut-img.kb { transform: scale(1.09) translate(var(--st-kx, -1%), var(--st-ky, -1%)); }
.st-bars::before, .st-bars::after { content: ''; position: absolute; left: 0; right: 0; height: 9vh; background: #000; z-index: 2; }
.st-bars::before { top: 0; }
.st-bars::after { bottom: 0; }
.st-cut-shade { position: absolute; inset: 0; background: linear-gradient(0deg, rgba(0,0,0,.82) 0%, rgba(0,0,0,.2) 38%, transparent 60%); z-index: 1; }
.st-cut-text { position: absolute; left: 50%; bottom: calc(9vh + 5vh); transform: translateX(-50%); width: min(1000px, 88vw);
  text-align: center; z-index: 3; }
.st-cut-who { font-size: calc(13px * var(--st-k)); letter-spacing: .3em; color: var(--st-ghost); min-height: 1.3em; margin-bottom: 8px; opacity: .9; }
.st-cut-line { font-size: calc(24px * var(--st-k)); line-height: 1.6; font-weight: 500; text-shadow: 0 2px 12px rgba(0,0,0,.9);
  opacity: 0; transform: translateY(6px); transition: opacity .55s ease, transform .55s ease; word-break: keep-all; }
.st-cut-line.on { opacity: 1; transform: none; }
.st-cut-skip { position: absolute; right: 3vw; top: calc(9vh + 2vh); z-index: 3; min-width: 0; font-size: calc(13px * var(--st-k));
  padding: 8px 14px; background: rgba(0,0,0,.45); }
.st-cut-hint { position: absolute; right: 3vw; bottom: calc(9vh + 2vh); z-index: 3; font-size: calc(12px * var(--st-k)); color: var(--st-ink-3); }
.st-cut-card { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
  z-index: 4; background: #000; transition: opacity 1s ease; }
.st-cut-card.out { opacity: 0; pointer-events: none; }
.st-cut-card .st-card-ep { font-size: calc(14px * var(--st-k)); }
.st-cut-card .st-cc-name { font-size: calc(54px * var(--st-k)); font-weight: 800; margin: 14px 0; letter-spacing: .04em; }
.st-cut-card .st-cc-meta { color: var(--st-ink-2); font-size: calc(15px * var(--st-k)); letter-spacing: .12em; }

/* ---------- screens ---------- */
.st-screen { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;
  background: radial-gradient(ellipse at center, rgba(8,10,12,.82) 0%, rgba(2,3,4,.96) 70%); }
.st-screen.death { background: radial-gradient(ellipse at center, rgba(60,6,4,.72) 0%, rgba(8,2,2,.96) 70%); }
.st-screen h1 { font-size: calc(72px * var(--st-k)); font-weight: 800; margin: 0 0 8px; letter-spacing: .12em; }
.st-screen .st-screen-sub { color: var(--st-ink-2); font-size: calc(16px * var(--st-k)); letter-spacing: .14em; margin-bottom: calc(34px * var(--st-k)); }
.st-screen .st-row { display: flex; gap: 12px; }
.st-screen .st-btn { min-width: calc(190px * var(--st-k)); text-align: center; }
.st-screen .st-btn:hover { transform: translateY(-2px); }
.st-load-bar { width: min(360px, 60vw); height: 2px; background: var(--st-hair); overflow: hidden; margin: 18px auto 0; }
.st-load-bar i { display: block; height: 100%; width: 40%; background: var(--st-ghost); animation: st-load 1.4s ease-in-out infinite; }
@keyframes st-load { from { transform: translateX(-100%); } to { transform: translateX(250%); } }
.st-start { pointer-events: auto; cursor: pointer; }
.st-blink { animation: st-blink 1.6s ease-in-out infinite; }
@keyframes st-blink { 50% { opacity: .35; } }

/* ---------- story HUD ---------- */
.st-obj { position: absolute; left: calc(26px * var(--st-k)); top: calc(222px * var(--st-k)); max-width: calc(330px * var(--st-k));
  padding: calc(10px * var(--st-k)) calc(14px * var(--st-k)); background: linear-gradient(90deg, rgba(6,9,12,.62), rgba(6,9,12,0));
  border-left: 2px solid var(--st-amber); transition: opacity .4s, transform .4s; }
.st-obj.off { opacity: 0; transform: translateX(-8px); }
.st-obj-label { font-size: calc(11px * var(--st-k)); letter-spacing: .3em; color: var(--st-amber); }
.st-obj-text { font-size: calc(16px * var(--st-k)); font-weight: 600; margin-top: 4px; text-shadow: 0 1px 4px rgba(0,0,0,.8); word-break: keep-all; }
.st-obj.flash { animation: st-flash 1.2s ease-out; }
@keyframes st-flash { 0% { background: rgba(255,176,42,.35); } 100% { background: linear-gradient(90deg, rgba(6,9,12,.62), rgba(6,9,12,0)); } }
.st-radio { position: absolute; left: 50%; bottom: 17vh; transform: translateX(-50%); width: min(880px, 80vw); text-align: center; }
.st-radio-box { display: inline-block; padding: calc(9px * var(--st-k)) calc(18px * var(--st-k)); background: rgba(4,7,10,.6);
  border-top: 1px solid var(--st-hair); transition: opacity .35s; }
.st-radio-box.off { opacity: 0; }
.st-radio-who { font-size: calc(12px * var(--st-k)); letter-spacing: .22em; color: var(--st-amber); margin-right: 10px; }
.st-radio-text { font-size: calc(18px * var(--st-k)); line-height: 1.5; text-shadow: 0 1px 6px rgba(0,0,0,.9); word-break: keep-all; }
.st-radio-box.ghost .st-radio-who { color: var(--st-ghost); }
.st-radio-box.ghost .st-radio-text { color: #cfeeff; text-shadow: 0 0 10px rgba(159,220,255,.7), 2px 0 0 rgba(255,60,60,.25), -2px 0 0 rgba(60,200,255,.25); }
.st-boss { position: absolute; left: 50%; top: calc(80px * var(--st-k)); transform: translateX(-50%); width: min(560px, 60vw); text-align: center;
  transition: opacity .5s; }
.st-boss.off { opacity: 0; }
.st-boss-name { font-size: calc(13px * var(--st-k)); letter-spacing: .4em; color: #ffb3ad; margin-bottom: 6px; text-shadow: 0 0 8px rgba(224,67,58,.6); }
.st-boss-bar { height: calc(6px * var(--st-k)); background: rgba(255,255,255,.1); border: 1px solid rgba(224,67,58,.35); }
.st-boss-bar i { display: block; height: 100%; background: linear-gradient(90deg, #7a0d08, var(--st-red)); transform-origin: left; }
.st-vig { position: absolute; inset: 0; opacity: 0; background: radial-gradient(ellipse at center, transparent 35%, rgba(120,190,255,.32) 100%); }
.st-vig.red { background: radial-gradient(ellipse at center, transparent 35%, rgba(170,10,10,.45) 100%); }
`;

export function installStoryStyles() {
  if (document.getElementById('story-style')) return;
  const s = document.createElement('style');
  s.id = 'story-style';
  s.textContent = CSS;
  document.head.appendChild(s);
}

/** The shared story root (#story-ui), created on first use, with --st-k kept in step with the window. */
export function storyRoot() {
  installStoryStyles();
  let root = document.getElementById('story-ui');
  if (!root) {
    root = document.createElement('div');
    root.id = 'story-ui';
    document.body.appendChild(root);
    const fit = () => {
      const k = Math.min(2.4, Math.max(0.62, innerHeight / 1080));
      document.documentElement.style.setProperty('--st-k', k.toFixed(3));
    };
    fit();
    addEventListener('resize', fit);
  }
  return root;
}

export function h(tag, cls, parent, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}

/** Story art lives in public/story; Vite serves public/ at the base URL. */
export const art = (name) => `${import.meta.env?.BASE_URL ?? '/'}story/${name}.webp`;
