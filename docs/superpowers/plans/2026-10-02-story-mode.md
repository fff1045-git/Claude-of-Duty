# 스토리 모드 「사르말의 원혼」 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 시장 거리 FPS 위에 귀신 컨셉 에피소드 3개짜리 스토리 모드(타이틀 · 컷신 · 무전 · 목표 · 귀신 적 · 보스)를 얹는다.

**Architecture:** 부팅 전 타이틀이 모드를 고르고, 스토리 모드일 때만 `StorySystem`과 귀신 코드를 동적 import 한다. 에피소드는 데이터(단계 목록)이고 THREE에 의존하지 않는 `Director`가 실행한다. 귀신은 기존 `Agent`를 상속한 `GhostAgent`(행동) + 교체 가능한 외형(`bodies/`)으로 나눈다. 에피소드 전환·재시작은 URL 새로고침.

**Tech Stack:** Three.js r180, Vite 7, 순수 ES 모듈, DOM 오버레이, Web Audio 합성. 새 의존성 없음.

**Spec:** `docs/superpowers/specs/2026-10-02-story-mode-design.md`

## Global Constraints

- 새 npm 의존성 금지. `three`와 `three/addons/*`만.
- 게임플레이·비주얼에서 `Math.random()` 금지 → `ctx.rng.fork()` (DOM 연출용 지터도 rng 사용).
- `update()` 안에서 할당 금지 — 벡터·배열은 `init()`/생성자에서 미리 할당.
- 만든 지오메트리·재질·텍스처는 `dispose()`에서 해제.
- **자유 전투 픽셀 불변:** `?capture=1` 경로는 타이틀을 건너뛰고, 스토리 코드는 import 조차 되지 않는다. `tools/baseline.mjs` + `tools/imagediff.mjs`로 11샷 동일 확인.
- 스토리 모드 판정: `ctx.config.mode === 'story'`.
- 좌표: 에피소드 데이터는 LEVEL 좌표 `[x, z]`(layout.js), 런타임에서 `world.levelToWorld`로 변환 후 내비 그리드에 스냅. LEVEL yaw 0 = 아치문(-Z) 방향, 월드 yaw = level yaw + 0.5877.
- 모든 사용자 텍스트는 한국어. 폰트는 시스템 폰트만(`"Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",sans-serif`) — 원작의 오프라인 원칙상 웹폰트 금지.
- 시각 요소(셰이더·DOM 연출)는 TDD 대신 앱 내 브라우저 스크린샷으로 검증한다. 순수 로직(Director, progress)은 Node 자체 테스트로 검증한다.

## 파일 구조

| 파일 | 책임 |
|---|---|
| `src/story/director.js` | 단계 실행기 + 단계 핸들러 표. THREE 의존 없음 |
| `src/story/progress.js` | 해금 진행 저장 (localStorage, try/catch) |
| `src/story/selftest.mjs` | Director·progress Node 테스트 |
| `src/story/episodes/ep1.js`~`ep3.js`, `index.js` | 에피소드 데이터 |
| `src/story/style.js` | 스토리 오버레이 CSS 주입 |
| `src/story/title.js` | 타이틀·에피소드 선택 → `Promise<{mode, ep}>` |
| `src/story/cutscene.js` | 컷신 재생 → `Promise<void>` |
| `src/story/screens.js` | 로딩/시작 대기, 전사, 엔딩 화면 |
| `src/story/hud.js` | 목표 패널, 무전 자막, 보스 체력 바 |
| `src/story/haunt.js` | 원혼 출현, 조명 깜빡임, 왜곡 펄스 |
| `src/story/index.js` | `StorySystem` — Director에 런타임(rt) 어댑터 제공 |
| `src/ai/ghost/material.js` | 귀신 셰이더 재질 팩토리 |
| `src/ai/ghost/bodies/index.js`, `soldier.js`, `officer.js`, `wraith.js` | 교체 가능한 외형 |
| `src/ai/ghost/behaviour.js` | `GhostAgent extends Agent` |
| `src/ai/agent.js` (수정) | `opts.scale`, `opts.surface` 지원 |
| `src/ai/index.js` (수정) | 스토리 모드 자동 배치 끔, `snapToNav`, `remove`, `spawnGhost`, `afterDeath` 훅, `noGroundShadow`, 스토리 모드 귀신 프리웜 |
| `src/fx/index.js` (수정) | `fx.mist(x, y, z, o)` 색 지정 가능한 안개 입자 |
| `src/audio/ghost.js` + `src/audio/index.js` (수정) | `ghost_drone`, `ghost_whisper`, `ghost_swell`, `radio` 합성음 |
| `src/main.js` (수정) | 모드 결정 → 타이틀 → (스토리) 컷신과 부팅 병렬 |
| `public/story/*.webp` | 코덱스 이미지 (생성 완료) |

---

### Task 1: 회귀 기준 캡처 (변경 전)

**Files:** 없음 (산출물은 `art/baseline-before/`, git 제외)

- [ ] **Step 1:** `npm install` 완료 확인, `npx playwright install chromium` (필요 시).
- [ ] **Step 2:** `node tools/baseline.mjs --help` 혹은 소스로 출력 폴더 인자 확인 후, `main` 기준 11샷 캡처를 `art/baseline-before/`에 저장.
- [ ] **Step 3:** 같은 명령을 한 번 더 돌려 `node tools/imagediff.mjs`로 자기 자신과 동일한지(재현성) 확인. 동일하지 않으면 이 환경에서 픽셀 게이트를 쓸 수 없다는 사실을 기록하고, 대체로 `npm run build` + 자유 전투 수동 확인을 쓴다.

### Task 2: Director + progress (TDD)

**Files:**
- Create: `src/story/director.js`, `src/story/progress.js`, `src/story/selftest.mjs`

**Interfaces — Produces:**
```js
// director.js
export class Director {
  constructor(steps, rt, { handlers = STEPS } = {})
  start(index = 0)        // 실행 시작 위치
  update(dt)              // 즉시 단계는 한 프레임에 연달아 처리, 블로킹 단계에서 멈춤
  skip()                  // 현재 블로킹 단계 강제 완료 (개발용)
  get index(); get done(); get current()
}
export const STEPS        // { [type]: { start(step, rt, st) -> true|undefined, update?(dt, step, rt, st) -> bool, end?(step, rt, st) } }
// rt 계약 (StorySystem과 selftest의 가짜 rt가 구현):
//   distanceTo([x,z]) -> 수평 거리(m)      setObjective({id, text, at})   clearObjective(id)
//   radio(who, text, opts)                 radioBusy() -> bool
//   spawn(unit, group) -> handle           aliveCount(group) -> int
//   usePressed() -> bool                   prompt(p) / clearPrompt()
//   haunt(kind, step)                      setSky(step)
//   bossBar(frac|null)                     banish()      outro()
// progress.js
export function loadProgress(storage?) -> { unlocked: 1..3, cleared: number[] }
export function markCleared(ep, storage?) -> progress
```

단계 종류: `objective`, `clearObjective`, `radio`(옵션 `wait: true`), `wait`(seconds), `reach`(at, radius), `spawn`(units, group), `killAll`(group), `interact`(at, radius, text), `hold`(at, radius, seconds, text, spawnEvery, units, group), `haunt`(kind, …), `sky`(hour, rate, weather), `boss`(unit), `banish`, `outro`.

- [ ] **Step 1: 실패하는 테스트 작성** — `selftest.mjs`에 가짜 rt(호출 기록 + 조작 가능한 플레이어 거리·생존 수·F키)로 다음을 검증:
  1. 즉시 단계(objective, spawn)는 첫 `update`에서 연달아 처리되고 `reach`에서 멈춘다.
  2. 거리가 반경 안으로 들어오면 `reach` 완료 → `killAll`은 생존 수 0이 될 때까지 대기.
  3. `wait`는 누적 dt로 완료.
  4. `interact`는 범위 밖 F키를 무시하고 범위 안 F키에 완료, 프롬프트 표시/해제 호출.
  5. `hold`는 초를 세며 `spawnEvery`마다 `spawn` 호출, 완료 시 프롬프트 해제.
  6. `outro`가 rt.outro를 부르고 `done === true`.
  7. `start(3)`은 앞 단계를 건너뛴다. `skip()`은 현재 블로킹 단계를 끝낸다.
  8. progress: 빈 저장소 → unlocked 1; `markCleared(1)` → unlocked 2; 저장소가 예외를 던져도 기본값 반환.
- [ ] **Step 2:** `node src/story/selftest.mjs` → 모듈 없음으로 FAIL 확인.
- [ ] **Step 3:** `director.js`, `progress.js` 구현.
- [ ] **Step 4:** `node src/story/selftest.mjs` → `ok N/N` PASS.
- [ ] **Step 5:** 커밋 `feat(story): add step director and progress store`.

### Task 3: 엔진·AI 훅 (자유 전투 픽셀 불변)

**Files:**
- Modify: `src/ai/agent.js` (생성자 `scale`, 콜라이더 `surface`)
- Modify: `src/ai/index.js` (populate 2곳, update 사망 분기, lateUpdate, 새 메서드)

**Interfaces — Produces:**
```js
// agent.js 생성자
this.scale = opts.scale ?? def.variant.scale ?? 1;
phys.addCollider({ ..., surface: opts.surface ?? 'flesh', ... })
// ai/index.js
ai.snapToNav(x, z, y, out) -> boolean   // 가장 가까운 걸을 수 있는 칸 중심으로 out 설정
ai.remove(agent)                         // agents·squad에서 빼고 dispose
// update(): 사망 분기에서 a.afterDeath?.(dt) 호출
// lateUpdate(): a.noGroundShadow 이면 g.addActor 생략 (syncHitboxes는 유지)
// populate 조건: ... && ctx.config.mode !== 'story'
```

- [ ] **Step 1:** 위 변경 적용. 기존 호출부는 `opts.scale`·`opts.surface`·`mode`를 넘기지 않으므로 동작 동일.
- [ ] **Step 2:** `npm run build` PASS.
- [ ] **Step 3:** Task 1 방식으로 캡처 → `imagediff`로 `art/baseline-before/`와 동일 확인.
- [ ] **Step 4:** 커밋 `feat(ai): add hooks for scripted spawns and custom agents`.

### Task 4: 귀신 외형 스파이크 (반투명 판정)

**Files:**
- Create: `src/ai/ghost/material.js`, `src/ai/ghost/bodies/index.js`, `src/ai/ghost/bodies/soldier.js`

**Interfaces — Produces:**
```js
// material.js
export function makeGhostMaterial({ color, rim, opacity, blending, dark, sway }) -> THREE.MeshBasicMaterial
//   material.userData.ghost = { uTime, uDissolve, uFlicker, uGlitch, uOpacity } (uniform 객체)
//   customProgramCacheKey: 'ghost-' + variant 플래그 → 같은 종류끼리 프로그램 공유
// bodies/index.js
export function createGhostBody(kind, agent, ctx) -> Body
//   Body = { object3D, update(dt, t), setFlicker(v), setDissolve(t), setGlitch(v), dispose() }
export function createWraithBody(ctx) -> Body      // 에이전트 없는 연출용
export const BODY_KINDS                              // ['soldier', 'officer']
```

셰이더 핵심(MeshBasicMaterial `onBeforeCompile`, 스키닝 지원):
- 버텍스: `vGN`(뷰 공간 노멀; 스키닝이면 `transformedNormal`, 아니면 `normalMatrix * normal`), `vGV = -mvPosition.xyz`, `vGY = transformed.y`; `uGlitch`로 높이별 수평 어긋남.
- 프래그먼트: 프레넬 `pow(1 - |N·V|, 2.2)`, 세로 밴드 `0.65 + 0.35 sin(vGY*18 - t*3)`, 해시 노이즈 깜빡임, `uDissolve` 임계값 `discard`, 출력 `outgoingLight = color*body + rim*fresnel`.
- 기본: `transparent: true`, `AdditiveBlending`, `depthWrite: false`, `fog: true`. 렌더는 transparent를 프리패스·CSM에서 자동 제외한다.

- [ ] **Step 1:** 재질 + soldier 외형 구현 (에이전트 메쉬의 `material`을 에이전트별 재질로 교체; 재질 배열 공유 문제 회피).
- [ ] **Step 2:** 임시로 콘솔에서 `__ENGINE__.registry.get('ai')`로 병사 하나 스폰 후 외형 적용, 앱 내 브라우저로 낮/밤 스크린샷.
- [ ] **Step 3:** 판정: 이동 중 TAA 잔상이 귀신답게 보이면 유지. 형체가 뭉개질 정도면 `alphaHash` 디더 + 불투명 경로로 전환(재질 옵션 하나로 분기).
- [ ] **Step 4:** 커밋 `feat(ghost): add ghost material and soldier body`.

### Task 5: 귀신 행동 + 보스 + 원혼 + 안개 + 소리

**Files:**
- Create: `src/ai/ghost/behaviour.js`, `src/ai/ghost/bodies/officer.js`, `src/ai/ghost/bodies/wraith.js`, `src/audio/ghost.js`
- Modify: `src/ai/index.js` (`spawnGhost`, 스토리 모드 프리웜), `src/fx/index.js` (`mist`), `src/audio/index.js` (`_build` case 4개, `BUS_FOR`)

**Interfaces — Produces:**
```js
ai.spawnGhost(kind, position, yaw, opts) -> GhostAgent   // kind: 'soldier' | 'officer'
class GhostAgent extends Agent {
  kind; phase /* 'rise'|'active'|'blinkOut'|'blinkIn'|'scatter'|'dying'|'gone' */
  banish()                 // 즉시 소멸 연출
  afterDeath(dt)           // 디졸브 진행, 끝나면 ai.remove(this)
}
// events: 'ghost:death' { actor, point }, 'ghost:boss' { actor, phase, fraction }
fx.mist(x, y, z, { r, g, b, count, radius, life, rise, additive })
audio.play('ghost_whisper' | 'ghost_swell' | 'ghost_drone', position?, opts)
audio.play('radio', null, opts)
```

행동 수치(스펙 5.3): 체력 160 / 보스 2000, 걷기 1.6 m/s(보스 1.3), 시야 밖 3.5초 + 거리 10 m 초과 시 순간이동(플레이어 둘레 8~12 m 걸을 수 있는 칸), 0.6초 안 누적 피해 45 초과 시 흩어짐(무적 1.5초, 3~5 m 옆 재형성, 쿨다운 4초, 보스 제외), 2.5 m 이내 냉기 피해 초당 12, 사격 `fireRate 4`(보스 6), `spread 0.07`(보스 0.05), `weaponDamage 9`(보스 14). 사망은 래그돌 없이 2초 디졸브 + 안개. 보스 66 %·33 %에서 비명 + 순간이동 + 병사 원혼 3명 소환.

- [ ] **Step 1:** `GhostAgent` 구현 (`_think` 교체, `applyDamage`/`die` 재정의, 순간이동 시 컨트롤러·위치·경로·볼트 상태 리셋, 콜라이더 `enabled` 토글).
- [ ] **Step 2:** officer(검은 연기 + 붉은 눈), wraith(Lathe 천 + 머리, 흔들림) 외형.
- [ ] **Step 3:** `fx.mist`, 오디오 4종.
- [ ] **Step 4:** 스토리 모드에서만 귀신 재질 프리웜.
- [ ] **Step 5:** 브라우저 콘솔 스폰으로 접근·사격·순간이동·흩어짐·사망·보스 페이즈 확인.
- [ ] **Step 6:** `npm run build`, 커밋 `feat(ghost): ghost behaviour, boss, wraith, mist and sounds`.

### Task 6: 스토리 UI + 부팅 흐름

**Files:**
- Create: `src/story/style.js`, `title.js`, `cutscene.js`, `screens.js`, `hud.js`
- Modify: `src/main.js`

**Interfaces — Produces:**
```js
showTitle({ progress, episodes }) -> Promise<{ mode: 'story'|'free', ep?: number }>
playCutscene(slides, { canSkip }) -> Promise<void>     // slides: [{ img, lines: [string|{who,text}] }]
screens.waitForStart(bootPromise) -> Promise<void>      // 부팅 대기 표시 → "클릭하여 작전 시작"
screens.death({ onRetry, onTitle }); screens.ending(...)
class StoryHud { setObjective(text|null); radio(who, text, opts); busy; boss(frac|null); update(dt); dispose() }
```

main.js 흐름:
```
mode = params.mode ?? (capture ? 'free' : null)
if (!mode) ({ mode, ep } = await showTitle(...))
if (mode === 'story'): config.mode = 'story'; config.story = { ep, skipIntro, step }
   cut = skipIntro ? null : playCutscene(episode.intro)
   StorySystem = (await import('./story/index.js')).StorySystem; engine.add(StorySystem)
engine.init() → prewarm → (story) await cut; await waitForStart() → engine.start(); story.begin()
```

- [ ] **Step 1:** UI 모듈 구현 (자체 루트 `#story-ui`, z-index 20; `.ow-hud` 밖).
- [ ] **Step 2:** main.js 연결. `?capture=1`·`?mode=free`는 타이틀 생략.
- [ ] **Step 3:** 브라우저에서 타이틀 → 자유 전투가 예전처럼 시작되는지, 스토리 → 컷신 → 시작 대기까지 확인.
- [ ] **Step 4:** 커밋 `feat(story): title, cutscenes and boot flow`.

### Task 7: StorySystem + 에피소드 3개

**Files:**
- Create: `src/story/index.js`, `src/story/haunt.js`, `src/story/episodes/index.js`, `ep1.js`, `ep2.js`, `ep3.js`

StorySystem 책임:
- `init`: 시간대·안개 설정, 플레이어 텔레포트, TDM 점수판 숨김, HUD·haunt 생성, 이벤트 연결(`player:death`, `ui:pause`), 일시정지 메뉴에 "타이틀로" 버튼 추가.
- `begin()`: Director 시작(`config.story.step` 지원), `window.__STORY__ = { skip, director }`.
- `update`: Director·HUD·haunt 갱신. 컷신/전사 화면 중에는 `input.enabled = false`.
- 사망 → 전사 화면 → `?mode=story&ep=N&skipIntro=1`. 클리어 → 아웃트로 → `markCleared` → 다음 화 URL(3화 뒤에는 엔딩 → 타이틀).

에피소드 데이터는 스펙 2장의 줄거리·목표를 따른다(좌표는 LEVEL, 내비 스냅).

- [ ] **Step 1:** StorySystem + rt 어댑터 + haunt 구현.
- [ ] **Step 2:** ep1~3 데이터 작성.
- [ ] **Step 3:** `node src/story/selftest.mjs` (에피소드 데이터의 단계 타입이 모두 STEPS에 있는지 검사 추가).
- [ ] **Step 4:** 커밋 `feat(story): story system and three episodes`.

### Task 8: 통합 플레이 검증 + 마무리

- [ ] **Step 1:** 앱 내 브라우저로 EP1→EP2→EP3 끝까지(필요하면 `?step=`·`__STORY__.skip()`), 사망→재시작, 타이틀로 복귀 확인. 귀신·보스·컷신 스크린샷.
- [ ] **Step 2:** 수치·배치 튜닝.
- [ ] **Step 3:** `npm run build`, `node src/story/selftest.mjs`, 픽셀 게이트(Task 1 기준과 동일).
- [ ] **Step 4:** README에 스토리 모드 실행법 한 단락 추가, 커밋, `git push`.
