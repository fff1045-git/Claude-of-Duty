/**
 * EP1 「잡음」 — dusk. Human insurgents only; the ghosts are still just static on
 * the radio and a figure at the end of an alley. Ends on Shadow squad's bodies.
 *
 * Coordinates are LEVEL space [x, z] (src/world/layout.js): the street runs
 * from z +46 (north, where we start) to the arched gate at z -42.5. Yaw 0 faces
 * the gate.
 */
export default {
  id: 1,
  title: '잡음',
  logline: '실종된 정찰분대를 찾아 해질녘의 시장 거리로. 무전에 아이의 목소리가 섞인다.',
  place: '사르말 시장 거리',
  clock: '19:05',
  hour: 19.08,
  weather: { fogDensity: 1.6 },
  exposure: 0.4, // EV, positive = darker (render.setExposureBias)
  spawn: { at: [0.4, 40], yaw: 0 },
  next: 2,

  intro: [
    {
      img: 'ep1_intro_1',
      lines: [
        '2주 전, 정찰분대 「섀도」가 사르말 시장 거리에서 연락이 끊겼다.',
        { who: '등대 · 본부', text: '레이븐 분대, 섀도의 마지막 신호는 시장 남쪽 폐허다. 생존자 확인이 최우선이다.' },
        { who: '레이븐 1', text: '분대는 외곽을 봉쇄한다. 레이븐 2, 안으로는 너 혼자 들어간다.' },
      ],
    },
    {
      img: 'ep1_intro_2',
      lines: [
        '주민들은 해가 지면 시장 거리에 들어가지 않는다고 했다.',
        '이유를 묻자, 아무도 대답하지 않았다.',
      ],
    },
    {
      img: 'ep1_intro_3',
      lines: [
        { who: '등대 · 본부', text: '레이븐 2, 무전 상태를 계속 보고해라. 이상 징후가 있으면 즉시.' },
        { who: '???', text: '…치익… 거기… 누구… 있어요…?', ghost: true },
      ],
    },
  ],

  outro: [
    {
      img: 'ep1_outro_1',
      lines: [
        '폐허 마당. 섀도 분대원 네 명이 그곳에 있었다.',
        '총상은 없었다. 무언가에 얼어붙은 것처럼, 모두 같은 방향을 보고 있었다.',
        { who: '레이븐 2', text: '등대, 섀도 발견. 전원… 사망. 헬멧 카메라를 회수한다.' },
      ],
    },
    {
      img: 'ep1_outro_2',
      lines: [
        '카메라의 마지막 기록. 안개 속에서 무언가가 걸어오고 있었다.',
        { who: '섀도 1 · 기록', text: '…저건 사람이 아니야. 총이 안 먹혀. 다들 물러—' },
        '기록은 거기서 끊겼다.',
        '그리고 등 뒤에서, 쓰러뜨렸던 자들이 일어서기 시작했다.',
      ],
    },
  ],

  steps: [
    { do: 'radio', who: '등대', text: '레이븐 2, 진입 확인. 섀도의 마지막 신호는 시장 남쪽이다.' },
    { do: 'objective', id: 'enter', text: '시장 거리로 진입', at: [0, 20] },
    { do: 'reach', at: [0, 22], radius: 7 },
    {
      do: 'spawn', group: 'm1',
      units: [
        { type: 'irregular', at: [-3, 8] },
        { type: 'irregular', at: [3.5, 3] },
        { type: 'vanguard', at: [5, 11] },
        { type: 'irregular', at: [-4, -3] },
      ],
    },
    { do: 'radio', who: '등대', text: '무장세력 확인. 교전을 허가한다.' },
    { do: 'objective', id: 'clear1', text: '시장의 무장세력 소탕' },
    { do: 'killAll', group: 'm1' },
    { do: 'haunt', kind: 'flicker', seconds: 3 },
    { do: 'radio', who: '???', text: '…엄마… 어디 있어요…?', ghost: true, wait: true },
    { do: 'radio', who: '등대', text: '레이븐 2, 방금 그 목소리 뭐지? 근처에 민간인이 있나?' },
    { do: 'haunt', kind: 'apparition', at: [1.5, -14], seconds: 4 },
    { do: 'objective', id: 'signal', text: '섀도 분대의 마지막 신호 위치로 이동', at: [6, -20] },
    { do: 'reach', at: [0, -6], radius: 7 },
    {
      do: 'spawn', group: 'm2',
      units: [
        { type: 'irregular', at: [-3, -16] },
        { type: 'breacher', at: [3, -24] },
        { type: 'irregular', at: [-2, -30] },
      ],
    },
    { do: 'radio', who: '등대', text: '남쪽에 적 추가. 섀도의 위치는 그 너머다.' },
    { do: 'killAll', group: 'm2' },
    { do: 'haunt', kind: 'apparition', at: [0.5, -36], seconds: 4 },
    { do: 'radio', who: '레이븐 2', text: '아치문 아래에 누가… 아니다, 아무것도 아니다.' },
    { do: 'reach', at: [6, -20], radius: 4 },
    { do: 'interact', at: [7.5, -20], radius: 3, text: '섀도 분대 확인' },
    { do: 'outro' },
  ],
};
