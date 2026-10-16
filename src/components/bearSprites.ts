/**
 * 見出しで暮らすクマのドット絵。1 文字が 1 ドットで、文字と色の対応は BEAR_COLORS（. は透明）。
 *
 * クマは「頭（16×10）」と「体」を重ねて描く。頭は表情（目・口）と向きで組み立て、
 * 体はポーズごとに描く。頭と体を分けておくと、息をするときに頭だけ 1 ドット沈める、
 * しゃがむと体が縮んで頭が下がる、といった小さな動きが付けられる。
 * 横向き・寝ころびの絵は右向きで描き、左へ向くときは左右を反転して描く。
 * 光は左上から当てていて、右下を 1 段暗い色（d・L）にしている。
 */

/** ドットの色。 */
export const BEAR_COLORS: Readonly<Record<string, string>> = {
  o: '#5A3524', // 輪郭
  F: '#DDA06A', // 毛（光）
  f: '#C68650', // 毛
  d: '#A0653B', // 毛（影）
  l: '#F8E3C6', // 口もと・おなか
  L: '#EBCBA4', // おなか（影）
  p: '#F598B0', // 耳の内側・ほっぺ
  n: '#3A2116', // 鼻
  e: '#24140D', // 目
  w: '#FFFFFF', // 目の光・白
  m: '#C8475E', // 開けた口
  // ---- 小物 ----
  r: '#E8506F', // ボール
  y: '#FFD45E', // ボールの帯・きらきら
  h: '#F25C86', // ハート・ちょうちょ
  k: '#8F7BD0', // 音符・？
  z: '#9A86B8', // Zzz
  c: '#8ED3F4', // 汗・鼻ちょうちん
  R: '#E5484D', // ！・怒り・りんご
  A: '#FF9AA2', // りんごの光
  G: '#6CC36B', // 葉
  P: '#5DAE4E', // ピーマン
  Q: '#3E7F35', // ピーマン（影）
  j: '#F0A73A', // はちみつのつぼ
  J: '#C97A1E', // つぼ（影）
  Y: '#FFD970', // はちみつ
  N: '#2F3B35', // のり
  g: '#DCD2CA', // 土ぼこり
  b: '#FFA9C1', // 布団
  B: '#FFFFFF', // 布団の水玉・まくら
  q: '#D06A8A', // 布団のふち
  V: '#E6D9E0', // まくらの影
};

export type Sprite = readonly string[];

// ---------------------------------------------------------------- 頭

export type Eyes = 'open' | 'closed' | 'happy' | 'sleep' | 'up' | 'round' | 'squeeze' | 'wink';
export type Mouth = 'none' | 'open' | 'tongue' | 'wide';

const HEAD_BASE: Sprite = [
  '..ooo......ooo..',
  '.ofpfo....ofpfo.',
  '.offfoooooofffo.',
  'offFFFfffffffffo',
  'offFffffffffffdo',
  'offfffffffffffdo',
  'offfffffffffffdo',
  'offfffffffffffdo',
  '.offffffffffddo.',
  '..oooddddddooo..',
];

/** 目の形（左目の左上からのずれと色）。右目はこれを鏡写しにして 7 ドット右に置く。 */
const EYE_DOTS: Readonly<Record<Eyes, readonly (readonly [number, number, string])[]>> = {
  open: [[0, 0, 'w'], [1, 0, 'e'], [0, 1, 'e'], [1, 1, 'e']],
  closed: [[0, 1, 'e'], [1, 1, 'e']],
  happy: [[0, 0, 'e'], [1, 0, 'e'], [-1, 1, 'e'], [2, 1, 'e']],
  sleep: [[-1, 0, 'e'], [2, 0, 'e'], [0, 1, 'e'], [1, 1, 'e']],
  up: [[0, 0, 'e'], [1, 0, 'e']],
  round: [[0, -1, 'e'], [1, -1, 'e'], [0, 0, 'w'], [1, 0, 'e'], [0, 1, 'e'], [1, 1, 'e']],
  squeeze: [[-1, 0, 'e'], [0, 0, 'e'], [1, 1, 'e'], [0, 1, 'e']],
  wink: [],
};

const MOUTHS: Readonly<Record<Mouth, string>> = { none: 'llll', open: 'lmml', tongue: 'lmpl', wide: 'mmmm' };

function stamp(grid: string[][], x: number, y: number, c: string): void {
  const row = grid[y];
  if (row && x >= 0 && x < row.length) row[x] = c;
}

/**
 * 顔を組み立てる。face は顔（目・鼻・口・ほっぺ）を左右にずらすドット数（右向きなら +1）、
 * look は目だけをずらすドット数（きょろきょろ）。
 */
export function head(eyes: Eyes, mouth: Mouth = 'none', face = 0, look = 0): Sprite {
  const g = HEAD_BASE.map((r) => [...r]);
  const ex = 3 + face + look;
  const put = (kind: Eyes, x0: number, mirror: boolean): void => {
    for (const [dx, dy, c] of EYE_DOTS[kind]) stamp(g, mirror ? x0 + 1 - dx : x0 + dx, 5 + dy, c);
  };
  if (eyes === 'wink') {
    put('open', ex, false);
    put('happy', ex + 7, true);
  } else {
    put(eyes, ex, false);
    // 右目は左目の鏡写し（＞＜ のような左右で向きが逆の目のため）。
    put(eyes, ex + 7, true);
  }
  [...'lnnl'].forEach((c, i) => stamp(g, 6 + face + i, 7, c));
  [...MOUTHS[mouth]].forEach((c, i) => stamp(g, 6 + face + i, 8, c));
  stamp(g, 2 + face, 7, 'p');
  stamp(g, 13 + face, 7, 'p');
  return g.map((r) => r.join(''));
}

/** 後ろ姿の頭。 */
const HEAD_BACK: Sprite = HEAD_BASE.map((r, i) => (i === 1 ? '.offfo....offfo.' : r));

// ---------------------------------------------------------------- 体（頭の下に付く。1 行目が頭のあご）

/** 体の絵。chin は頭の最後の行（あご）を置き換える行（腕を上げるときなど）。 */
interface Body {
  rows: Sprite;
  chin?: string;
}

const LEGS = ['...offo..ofdo...', '...oooo..oooo...'];
const TORSO = ['..offllllllfdo..', '.offfllllllfddo.', '..offllLLllfdo..', '..offffffffddo..'];

const BODIES = {
  stand: { rows: [...TORSO, ...LEGS] },
  // 横向き（右）。足を開く・閉じるの 2 コマで歩く。
  walkA: { rows: [...TORSO, '..offo....ofdo..', '..oooo....oooo..'] },
  walkB: { rows: [...TORSO, '....offooffo....', '....oooooooo....'] },
  // 右足でける。
  kick: { rows: [...TORSO, '...offo...offfo.', '...oooo...oooo..'] },
  // ばんざい（腕をあごの横に上げる）。
  cheer: { chin: 'ofoooddddddooofo', rows: ['ofoffllllllfdofo', '.ooffllllllfdoo.', '..offllLLllfdo..', '..offffffffddo..', ...LEGS] },
  // 片手（右）を振る 2 コマ。
  waveA: { chin: '..oooddddddooofo', rows: ['..offllllllfdofo', '.offfllllllfdoo.', '..offllLLllfdo..', '..offffffffddo..', ...LEGS] },
  waveB: { rows: ['..offllllllfdooo', '.offfllllllfdfdo', '..offllLLllfdoo.', '..offffffffddo..', ...LEGS] },
  // しゃがむ（跳ぶ前の溜め・着地）。横に広く、背が 2 ドット低い。
  crouch: { rows: ['.offllllllllfdo.', 'offfllLLllllfddo', '.ooffffffffffoo.', '..ooo......ooo..'] },
  // 跳んでいる（伸び）。足がぶら下がって細長い。
  jump: { rows: ['..offllllllfdo..', '..offllllllfdo..', '..offllLLllfdo..', '...offffffffo...', '....ofo..ofo....', '....ooo..ooo....'] },
  // すわる（足を前に投げ出す）。
  sit: { rows: ['..offllllllfdo..', '.offfllllllfddo.', '.ooffllLLllfdoo.', '..oLLoffffoLLo..', '...oooooooooo...'] },
  // すわって両手で持つ（手は持ち物の横に小物として描く）。
  hold: { rows: ['..offllllllfdo..', '..offllllllfdo..', '..offllLLllfdo..', '..oLLoffffoLLo..', '...oooooooooo...'] },
  // 後ろ姿（しっぽ）。
  back: { rows: ['..offffffffffo..', '.offfffffffffdo.', '..offffFFfffdo..', '..offffFFffddo..', ...LEGS] },
} satisfies Record<string, Body>;

export type BodyKey = keyof typeof BODIES;

// ---------------------------------------------------------------- ポーズ（頭＋体）

/** 寝ころんだ絵（右に頭）。体は布団の下になることが多い。 */
function lying(eyes: string): Sprite {
  return [
    '.........ooo....ooo.',
    '........ofpfoooofpfo',
    '........offFFffffffo',
    '..oooooooFfffffffffo',
    eyes,
    'offfffffopfflnnlffpo',
    'offfffffofoffllllfdo',
    'oFllfffffddoooooooo.',
    '.ooooooooooo........',
  ];
}

export interface Pose {
  head: Sprite;
  body: Sprite;
  /** 頭を下げるドット数（息をするとき 1）。 */
  headDy: number;
}

function pose(h: Sprite, bodyKey: BodyKey, headDy = 0): Pose {
  const b: Body = BODIES[bodyKey];
  const headRows = b.chin ? [...h.slice(0, -1), b.chin] : h;
  return { head: headRows, body: b.rows, headDy };
}

const FRONT = head('open');
const RIGHT = head('open', 'none', 1);

/** 描けるポーズの一覧。 */
export const POSES = {
  stand: pose(FRONT, 'stand'),
  breathe: pose(FRONT, 'stand', 1),
  blink: pose(head('closed'), 'stand'),
  lookL: pose(head('open', 'none', 0, -1), 'stand'),
  lookR: pose(head('open', 'none', 0, 1), 'stand'),
  lookUp: pose(head('up', 'none', 1), 'stand'),
  happy: pose(head('happy', 'tongue'), 'stand'),
  smile: pose(head('happy'), 'stand', 1),
  surprised: pose(head('round', 'open'), 'stand'),
  cheer: pose(head('happy', 'tongue'), 'cheer'),
  waveA: pose(head('wink', 'tongue'), 'waveA'),
  waveB: pose(head('wink', 'tongue'), 'waveB'),
  crouch: pose(head('happy'), 'crouch'),
  crouchFocus: pose(head('open', 'none', 1), 'crouch'),
  jump: pose(head('happy', 'tongue'), 'jump'),
  jumpReach: pose(head('up', 'open', 1), 'cheer'),
  walkA: pose(RIGHT, 'walkA'),
  walkB: pose(RIGHT, 'walkB'),
  kick: pose(head('squeeze', 'open', 1), 'kick'),
  noL: pose(head('squeeze', 'none', -1), 'stand'),
  noR: pose(head('squeeze', 'none', 1), 'stand'),
  sniff: pose(head('closed', 'none', 1), 'stand', 1),
  sit: pose(FRONT, 'sit'),
  sitBlink: pose(head('closed'), 'sit'),
  sitHappy: pose(head('happy', 'tongue'), 'sit'),
  sitPuzzled: pose(head('open', 'none', 0, 1), 'sit'),
  eatOpen: pose(head('closed', 'wide'), 'hold'),
  eatChew: pose(head('closed', 'none'), 'hold', 1),
  eatYum: pose(head('happy', 'tongue'), 'hold'),
  yawn: pose(head('squeeze', 'wide'), 'cheer'),
  drowsy: pose(head('closed', 'open'), 'sit', 1),
  singA: pose(head('sleep', 'open'), 'stand'),
  singB: pose(head('sleep', 'tongue'), 'stand', 1),
  back: pose(HEAD_BACK, 'back'),
  side: pose(RIGHT, 'stand'),
} satisfies Record<string, Pose>;

export type PoseKey = keyof typeof POSES;

/** ポーズを 1 枚の絵にする。体を下に置き、頭をその上に（headDy だけ沈めて）重ねる。 */
export function composePose(p: Pose): Sprite {
  const width = p.body[0]?.length ?? 16;
  const g = Array.from({ length: p.head.length + p.body.length }, () => Array<string>(width).fill('.'));
  const paint = (sp: Sprite, y0: number): void =>
    sp.forEach((r, dy) => [...r].forEach((c, x) => c !== '.' && stamp(g, x, y0 + dy, c)));
  paint(p.body, p.head.length);
  paint(p.head, p.headDy);
  return g.map((r) => r.join(''));
}

/** 寝ころんだ絵（頭・体に分けず 1 枚）。 */
export const LYING = {
  sleep: lying('.offfffffffeeffeeffo'),
  fallen: lying('.offffffffeffeeffefo'),
} satisfies Record<string, Sprite>;

export type LyingKey = keyof typeof LYING;

// ---------------------------------------------------------------- 小物

export const PROPS = {
  ball0: ['.ooo.', 'oyrro', 'oyrro', 'oyrro', '.ooo.'],
  ball1: ['.ooo.', 'oryro', 'oryro', 'oryro', '.ooo.'],
  ball2: ['.ooo.', 'orryo', 'orryo', 'orryo', '.ooo.'],
  heart: ['hh.hh', 'hhhhh', '.hhh.', '..h..'],
  heartS: ['h.h', 'hhh', '.h.'],
  note: ['.kkk', '.k.k', '.k..', 'kk..', 'kk..'],
  zBig: ['zzzz', '..z.', '.z..', 'zzzz'],
  zSmall: ['zzz', '.z.', 'z..', 'zzz'],
  sweat: ['.c.', 'ccc', 'cwc', '.c.'],
  anger: ['.R.R.', 'RR.RR', '.....', 'RR.RR', '.R.R.'],
  bang: ['RR', 'RR', 'RR', '..', 'RR'],
  question: ['.kk.', 'k..k', '..k.', '.k..', '....', '.k..'],
  sparkle: ['..y..', '..y..', 'yywyy', '..y..', '..y..'],
  sparkleS: ['.y.', 'ywy', '.y.'],
  dust: ['.gg.', 'gggg', '.gg.'],
  dustS: ['gg', 'gg'],
  bubbleS: ['cc', 'cc'],
  bubbleL: ['.cc.', 'cwcc', 'cccc', '.cc.'],
  paws: ['of......fo', 'oo......oo'],
  apple0: ['...oG.', '.oooo.', 'oRARRo', 'oRRRRo', 'oRRRRo', '.oooo.'],
  apple1: ['...oG.', '.ooo..', 'oRARo.', 'oRRo..', 'oRRRo.', '.ooo..'],
  apple2: ['...o..', '..oo..', '..oR..', '..RR..', '..oR..', '..oo..'],
  honey0: ['.oooo.', 'oYYYYo', 'ojwwJo', 'ojwwJo', 'ojjjJo', '.oooo.'],
  honey1: ['.oooo.', 'oJJJJo', 'oYYYJo', 'ojwwJo', 'ojjjJo', '.oooo.'],
  honey2: ['.oooo.', 'oJJJJo', 'oJJJJo', 'ojwwJo', 'ojjjJo', '.oooo.'],
  rice0: ['..oo..', '.owwo.', '.owwo.', 'owwwwo', 'owNNwo', 'oooooo'],
  rice1: ['......', '.o.o..', '.owwo.', 'owwwwo', 'owNNwo', 'oooooo'],
  rice2: ['......', '......', '......', '.o.oo.', 'owNNwo', 'oooooo'],
  pepper: ['..oG..', '.oooo.', 'oPPPQo', 'oPPPQo', 'oPPQQo', '.o.oo.'],
  flyA: ['.o...o.', 'hhh.hhh', 'hyhohyh', '.hhohh.', '..h.h..'],
  flyB: ['..o.o..', '..hoh..', '.hyoyh.', '..hoh..', '.......'],
  blanket: ['.qqqqqqqqqq.', 'qbbBbbbbBbbq', 'qbbbbbBbbbBq', 'qBbbbbbbbbbq', 'qqqqqqqqqqqq'],
  blanketUp: ['..qqqqqqqq..', '.qbbbbbbbbq.', 'qbbBbbbbBbbq', 'qbbbbbBbbbBq', 'qBbbbbbbbbbq', 'qqqqqqqqqqqq'],
  pillow: ['.VBBBBV.', 'VBBBBBBV', '.VVVVVV.'],
} satisfies Record<string, Sprite>;

export type PropKey = keyof typeof PROPS;
