/**
 * Ghost body: the fallen soldier. The agent's own skinned soldier mesh, with its
 * nine-slot material array swapped for one ghost material (a single material
 * draws the whole geometry, groups ignored), so the RIG skeleton keeps driving
 * it and hitboxes stay where the body is.
 *
 * Body contract (see ./index.js): { object3D, update(dt, t), setFlicker(v),
 * setDissolve(v), setGlitch(v), setGain(v), dispose() }
 */

import { makeGhostMaterial, createDepthPrime } from '../material.js';

export function createSoldierBody(agent, ctx, opts = {}) {
  const mat = makeGhostMaterial({
    color: opts.color ?? [0.22, 0.55, 1.0],
    rim: opts.rim ?? [0.55, 0.9, 1.3],
    height: 1.8,
  });
  const mesh = agent.mesh;
  const original = mesh.material;
  mesh.material = mat;
  const prime = createDepthPrime(mesh, mat);
  const u = mat.userData.ghost;
  return {
    object3D: mesh,
    update(dt, t) {
      u.uTime.value = t;
    },
    setFlicker(v) {
      u.uFlicker.value = v;
    },
    setDissolve(v) {
      u.uDissolve.value = v;
    },
    setGlitch(v) {
      u.uGlitch.value = v;
    },
    setGain(v) {
      u.uGain.value = v;
    },
    dispose() {
      // the shared soldier materials go back: they belong to ai, not to us
      if (mesh.material === mat) mesh.material = original;
      prime.dispose();
      mat.dispose();
    },
  };
}
