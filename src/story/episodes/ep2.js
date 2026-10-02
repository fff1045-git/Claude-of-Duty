/**
 * EP2 「일어선 자들」 — night, dense fog. The dead rise; humans and ghosts mixed.
 * Three radio relays to restart (reach -> F -> hold 30 s while ghosts come).
 * Ends on the three-year-old order coming through the relay.
 *
 * LEVEL coordinates [x, z]; see ep1.js.
 */
const ghostNear = { type: 'ghost', around: 'player', r: [10, 14] };

export default {
  id: 2,
  title: '일어선 자들',
  logline: '쓰러뜨린 자들이 일어섰다. 무전 중계기 세 곳을 살려 본부와 연결하라.',
  place: '사르말 시장 거리',
  clock: '22:00',
  hour: 22.0,
  weather: { fogDensity: 2.8 },
  // the auto-exposure lifts a moonlit street to overcast-evening brightness;
  // pull it back down so night reads as night
  exposure: 2.4,
  spawn: { at: [3, -24], yaw: Math.PI },
  next: 3,

  intro: [
    {
      img: 'ep2_intro_1',
      lines: [
        '밤 10시. 안개가 시장 거리를 삼켰다.',
        '낮에 쓰러뜨린 자들이, 창백한 빛을 흘리며 다시 일어섰다.',
        { who: '레이븐 2', text: '등대, 응답하라. 등대!' },
        { who: '등대 · 본부', text: '…치익… 레이… …지직…', ghost: true },
      ],
    },
    {
      img: 'ep2_intro_2',
      lines: [
        '무장세력조차 무언가로부터 달아나고 있었다.',
        { who: '무장세력 병사', text: '돌아왔어… 광장의 그것들이 돌아왔다고!' },
        '본부와 다시 연결하려면, 거리의 무전 중계기 세 곳을 살려야 한다.',
      ],
    },
  ],

  outro: [
    {
      img: 'ep2_outro_1',
      lines: [
        '세 번째 중계기가 살아났다. 그러나 잡힌 것은 본부의 목소리가 아니었다.',
        '3년 전, 같은 주파수에 남아 있던 기록이었다.',
      ],
    },
    {
      img: 'ep2_outro_2',
      lines: [
        { who: '기록 · 3년 전', text: '광장의 민간인 전원 제압. 반복한다, 전원.' },
        { who: '기록 · 3년 전', text: '기록은 남기지 마라. 이건 교전이다. 알겠나?' },
        '레이븐 2는 그 목소리를 알고 있었다. 연합군 작전 지휘관, 크레인 소령.',
        '41명. 그날 광장에서 사라진 사람들의 수였다.',
      ],
    },
  ],

  steps: [
    { do: 'haunt', kind: 'pulse' },
    { do: 'spawn', group: 'ghosts', units: [{ type: 'ghost', at: [-2, -31] }, { type: 'ghost', at: [5, -33] }] },
    { do: 'radio', who: '레이븐 2', text: '등대, 시체들이… 일어서고 있다. 응답하라!' },
    { do: 'radio', who: '등대', text: '…치익… 레이… …중계기… …지직…', ghost: true },
    { do: 'objective', id: 'r1', text: '중계기 A 재가동 — 서쪽 골목', at: [-13, -10], label: 'A' },
    { do: 'spawn', group: 'humans', units: [{ type: 'irregular', at: [-5, -6] }, { type: 'irregular', at: [-9, -11] }] },
    { do: 'reach', at: [-13, -10], radius: 4 },
    { do: 'interact', at: [-13, -10], radius: 3, text: '중계기 A 가동' },
    { do: 'radio', who: '레이븐 2', text: '중계기 A 가동. 신호가 잡힐 때까지 버틴다.' },
    {
      do: 'hold', at: [-13, -10], radius: 9, seconds: 30, text: '중계기 A 신호 동기화',
      spawnEvery: 8, group: 'ghosts', units: [ghostNear],
    },
    { do: 'radio', who: '등대', text: '…레이븐 2… 신호 일부 수신… 나머지 중계기도…', ghost: true },

    { do: 'objective', id: 'r2', text: '중계기 B 재가동 — 동쪽 골목', at: [16, 5], label: 'B' },
    { do: 'spawn', group: 'humans', units: [{ type: 'irregular', at: [9, 5] }, { type: 'breacher', at: [13, 3] }] },
    { do: 'haunt', kind: 'apparition', at: [24, 5], seconds: 3 },
    { do: 'reach', at: [16, 5], radius: 4 },
    { do: 'interact', at: [16, 5], radius: 3, text: '중계기 B 가동' },
    {
      do: 'hold', at: [16, 5], radius: 9, seconds: 30, text: '중계기 B 신호 동기화',
      spawnEvery: 7, group: 'ghosts', units: [ghostNear],
    },

    { do: 'objective', id: 'r3', text: '중계기 C 재가동 — 북쪽 광장', at: [-2, 30], label: 'C' },
    { do: 'radio', who: '레이븐 2', text: '마지막 중계기는 북쪽이다. 이동한다.' },
    { do: 'spawn', group: 'ghosts', units: [{ type: 'ghost', at: [0, 18] }, { type: 'ghost', at: [-4, 24] }] },
    { do: 'reach', at: [-2, 30], radius: 4 },
    { do: 'interact', at: [-2, 30], radius: 3, text: '중계기 C 가동' },
    {
      do: 'hold', at: [-2, 30], radius: 9, seconds: 30, text: '중계기 C 신호 동기화',
      spawnEvery: 6, group: 'ghosts', units: [ghostNear, ghostNear],
    },
    { do: 'objective', id: 'clear', text: '남은 원혼을 처치' },
    { do: 'killAll', group: 'ghosts' },
    { do: 'radio', who: '등대', text: '…지직… 수신 중… 이건… 본부 신호가 아니다…', ghost: true, wait: true },
    { do: 'outro' },
  ],
};
