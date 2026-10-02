import ep1 from './ep1.js';
import ep2 from './ep2.js';
import ep3 from './ep3.js';

/** Episodes in order. Adding EP4 = one data file + one line here. */
export const EPISODES = [ep1, ep2, ep3];

export function episode(n) {
  return EPISODES[Math.min(EPISODES.length, Math.max(1, n | 0)) - 1];
}
