#!/usr/bin/env node
/**
 * Story logic self-test — no browser, no THREE. Runs the Director against a fake
 * runtime and checks the progress store.
 *
 *   node src/story/selftest.mjs
 */
import { Director, STEPS } from './director.js';
import { loadProgress, markCleared } from './progress.js';

let passed = 0;
let failed = 0;
const check = (name, cond, detail = '') => {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

/** A fake runtime: the test drives distance, alive counts and the F key. */
function fakeRt() {
  const rt = {
    calls: [],
    dist: 100,
    alive: {},
    use: false,
    radioBusyFlag: false,
    distanceTo() { return rt.dist; },
    setObjective(o) { rt.calls.push(['objective', o.id]); },
    clearObjective(id) { rt.calls.push(['clearObjective', id]); },
    radio(who, text) { rt.calls.push(['radio', who, text]); },
    radioBusy() { return rt.radioBusyFlag; },
    spawn(unit, group) {
      rt.calls.push(['spawn', unit.type, group]);
      rt.alive[group] = (rt.alive[group] ?? 0) + 1;
      return { alive: true };
    },
    aliveCount(group) { return rt.alive[group] ?? 0; },
    usePressed() { return rt.use; },
    prompt(p) { rt.calls.push(['prompt', p.text, p.progress]); },
    clearPrompt() { rt.calls.push(['clearPrompt']); },
    haunt(kind) { rt.calls.push(['haunt', kind]); },
    setSky(s) { rt.calls.push(['sky', s.hour]); },
    bossBar(f) { rt.calls.push(['bossBar', f]); },
    banish() { rt.calls.push(['banish']); },
    outro() { rt.calls.push(['outro']); },
  };
  return rt;
}
const kinds = (rt) => rt.calls.map((c) => c[0]);

// 1-3, 6: instant steps chain, reach blocks, killAll waits, wait counts, outro ends
{
  const rt = fakeRt();
  const d = new Director(
    [
      { do: 'objective', id: 'a', text: 'A', at: [0, 0] },
      { do: 'spawn', group: 'g1', units: [{ type: 'irregular', at: [1, 1] }, { type: 'irregular', at: [2, 2] }] },
      { do: 'reach', at: [0, 0], radius: 5 },
      { do: 'killAll', group: 'g1' },
      { do: 'wait', seconds: 1 },
      { do: 'outro' },
    ],
    rt
  );
  d.start();
  d.update(0.016);
  check('instant steps chain in one update', kinds(rt).join() === 'objective,spawn,spawn', kinds(rt).join());
  check('reach blocks while far', d.index === 2 && d.current.do === 'reach', `index ${d.index}`);
  rt.dist = 4;
  d.update(0.016);
  check('reach completes inside radius', d.index === 3, `index ${d.index}`);
  d.update(0.016);
  check('killAll waits for survivors', d.index === 3);
  rt.alive.g1 = 0;
  d.update(0.016);
  check('killAll completes at zero', d.index === 4, `index ${d.index}`);
  d.update(0.5);
  check('wait not done at 0.5s', d.index === 4);
  d.update(0.6);
  check('wait done after 1.1s and outro ran', d.done && kinds(rt).at(-1) === 'outro', kinds(rt).join());
}

// 4: interact ignores F out of range, completes in range, manages the prompt
{
  const rt = fakeRt();
  const d = new Director([{ do: 'interact', at: [0, 0], radius: 3, text: '중계기 가동' }, { do: 'outro' }], rt);
  d.start();
  rt.use = true;
  d.update(0.016);
  check('interact ignores F out of range', d.index === 0);
  rt.dist = 2;
  rt.use = false;
  d.update(0.016);
  check('interact shows prompt in range', rt.calls.some((c) => c[0] === 'prompt'));
  rt.use = true;
  d.update(0.016);
  check('interact completes on F in range', d.done, `index ${d.index}`);
  check('interact clears its prompt', rt.calls.some((c) => c[0] === 'clearPrompt'));
}

// 5: hold counts seconds, spawns on a cadence, clears its prompt
{
  const rt = fakeRt();
  const d = new Director(
    [
      { do: 'hold', at: [0, 0], radius: 6, seconds: 3, text: '버티기', spawnEvery: 1, group: 'h', units: [{ type: 'ghost' }] },
      { do: 'outro' },
    ],
    rt
  );
  d.start();
  rt.dist = 1;
  for (let i = 0; i < 10; i++) d.update(0.25); // 2.5 s
  const spawns = rt.calls.filter((c) => c[0] === 'spawn').length;
  check('hold spawns on cadence', spawns === 2, `spawns ${spawns}`);
  check('hold not done at 2.5s', !d.done);
  d.update(0.6);
  check('hold done after 3.1s', d.done);
  check('hold clears prompt', rt.calls.some((c) => c[0] === 'clearPrompt'));
}

// 7: start(index) skips, skip() force-completes a blocking step
{
  const rt = fakeRt();
  const d = new Director(
    [
      { do: 'objective', id: 'a', text: 'A' },
      { do: 'reach', at: [0, 0], radius: 1 },
      { do: 'radio', who: '본부', text: '...' },
      { do: 'reach', at: [9, 9], radius: 1 },
      { do: 'outro' },
    ],
    rt
  );
  d.start(3);
  d.update(0.016);
  check('start(3) skipped earlier steps', !kinds(rt).includes('objective') && d.index === 3);
  d.skip();
  d.update(0.016);
  check('skip() completes the blocking step', d.done && kinds(rt).at(-1) === 'outro', kinds(rt).join());
}

// radio with wait blocks until the HUD has finished the line
{
  const rt = fakeRt();
  rt.radioBusyFlag = true;
  const d = new Director([{ do: 'radio', who: 'A', text: 'x', wait: true }, { do: 'outro' }], rt);
  d.start();
  d.update(0.016);
  check('radio wait blocks while busy', !d.done);
  rt.radioBusyFlag = false;
  d.update(0.016);
  check('radio wait releases', d.done);
}

// boss: done when the spawned boss dies, drives the bar
{
  const rt = fakeRt();
  const boss = { alive: true, health: 2000, maxHealth: 2000 };
  rt.spawn = (unit, group) => (rt.calls.push(['spawn', unit.type, group]), boss);
  const d = new Director([{ do: 'boss', unit: { type: 'officer', at: [0, -36] } }, { do: 'outro' }], rt);
  d.start();
  d.update(0.016);
  boss.health = 1000;
  d.update(0.016);
  const bar = rt.calls.filter((c) => c[0] === 'bossBar').at(-1);
  check('boss bar tracks health', bar && Math.abs(bar[1] - 0.5) < 1e-6, JSON.stringify(bar));
  boss.alive = false;
  d.update(0.016);
  check('boss step ends on death and hides bar', d.done && rt.calls.some((c) => c[0] === 'bossBar' && c[1] === null));
}

// unknown step types are reported, not silently skipped
{
  let threw = false;
  try {
    new Director([{ do: 'nope' }], fakeRt());
  } catch {
    threw = true;
  }
  check('unknown step type throws at construction', threw);
}

// episode data only uses known step types
{
  const { EPISODES } = await import('./episodes/index.js').catch(() => ({ EPISODES: null }));
  if (EPISODES) {
    for (const ep of EPISODES) {
      for (const s of [...ep.steps]) {
        check(`ep${ep.id} step "${s.do}" is known`, !!STEPS[s.do]);
      }
      check(`ep${ep.id} ends with outro`, ep.steps.at(-1)?.do === 'outro');
      for (const sl of [...ep.intro, ...ep.outro]) check(`ep${ep.id} slide has img`, typeof sl.img === 'string');
    }
  }
}

// 8: progress store
{
  const mem = () => {
    const m = new Map();
    return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) };
  };
  const s = mem();
  check('fresh progress unlocks ep1', loadProgress(s).unlocked === 1);
  markCleared(1, s);
  check('clearing ep1 unlocks ep2', loadProgress(s).unlocked === 2);
  markCleared(3, s);
  check('unlocked never exceeds 3', loadProgress(s).unlocked === 3);
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  check('throwing storage falls back', loadProgress(broken).unlocked === 1);
  let ok = true;
  try { markCleared(1, broken); } catch { ok = false; }
  check('throwing storage never throws out', ok);
  const junk = { getItem: () => '{not json', setItem() {} };
  check('corrupt storage falls back', loadProgress(junk).unlocked === 1);
}

console.log(`${failed ? 'FAILED' : 'ok'} ${passed}/${passed + failed}`);
process.exit(failed ? 1 : 0);
