/**
 * Story progress: which episodes are unlocked. Lives in localStorage, which can
 * be missing, blocked or full (private windows, previews), so every access is
 * guarded and the game falls back to "episode 1 unlocked" instead of failing.
 */

const KEY = 'cod.story.progress.v1';
export const EPISODE_COUNT = 3;

function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

const fresh = () => ({ unlocked: 1, cleared: [] });

export function loadProgress(storage = defaultStorage()) {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return fresh();
    const p = JSON.parse(raw);
    const unlocked = Math.min(EPISODE_COUNT, Math.max(1, p.unlocked | 0));
    const cleared = Array.isArray(p.cleared) ? p.cleared.filter((n) => Number.isInteger(n)) : [];
    return { unlocked, cleared };
  } catch {
    return fresh();
  }
}

export function markCleared(ep, storage = defaultStorage()) {
  const p = loadProgress(storage);
  if (!p.cleared.includes(ep)) p.cleared.push(ep);
  p.unlocked = Math.min(EPISODE_COUNT, Math.max(p.unlocked, ep + 1));
  try {
    storage?.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage blocked: progress lives for this page only */
  }
  return p;
}
