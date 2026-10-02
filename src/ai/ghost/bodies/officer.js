/**
 * Ghost body: the Black Officer (EP3 boss). The agent's skinned mesh in the
 * black-smoke variant of the ghost shader, plus two red eyes that ride the head
 * bone. The eyes are tiny additive spheres in world space, re-placed every frame
 * from the animated head — the rig's bone axes are not documented, the agent's
 * facing (`yaw`, forward = (sin, 0, cos)) is.
 */

import * as THREE from 'three';
import { makeGhostMaterial, createDepthPrime } from '../material.js';

export function createOfficerBody(agent, ctx, opts = {}) {
  const mat = makeGhostMaterial({
    dark: true,
    color: [0.004, 0.004, 0.005],
    rim: opts.rim ?? [1.0, 0.06, 0.03],
    height: 1.8,
  });
  const mesh = agent.mesh;
  const original = mesh.material;
  mesh.material = mat;
  const prime = createDepthPrime(mesh, mat);
  const u = mat.userData.ghost;

  const eyeGeo = new THREE.SphereGeometry(0.022, 8, 6);
  const eyeMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(9, 0.35, 0.2),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
  eyeMat.userData.owNoPatch = true;
  const eyes = [new THREE.Mesh(eyeGeo, eyeMat), new THREE.Mesh(eyeGeo, eyeMat)];
  const parent = agent.group.parent ?? ctx.scene;
  for (const e of eyes) {
    e.frustumCulled = false;
    e.userData.owNoShadow = true;
    parent.add(e);
  }
  const head = new THREE.Vector3();
  let dissolve = 0;

  return {
    object3D: mesh,
    update(dt, t) {
      u.uTime.value = t;
      agent.animator.bonePos('Head', head);
      const s = agent.scale;
      const fx = Math.sin(agent.yaw), fz = Math.cos(agent.yaw);
      // eyes: forward of the face, slightly up, either side of the nose
      const bx = head.x + fx * 0.095 * s;
      const by = head.y + 0.045 * s;
      const bz = head.z + fz * 0.095 * s;
      const rx = -fz * 0.034 * s, rz = fx * 0.034 * s;
      eyes[0].position.set(bx + rx, by, bz + rz);
      eyes[1].position.set(bx - rx, by, bz - rz);
      // eyes pulse, and go out as the body dissolves
      const k = (0.75 + 0.25 * Math.sin(t * 5.3)) * (1 - dissolve);
      eyes[0].scale.setScalar(Math.max(0.001, k) * s);
      eyes[1].scale.setScalar(Math.max(0.001, k) * s);
    },
    setFlicker(v) {
      u.uFlicker.value = v;
    },
    setDissolve(v) {
      dissolve = v;
      u.uDissolve.value = v;
    },
    setGlitch(v) {
      u.uGlitch.value = v;
    },
    setGain(v) {
      u.uGain.value = v;
    },
    dispose() {
      if (mesh.material === mat) mesh.material = original;
      for (const e of eyes) e.parent?.remove(e);
      eyeGeo.dispose();
      eyeMat.dispose();
      prime.dispose();
      mat.dispose();
    },
  };
}
