/**
 * Ghost bodies — the swappable look of a ghost, kept apart from its behaviour.
 *
 * GhostAgent (../behaviour.js) only ever talks to this contract:
 *
 *   {
 *     object3D,          the thing in the scene (for a soldier: the agent's own mesh)
 *     update(dt, t),     per frame; t = engine elapsed seconds
 *     setFlicker(v),     0..1
 *     setDissolve(v),    0 solid .. 1 gone
 *     setGlitch(v),      0..1
 *     setGain(v),        brightness trim
 *     dispose(),
 *   }
 *
 * Today every body is built in code. To swap in an AI-generated mesh later, add
 * a file here (e.g. gltf.js: load a .glb with three/addons GLTFLoader, retarget
 * it to the RIG skeleton or parent it to the spine bone) and point the kind at
 * it in BODIES. Hitboxes and animation stay on the agent's invisible RIG
 * skeleton, so behaviour does not change when the look does.
 */

import { createSoldierBody } from './soldier.js';
import { createOfficerBody } from './officer.js';
import { createWraithBody } from './wraith.js';

const BODIES = {
  soldier: createSoldierBody,
  officer: createOfficerBody,
};

export const BODY_KINDS = Object.keys(BODIES);

export function createGhostBody(kind, agent, ctx, opts) {
  const make = BODIES[kind] ?? BODIES.soldier;
  return make(agent, ctx, opts);
}

export { createWraithBody };
