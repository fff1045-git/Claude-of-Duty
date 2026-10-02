/**
 * EP3 「원혼」 — midnight to dawn. Ghosts only: three waves at the market square,
 * then the Black Officer comes through the arched gate. His fall banishes every
 * ghost and the sky actually runs on to sunrise before the ending.
 *
 * LEVEL coordinates [x, z]; see ep1.js.
 */
const g = (r = [9, 13]) => ({ type: 'ghost', around: 'player', r });

export default {
  id: 3,
  title: '원혼',
  logline: '자정의 광장. 41명의 원혼과, 그들을 붙잡아 둔 검은 장교.',
  place: '사르말 시장 광장',
  clock: '00:30',
  hour: 0.5,
  weather: { fogDensity: 3.2 },
  exposure: 2.8,
  spawn: { at: [0.4, 40], yaw: 0 },
  next: null,

  intro: [
    {
      img: 'ep3_intro_1',
      lines: [
        '자정. 광장으로 가는 길은 붉은 안개로 덮여 있었다.',
        '원혼들은 3년 동안 그 자리에서 기다리고 있었다.',
        { who: '등대 · 본부', text: '레이븐 2, 신호가 돌아왔다. 즉시 철수해라. 이건 명령이다.' },
        { who: '레이븐 2', text: '…여기서 끝내지 않으면, 이 거리는 영원히 밤일 겁니다.' },
      ],
    },
    {
      img: 'ep3_intro_2',
      lines: [
        '크레인 소령은 학살 사흘 뒤, 이 아치문 아래에서 숨진 채 발견됐다.',
        '사인은 기록되지 않았다.',
        '그리고 지금, 그가 원혼들을 이 거리에 붙잡아 두고 있다.',
      ],
    },
  ],

  outro: [
    {
      img: 'ep3_end_1',
      lines: [
        '검은 장교가 무너지자, 동쪽 하늘이 밝아오기 시작했다.',
        '원혼들은 더 이상 싸우지 않았다. 빛 속으로, 하나씩.',
        { who: '???', text: '…이제… 집에 갈 수 있어요.', ghost: true },
      ],
    },
    {
      img: 'ep3_end_2',
      lines: [
        '레이븐 2는 헬멧 카메라의 메모리를 손에 쥐고 거리를 걸어 나왔다.',
        '3년 동안 지워져 있던 41명의 이름이, 다시 기록될 것이다.',
      ],
    },
  ],

  steps: [
    { do: 'radio', who: '레이븐 2', text: '광장으로 간다. 여기서 끝낸다.' },
    { do: 'objective', id: 'plaza', text: '학살의 광장으로', at: [0, 6] },
    { do: 'spawn', group: 'g', units: [{ type: 'ghost', at: [-3, 22] }, { type: 'ghost', at: [3, 16] }] },
    { do: 'reach', at: [0, 8], radius: 7 },
    { do: 'haunt', kind: 'pulse' },
    { do: 'radio', who: '???', text: '…왜… 우리를… 쐈어요…?', ghost: true },
    { do: 'objective', id: 'w1', text: '원혼의 물결을 버텨라 (1/3)' },
    { do: 'spawn', group: 'g', units: [g(), g(), g(), g()] },
    { do: 'killAll', group: 'g' },
    { do: 'haunt', kind: 'flicker', seconds: 2 },
    { do: 'objective', id: 'w2', text: '원혼의 물결을 버텨라 (2/3)' },
    { do: 'spawn', group: 'g', units: [g(), g(), g(), g(), g()] },
    { do: 'killAll', group: 'g' },
    { do: 'radio', who: '등대', text: '레이븐 2, 거기 열원이 수십 개다. 대체 뭐랑 싸우는 거야?' },
    { do: 'objective', id: 'w3', text: '원혼의 물결을 버텨라 (3/3)' },
    { do: 'spawn', group: 'g', units: [g(), g(), g(), g(), g([11, 15]), g([11, 15])] },
    { do: 'killAll', group: 'g' },
    { do: 'haunt', kind: 'pulse', red: true },
    { do: 'radio', who: '검은 장교', text: '명령은 명령이다. 이 광장에서 나가는 자는 없다.', ghost: true, wait: true },
    { do: 'objective', id: 'boss', text: '검은 장교를 쓰러뜨려라' },
    { do: 'boss', unit: { type: 'officer', at: [0, -30], name: '검은 장교' } },
    { do: 'banish' },
    { do: 'clearObjective', id: 'boss' },
    { do: 'sky', hour: 5.0, rate: 0.05, exposure: 1.2, weather: { fogDensity: 1.2 } },
    { do: 'radio', who: '???', text: '…고마워요.', ghost: true },
    { do: 'wait', seconds: 7 },
    { do: 'sky', rate: 0 },
    { do: 'outro' },
  ],
};
