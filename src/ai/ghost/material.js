/**
 * GHOST — the shared ghost shader, as a MeshBasicMaterial patch.
 *
 * MeshBasic on purpose: it is unlit, so the render patcher leaves it alone (no
 * CSM / GTAO / bounce injected) and it never depends on the scene's point-light
 * count, which is a program-cache key everywhere else. It is transparent, so
 * render keeps it out of the depth/normal/velocity prepass and the shadow
 * cascades automatically (see ARCHITECTURE.md, "Render integration").
 *
 * Works on skinned and plain meshes: with USE_SKINNING three has already built
 * the view-space `transformedNormal`; without it we derive our own.
 *
 * Every material carries its own uniforms (one per ghost: each dissolves and
 * flickers on its own clock) but the same customProgramCacheKey, so all ghosts
 * of one look share a single GL program.
 *
 *   uTime      seconds, drives bands / noise / glitch
 *   uDissolve  0 solid .. 1 gone (noise threshold discard with a glowing edge)
 *   uFlicker   0..1 strobe amount
 *   uGlitch    0..1 horizontal slice displacement
 *   uSway      0..1 cloth sway (wraith robes)
 *   uOpacity   overall alpha
 *   uGain      brightness trim, for exposure (night vs dusk)
 */

import * as THREE from 'three';

/** Night exposure in this renderer is several stops up: unit gain blows out. */
export const DEFAULT_GAIN = 0.2;

const NOISE = /* glsl */ `
float gHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float gNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(gHash(i + vec3(0, 0, 0)), gHash(i + vec3(1, 0, 0)), f.x),
                 mix(gHash(i + vec3(0, 1, 0)), gHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(gHash(i + vec3(0, 0, 1)), gHash(i + vec3(1, 0, 1)), f.x),
                 mix(gHash(i + vec3(0, 1, 1)), gHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
`;

const VERT_PARS = /* glsl */ `
uniform float uTime;
uniform float uGlitch;
uniform float uSway;
uniform float uHeight;
varying vec3 vGN;
varying vec3 vGV;
varying vec3 vGP;
`;

const VERT_DISPLACE = /* glsl */ `
#include <skinning_vertex>
{
  // glitch: whole horizontal slices jump sideways for a frame or two
  float gs = floor(transformed.y * 14.0) + floor(uTime * 24.0) * 3.1;
  float gh = fract(sin(gs * 91.7) * 43758.5453);
  transformed.x += uGlitch * (gh - 0.5) * 0.22 * step(0.62, gh);
  // sway: hems move, shoulders do not
  float hem = max(0.0, 1.0 - transformed.y / uHeight);
  transformed.x += uSway * sin(uTime * 1.3 + transformed.y * 2.1) * 0.06 * hem;
  transformed.z += uSway * cos(uTime * 1.1 + transformed.y * 1.7) * 0.05 * hem;
}
`;

const VERT_OUT = /* glsl */ `
#include <project_vertex>
vGV = -mvPosition.xyz;
vGP = transformed;
#ifdef USE_SKINNING
  vGN = transformedNormal;
#else
  vGN = normalMatrix * objectNormalGhost;
#endif
`;

const FRAG_PARS = /* glsl */ `
uniform float uTime;
uniform float uDissolve;
uniform float uFlicker;
uniform float uOpacity;
uniform float uGain;
uniform vec3 uColor;
uniform vec3 uRim;
varying vec3 vGN;
varying vec3 vGV;
varying vec3 vGP;
${NOISE}
`;

const FRAG_SHADE = /* glsl */ `
{
  vec3 N = normalize(vGN);
  vec3 V = normalize(vGV);
  float fres = pow(1.0 - clamp(abs(dot(N, V)), 0.0, 1.0), 2.2);
  float n = gNoise(vGP * 5.0 + vec3(0.0, -uTime * 0.7, 0.0));

  float dn = gNoise(vGP * 7.0 + 3.7);
  if (dn < uDissolve) discard;
  float edge = (1.0 - smoothstep(0.0, 0.09, dn - uDissolve)) * step(0.001, uDissolve);

  float flickRoll = fract(sin(floor(uTime * 17.0) * 12.9898) * 43758.5453);
  float flick = 1.0 - uFlicker * 0.8 * step(0.5, flickRoll);

#ifdef GHOST_DARK
  // black smoke: a near-opaque dark body, only the silhouette burns like an ember
  float feet = smoothstep(0.0, 0.6, vGP.y);
  outgoingLight = uColor * (0.5 + 0.8 * n) + (uRim * pow(fres, 2.2) * 1.5 + uRim * edge * 3.0) * uGain * flick;
  diffuseColor.a = uOpacity * feet * clamp(0.7 + 0.3 * n, 0.0, 1.0);
#else
  // pale and see-through: bands crawl up the body, the rim carries the shape,
  // and the legs thin out into nothing towards the ground
  float band = 0.55 + 0.45 * sin(vGP.y * 22.0 - uTime * 3.0);
  float body = (0.10 + 0.20 * band) * (0.5 + 1.0 * n);
  float feet = smoothstep(0.05, 0.75, vGP.y);
  outgoingLight = (uColor * body + uRim * pow(fres, 1.6) * 1.4 + uRim * edge * 3.0) * uGain * flick * feet;
  diffuseColor.a = uOpacity;
#endif
}
#include <opaque_fragment>
`;

/**
 * @param {object} o
 * @param {number[]} [o.color]   body tint, linear RGB
 * @param {number[]} [o.rim]     fresnel / edge tint, linear RGB (HDR ok)
 * @param {boolean}  [o.dark]    black-smoke variant (normal blending)
 * @param {number}   [o.height]  model height for sway falloff (m)
 * @param {number}   [o.sway]    initial cloth sway 0..1
 */
export function makeGhostMaterial(o = {}) {
  const dark = !!o.dark;
  const uniforms = o.uniforms ?? {
    uTime: { value: 0 },
    uDissolve: { value: 0 },
    uFlicker: { value: 0 },
    uGlitch: { value: 0 },
    uSway: { value: o.sway ?? 0 },
    uHeight: { value: o.height ?? 1.8 },
    uOpacity: { value: o.opacity ?? 1 },
    uGain: { value: o.gain ?? DEFAULT_GAIN },
    uColor: { value: new THREE.Color().fromArray(o.color ?? [0.32, 0.72, 1.0]) },
    uRim: { value: new THREE.Color().fromArray(o.rim ?? [0.7, 1.1, 1.4]) },
  };
  const m = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    depthWrite: false,
    blending: dark ? THREE.NormalBlending : THREE.AdditiveBlending,
    side: THREE.FrontSide,
    toneMapped: false,
    fog: false,
  });
  m.name = dark ? 'ghost_dark' : 'ghost';
  m.userData.ghost = uniforms;
  m.userData.owNoPatch = true;
  if (dark) m.defines = { GHOST_DARK: '' };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_PARS}`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvec3 objectNormalGhost = vec3( normal );')
      .replace('#include <skinning_vertex>', VERT_DISPLACE)
      .replace('#include <project_vertex>', VERT_OUT);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_PARS}`)
      .replace('#include <opaque_fragment>', FRAG_SHADE);
  };
  m.customProgramCacheKey = () => (dark ? 'ow-ghost-dark-v3' : 'ow-ghost-v3');
  return m;
}

/**
 * A depth-only twin of a ghost mesh, drawn just before it (renderOrder), so the
 * colour pass only blends the nearest surface. Without it every inner face of
 * the soldier — pouches behind the plate carrier, the far arm — adds in too and
 * the ghost reads as an over-exposed x-ray. Shares the ghost's uniforms, so it
 * dissolves, glitches and sways in lockstep (a dissolved pixel must not leave
 * depth behind, or it would punch a hole in whatever is behind the ghost).
 */
export function createDepthPrime(mesh, ghostMaterial) {
  const u = ghostMaterial.userData.ghost;
  const dark = ghostMaterial.defines?.GHOST_DARK !== undefined;
  const pm = makeGhostMaterial({ uniforms: u, dark });
  pm.colorWrite = false;
  pm.depthWrite = true;
  pm.blending = THREE.NoBlending;
  pm.name = 'ghost_prime';
  let prime;
  if (mesh.isSkinnedMesh) {
    prime = new THREE.SkinnedMesh(mesh.geometry, pm);
    prime.bind(mesh.skeleton, mesh.bindMatrix);
  } else {
    prime = new THREE.Mesh(mesh.geometry, pm);
  }
  prime.name = 'ghost_prime';
  prime.frustumCulled = mesh.frustumCulled;
  prime.userData.owNoShadow = true;
  prime.renderOrder = 7;
  mesh.renderOrder = 8;
  mesh.add(prime);
  return {
    mesh: prime,
    dispose() {
      prime.parent?.remove(prime);
      pm.dispose();
    },
  };
}
