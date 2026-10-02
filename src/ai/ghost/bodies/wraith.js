/**
 * Ghost body: the civilian wraith — a shrouded figure, cloth over head and
 * shoulders falling to the ground. Non-combat: haunt.js stands one at the end of
 * an alley for a few seconds and lets it fade. Built in code from a lathe
 * profile (robe) plus a sphere (head under the cloth); the ghost shader's sway
 * moves the hem.
 *
 * Unlike the soldier bodies this one owns its object3D: the caller adds it to
 * the scene and positions it.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeGhostMaterial } from '../material.js';

let _geo = null;
let _users = 0;

function robeGeometry() {
  if (_geo) return _geo;
  // (radius, height) up the figure: wide hem, narrow waist, shoulders, hood
  const prof = [
    [0.0, 0.0], [0.36, 0.02], [0.33, 0.25], [0.27, 0.6], [0.24, 0.95],
    [0.27, 1.2], [0.25, 1.36], [0.16, 1.44], [0.12, 1.5], [0.13, 1.6],
    [0.1, 1.7], [0.0, 1.74],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const robe = new THREE.LatheGeometry(prof, 28);
  const head = new THREE.SphereGeometry(0.11, 18, 12);
  head.translate(0, 1.57, 0.03);
  const merged = mergeGeometries([robe.toNonIndexed(), head.toNonIndexed()]);
  robe.dispose();
  head.dispose();
  merged.computeVertexNormals();
  merged.computeBoundingSphere();
  _geo = merged;
  return _geo;
}

export function createWraithBody(ctx, opts = {}) {
  const geo = robeGeometry();
  _users++;
  const mat = makeGhostMaterial({
    color: opts.color ?? [0.42, 0.62, 0.9],
    rim: opts.rim ?? [0.85, 1.05, 1.35],
    height: 1.74,
    sway: 1,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'wraith';
  mesh.frustumCulled = false;
  mesh.userData.owNoShadow = true;
  mesh.scale.setScalar(opts.scale ?? 1);
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
      mesh.parent?.remove(mesh);
      mat.dispose();
      if (--_users === 0) {
        _geo.dispose();
        _geo = null;
      }
    },
  };
}
