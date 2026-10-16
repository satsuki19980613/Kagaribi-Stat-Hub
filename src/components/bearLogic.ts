import type { BearFrame } from './bearSprites';

/**
 * 見出しのクマの動き。1 コマ（TICK_MS）ごとに stepBear で次の様子を決める。
 * 描画とは切り離してあり、乱数は引数で受け取る（テストで同じ動きを再現できるように）。
 *
 * - idle: その場で立つ（ときどきまばたき）
 * - walk: 端から端へ歩く
 * - sleep: 寝ころんで Zzz
 * - play: ボールを追いかけて転がす
 * - hop: ばんざいして跳ねる（遊んだあと・タップされたとき）
 */
export type BearMode = 'idle' | 'walk' | 'sleep' | 'play' | 'hop';

export interface BearState {
  mode: BearMode;
  /** 今の様子になってからのコマ数。 */
  t: number;
  /** 今の様子を続けるコマ数。 */
  dur: number;
  /** クマの左端（ドット）。 */
  x: number;
  dir: 1 | -1;
  /** 歩く先（walk のとき）。 */
  goal: number;
  /** ボールの左端（play のとき。ほかは null）。 */
  ball: number | null;
}

/** 1 コマの長さ（ミリ秒）。 */
export const TICK_MS = 140;
/** クマの幅（ドット）と、寝ころんだときの幅。 */
export const BEAR_W = 16;
export const SLEEP_W = 20;
export const BALL_W = 5;
/** 跳ねる高さ（ドット、hop の 1 周 4 コマぶん）。 */
const HOP_Y = [0, 2, 4, 2] as const;

/** 0 以上 1 未満の数を返す乱数。 */
export type Rand = () => number;

/** 種から決まる乱数（mulberry32）。見た目の揺らぎに使うだけ。 */
export function seededRand(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function between(rand: Rand, lo: number, hi: number): number {
  return lo + Math.floor(rand() * (hi - lo + 1));
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** 端からはみ出さない x の上限。 */
function maxX(width: number): number {
  return Math.max(0, width - BEAR_W);
}

export function initialBear(width: number, rand: Rand): BearState {
  return { mode: 'idle', t: 0, dur: between(rand, 8, 16), x: Math.floor(maxX(width) / 2), dir: 1, goal: 0, ball: null };
}

/** 次の様子を選ぶ。 */
function nextMode(s: BearState, width: number, rand: Rand): BearState {
  const base = { ...s, t: 0, ball: null };
  const roll = rand();
  if (s.mode !== 'idle' && roll < 0.35) return { ...base, mode: 'idle', dur: between(rand, 8, 20) };
  if (roll < 0.6) {
    const goal = between(rand, 0, maxX(width));
    return { ...base, mode: 'walk', goal, dir: goal >= s.x ? 1 : -1, dur: 999 };
  }
  if (roll < 0.8 && width >= BEAR_W + BALL_W + 8) {
    // ボールは広い側に置き、そちらへ追いかける。
    const dir: 1 | -1 = s.x + BEAR_W / 2 < width / 2 ? 1 : -1;
    const ball = dir === 1 ? s.x + BEAR_W + 1 : s.x - BALL_W - 1;
    return { ...base, mode: 'play', dir, ball: clamp(ball, 0, width - BALL_W), dur: 999 };
  }
  return { ...base, mode: 'sleep', dur: between(rand, 40, 70) };
}

/** 1 コマ進める。width はステージの幅（ドット）。 */
export function stepBear(s: BearState, width: number, rand: Rand): BearState {
  const n: BearState = { ...s, t: s.t + 1, x: clamp(s.x, 0, maxX(width)) };
  switch (n.mode) {
    case 'walk': {
      // 幅が縮んで行き先が外に出たら、届く所までにする。
      const goal = clamp(n.goal, 0, maxX(width));
      if (n.x === goal) return nextMode(n, width, rand);
      const dir = goal > n.x ? 1 : -1;
      return { ...n, goal, dir, x: n.x + dir };
    }
    case 'play': {
      const ball = n.ball ?? n.x;
      // ボールが端に着いたら、喜んで跳ねる。
      const atEdge = n.dir === 1 ? ball >= width - BALL_W : ball <= 0;
      if (atEdge) return { ...n, mode: 'hop', t: 0, dur: 8, ball: null };
      // クマは 1 コマに 1 ドット、ボールは追いつかれたら 2 ドット転がる。
      const x = n.x + n.dir;
      const touching = n.dir === 1 ? x + BEAR_W >= ball : x <= ball + BALL_W;
      return { ...n, x: clamp(x, 0, maxX(width)), ball: touching ? clamp(ball + n.dir * 2, 0, width - BALL_W) : ball };
    }
    default:
      return n.t >= n.dur ? nextMode(n, width, rand) : n;
  }
}

/** タップされたとき（寝ていたら起きて、どの様子でも跳ねる）。 */
export function poke(s: BearState): BearState {
  return { ...s, mode: 'hop', t: 0, dur: 8, ball: null };
}

/** 今描く絵と、地面からの浮き（ドット）。 */
export function bearPose(s: BearState): { frame: BearFrame; lift: number; flip: boolean } {
  const flip = s.dir === -1;
  switch (s.mode) {
    case 'walk':
    case 'play':
      return s.t % 2 === 0 ? { frame: 'walkA', lift: 0, flip } : { frame: 'walkB', lift: 1, flip };
    case 'sleep':
      return { frame: 'sleep', lift: 0, flip: false };
    case 'hop': {
      const lift = HOP_Y[s.t % HOP_Y.length] ?? 0;
      return { frame: lift === 0 ? 'crouch' : 'cheer', lift, flip: false };
    }
    default:
      // まばたきはおよそ 3 秒に 1 回、1 コマだけ。
      return { frame: s.t % 22 === 21 ? 'blink' : 'stand', lift: 0, flip: false };
  }
}
