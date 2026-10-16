/**
 * 見出しで暮らすクマのドット絵。1 文字が 1 ドットで、文字と色の対応は BEAR_COLORS（. は透明）。
 * 歩く・遊ぶ絵は右向きで描き、左へ向くときは左右を反転して描く。
 */

/** ドットの色。 */
export const BEAR_COLORS: Readonly<Record<string, string>> = {
  o: '#5B3A29', // 輪郭
  f: '#C98B5A', // 毛
  l: '#F6DDBD', // 口もと・おなか
  p: '#F59BB4', // 耳の内側・ほっぺ・舌
  e: '#2B1B14', // 目・鼻
  w: '#FFFFFF', // 目の光
  r: '#E8506F', // ボール
  y: '#FFD45E', // ボールの帯
  h: '#F25C86', // ハート
  z: '#9A86B8', // Zzz
};

export type Sprite = readonly string[];

// 頭（上 10 段）は正面・まばたき・右向き・にっこりの 4 つ。体（下 6 段）と組み合わせる。
const EARS = ['..ooo......ooo..', '.ofpfo....ofpfo.', '.offfoooooofffo.', 'offffffffffffffo', 'offffffffffffffo'];
const CHIN = '..oooffffffooo..';

const FACE_FRONT = ['offfweffffwefffo', 'offfeeffffeefffo', 'ofpfffleelfffpfo', '.offffllllffffo.'];
const FACE_BLINK = ['offffffffffffffo', 'offfeeffffeefffo', 'ofpfffleelfffpfo', '.offffllllffffo.'];
const FACE_RIGHT = ['offffweffffweffo', 'offffeeffffeeffo', 'offpfffleelfffpo', '.offfffllllfffo.'];
const FACE_HAPPY = ['offfeeffffeefffo', 'offeffeffeffeffo', 'ofpfffleelfffpfo', '.offfflpplffffo.'];

const BODY = ['..offllllllffo..', '.offfllllllfffo.', '..offllllllffo..', '..offffffffffo..'];
const LEGS_STAND = ['...offo..offo...', '...oooo..oooo...'];
const LEGS_OPEN = ['..offo....offo..', '..oooo....oooo..'];
const LEGS_CLOSE = ['....offooffo....', '....oooooooo....'];

/** 両手を上げた体（はねるとき）。 */
const BODY_CHEER = ['ofoffllllllffofo', '.ooffllllllffoo.', '..offllllllffo..', '..offffffffffo..'];
const CHIN_CHEER = 'ofoooffffffooofo';

function bear(face: readonly string[], legs: readonly string[], body = BODY, chin = CHIN): Sprite {
  return [...EARS, ...face, chin, ...body, ...legs];
}

/** 寝ころんで眠っている（右に頭）。 */
const SLEEP: Sprite = [
  '.........ooo....ooo.',
  '........ofpfoooofpfo',
  '........offffffffffo',
  '..oooooooffffffffffo',
  '.offfffffffeeffeeffo',
  'offfffffopffleelffpo',
  'offfffffofoffllllffo',
  'ofllfffffffooooooo..',
  '.ooooooooooo........',
];

export const BEAR_FRAMES = {
  stand: bear(FACE_FRONT, LEGS_STAND),
  blink: bear(FACE_BLINK, LEGS_STAND),
  walkA: bear(FACE_RIGHT, LEGS_OPEN),
  walkB: bear(FACE_RIGHT, LEGS_CLOSE),
  cheer: bear(FACE_HAPPY, LEGS_STAND, BODY_CHEER, CHIN_CHEER),
  crouch: bear(FACE_HAPPY, LEGS_OPEN),
  sleep: SLEEP,
} satisfies Record<string, Sprite>;

export type BearFrame = keyof typeof BEAR_FRAMES;

/** ボール（転がると帯が動く）。 */
export const BALL_FRAMES: readonly Sprite[] = [
  ['.ooo.', 'oyrro', 'oyrro', 'oyrro', '.ooo.'],
  ['.ooo.', 'oryro', 'oryro', 'oryro', '.ooo.'],
  ['.ooo.', 'orryo', 'orryo', 'orryo', '.ooo.'],
];

export const HEART: Sprite = ['hh.hh', 'hhhhh', '.hhh.', '..h..'];
export const ZZZ: Sprite = ['zzzz', '..z.', '.z..', 'zzzz'];
