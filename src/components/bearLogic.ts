import { LYING, PROPS, type LyingKey, type PoseKey, type PropKey } from './bearSprites';

/**
 * 見出しのクマの暮らし。仕草（ぼんやり・おさんぽ・おやつ・ボール・ちょうちょ・うた・おひるね…）を
 * 1 コマずつの台本（ジェネレーター）として書き、気まぐれに選んで続けて流す。
 *
 * たまごっちにならって、
 * - 少ないコマを長めに見せる（息は 2 コマ 0.5 秒ずつ、まばたきは 0.2 秒）
 * - 歩くときは 1 ドットずつ「とことこ」進み、ときどき立ち止まる
 * - お世話の場面は短い筋書き（食べ物が落ちてくる → 気づく → 3 口で食べる → 喜ぶ）
 * - 跳ぶ前にしゃがみ（溜め）、着地でもう一度しゃがむ（潰れ）
 * 夜（22〜6 時）は眠っていることが多い。タップすると反応する（寝ていたら飛び起きる）。
 *
 * 描画とは切り離してあり、乱数と時刻は外から渡す（テストで同じ暮らしを再現できるように）。
 */

/** 1 コマの長さ（ミリ秒）。 */
export const TICK_MS = 100;
/** 立ったクマの幅・寝ころんだクマの幅・ステージの高さ（ドット）。 */
export const BEAR_W = 16;
export const LYING_W = 20;
export const STAGE_H = 28;

export type ActName = 'idle' | 'stroll' | 'trip' | 'snack' | 'ball' | 'butterfly' | 'sing' | 'nap' | 'wave' | 'react';
export type Look = PoseKey | LyingKey;

/** 小物。x は左端、y は下端の地面からの高さ（ドット）。back はクマの後ろに描く。 */
export interface Prop {
  key: PropKey;
  x: number;
  y: number;
  flip?: boolean;
  back?: boolean;
}

/** 1 コマの絵。x はクマの左端、lift は地面から浮いている高さ。 */
export interface Scene {
  act: ActName;
  look: Look;
  x: number;
  lift: number;
  flip: boolean;
  props: Prop[];
}

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

interface World {
  width: number;
  x: number;
  dir: 1 | -1;
  rand: Rand;
  hour: () => number;
  act: ActName;
  sleeping: boolean;
}

type Act = Generator<Scene, void, undefined>;
type Extra = Partial<Omit<Scene, 'act' | 'look'>>;

export function isLying(look: Look): look is LyingKey {
  return look in LYING;
}

/** 向きのある絵（右向きに描いたもの）。左を向くときに反転する。 */
const DIRECTIONAL: ReadonlySet<Look> = new Set<Look>(['walkA', 'walkB', 'kick', 'side', 'lookUp', 'sniff', 'crouchFocus', 'jumpReach', 'sleep', 'fallen']);

function between(rand: Rand, lo: number, hi: number): number {
  return lo + Math.floor(rand() * (hi - lo + 1));
}

function pick<T>(rand: Rand, items: readonly [T, ...T[]]): T {
  return items[Math.floor(rand() * items.length)] ?? items[0];
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function maxX(w: World, bw = BEAR_W): number {
  return Math.max(0, w.width - bw);
}

function propW(key: PropKey): number {
  return PROPS[key][0]?.length ?? 0;
}

/** 寝ころんだときの左端（立っていた位置から少し左へ寄せ、はみ出さないように）。 */
function lyingX(w: World): number {
  return clamp(w.x - 2, 0, maxX(w, LYING_W));
}

/** クマの向きに合わせた小物の x（右向きで dx の所。左向きなら鏡写し）。bx・bw はクマの左端と幅。 */
function rel(w: World, dx: number, key: PropKey, bx = w.x, bw = BEAR_W): number {
  return w.dir > 0 ? bx + dx : bx + bw - dx - propW(key);
}

function sc(w: World, look: Look, o: Extra = {}): Scene {
  const x = isLying(look) ? lyingX(w) : clamp(w.x, 0, maxX(w));
  return { act: w.act, look, x, lift: 0, flip: DIRECTIONAL.has(look) && w.dir < 0, props: [], ...o };
}

/** 同じ絵を n コマ。o は毎コマの付け足し（コマ番号から作ってもよい）。 */
function* hold(w: World, look: Look, n: number, o: Extra | ((i: number) => Extra) = {}): Act {
  for (let i = 0; i < n; i += 1) yield sc(w, look, typeof o === 'function' ? o(i) : o);
}

/** 頭の右上あたりに浮かぶ小物。i コマ目で speed コマに 1 ドット上がる。 */
function overHead(w: World, key: PropKey, i = 0, speed = 3, base = 15): Prop {
  return { key, x: rel(w, 13, key), y: base + Math.floor(i / speed) };
}

/** 1 歩（足を開く・閉じるの 2 コマで 2 ドット）。進めたら true。 */
function* step(w: World, goal: number, ticks = 2, o: (i: number) => Extra = () => ({})): Generator<Scene, boolean, undefined> {
  if (w.x === goal) return false;
  w.dir = goal > w.x ? 1 : -1;
  w.x += w.dir;
  yield* hold(w, 'walkA', ticks, o);
  if (w.x !== goal) w.x += w.dir;
  yield* hold(w, 'walkB', ticks, (i) => ({ lift: 1, ...o(i) }));
  return true;
}

// ---------------------------------------------------------------- 仕草

/** ぼんやり（息・まばたき・きょろきょろ・にこっ）。 */
function* idle(w: World, n: number): Act {
  w.act = 'idle';
  let i = 0;
  while (i < n) {
    const roll = w.rand();
    if (roll < 0.15) {
      yield* hold(w, w.rand() < 0.5 ? 'lookL' : 'lookR', 7);
      yield* hold(w, 'stand', 2);
      i += 9;
    } else if (roll < 0.25) {
      yield* hold(w, 'smile', 8);
      i += 8;
    } else {
      for (let k = 0; k < 20; k += 1) {
        let look: Look = Math.floor(k / 5) % 2 ? 'breathe' : 'stand';
        if (k === 16 || k === 17) look = 'blink';
        yield sc(w, look);
      }
      i += 20;
    }
  }
}

/** つまずいて転ぶ → 汗 → 起き上がってほこりを払う。 */
function* trip(w: World): Act {
  w.act = 'trip';
  yield* hold(w, 'surprised', 2, { lift: 1 });
  const dust = (i: number): Extra => {
    if (i >= 6) return {};
    const bx = lyingX(w);
    const key: PropKey = i < 3 ? 'dust' : 'dustS';
    return { props: [{ key, x: rel(w, -2, key, bx, LYING_W), y: 0 }, { key, x: rel(w, 19, key, bx, LYING_W), y: 0 }] };
  };
  yield* hold(w, 'fallen', 12, dust);
  yield* hold(w, 'fallen', 10, () => ({ props: [{ key: 'sweat', x: rel(w, 15, 'sweat', lyingX(w), LYING_W), y: 10 }] }));
  yield* hold(w, 'crouch', 3);
  for (let k = 0; k < 3; k += 1) {
    const puff = (i: number): Extra => ({ props: i === 0 ? [{ key: 'dustS', x: w.x + (k % 2 ? 13 : 1), y: 2 }] : [] });
    yield* hold(w, 'noL', 2, puff);
    yield* hold(w, 'noR', 2, puff);
  }
  yield* hold(w, 'smile', 10, { props: [overHead(w, 'sweat', 0, 3, 12)] });
}

/** おさんぽ（とことこ歩いて、ときどき立ち止まる。まれに転ぶ）。 */
function* stroll(w: World): Act {
  w.act = 'stroll';
  const goal = between(w.rand, 0, maxX(w));
  let steps = 0;
  let pauseAt = between(w.rand, 5, 10);
  while (yield* step(w, goal)) {
    steps += 1;
    if (steps > 3 && w.rand() < 0.04) {
      yield* trip(w);
      return;
    }
    if (steps === pauseAt) {
      pauseAt += between(w.rand, 5, 10);
      yield* hold(w, 'side', 5);
      if (w.rand() < 0.5) yield* hold(w, 'stand', 6);
    }
  }
  yield* hold(w, 'side', 4);
}

type Food = 'apple' | 'honey' | 'rice' | 'pepper';

function foodKey(food: Food, bite: number): PropKey {
  if (food === 'pepper') return 'pepper';
  return `${food}${clamp(bite, 0, 2)}` as PropKey;
}

/** ピーマンは食べない（くんくん → ！ → いやいや → ぽんと消える）。 */
function* refuse(w: World, food: Prop): Act {
  yield* hold(w, 'sniff', 10, { props: [food] });
  yield* hold(w, 'surprised', 4, { props: [food, overHead(w, 'bang', 0, 3, 17)] });
  for (let k = 0; k < 4; k += 1) {
    const o: Extra = { props: [food, { key: 'sweat', x: w.x + 15, y: 12 }] };
    yield* hold(w, 'noL', 3, o);
    yield* hold(w, 'noR', 3, o);
  }
  yield* hold(w, 'stand', 5, (i) => ({ props: [{ key: i < 2 ? 'dust' : 'dustS', x: food.x, y: 1 }] }));
  yield* hold(w, 'smile', 8, { props: [overHead(w, 'sweat', 0, 3, 12)] });
}

/** すわって両手で持ち、3 口で食べる（口を開ける → もぐもぐ）。食べ終わるとハート。 */
function* eat(w: World, food: Food, onGround: Prop): Act {
  yield* hold(w, 'crouch', 3, { props: [onGround] });
  const paws: Prop = { key: 'paws', x: w.x + 3, y: 4 };
  const inPaws = (bite: number): Prop[] => (bite > 2 ? [paws] : [{ key: foodKey(food, bite), x: w.x + 5, y: 2 }, paws]);
  yield* hold(w, 'sit', 4, { props: inPaws(0) });
  for (let bite = 0; bite < 3; bite += 1) {
    yield* hold(w, 'eatOpen', 4, { props: inPaws(bite) });
    // 最後の 1 口で食べ物はなくなる。
    const left = inPaws(bite === 2 ? 3 : bite + 1);
    yield* hold(w, 'eatChew', 3, { props: left });
    yield* hold(w, 'eatYum', 3, { props: left });
    yield* hold(w, 'eatChew', 3, { props: left });
  }
  yield* hold(w, 'sitHappy', 14, (i) => ({
    props: [overHead(w, 'heart', i, 3, 14), ...(i % 6 < 3 ? [{ key: 'sparkleS' as const, x: w.x - 1, y: 9 }] : [])],
  }));
  yield* hold(w, 'sit', 4);
}

/** おやつ（落ちてくる → 気づく → 歩いて行く → すわって 3 口で食べる → 喜ぶ）。ピーマンは いやいや。 */
function* snack(w: World): Act {
  w.act = 'snack';
  const food: Food = w.rand() < 0.2 ? 'pepper' : pick(w.rand, ['apple', 'honey', 'rice'] as const);
  // 食べ物は、クマがそこに立てば両手で持てる位置（クマの真ん中）に落とす。
  const at = between(w.rand, 0, maxX(w));
  const onGround: Prop = { key: foodKey(food, 0), x: at + 5, y: 0 };
  for (const y of [22, 18, 13, 7, 0, 2, 3, 2, 0]) yield sc(w, 'stand', { props: [{ ...onGround, y }] });
  yield* hold(w, 'surprised', 6, (i) => ({ lift: i < 2 ? 1 : 0, props: [onGround, overHead(w, 'bang', 0, 3, 17)] }));
  let walking = true;
  while (walking) walking = yield* step(w, at, 2, () => ({ props: [onGround] }));
  w.dir = 1;
  if (food === 'pepper') yield* refuse(w, onGround);
  else yield* eat(w, food, onGround);
}

/** 転がるボール（重さ・弾み・床の摩擦・壁とクマでの跳ね返り）。 */
class Ball {
  x: number;
  y = 22;
  vx = 0;
  vy = 0;
  /** クマの頭を越えて飛んでいる間（クマに当たらない）。 */
  over = false;

  constructor(private readonly w: World) {
    // クマのいない広い側に落とす。
    const right = w.x + BEAR_W / 2 < w.width / 2;
    this.x = right ? between(w.rand, Math.min(w.x + BEAR_W + 2, w.width - 5), w.width - 5) : between(w.rand, 0, Math.max(0, w.x - 7));
  }

  get moving(): boolean {
    return this.vx !== 0 || this.y > 0 || this.vy !== 0;
  }

  /** 1 コマ進めて、描く小物を返す。 */
  live = (): Extra => {
    this.fall();
    this.x += this.vx;
    this.bounceOffBear();
    const hi = this.w.width - 5;
    if (this.x < 0 || this.x > hi) {
      this.x = clamp(this.x, 0, hi);
      this.vx = -this.vx * 0.6;
    }
    if (Math.abs(this.vx) < 0.15) this.vx = 0;
    return { props: [this.prop()] };
  };

  prop(): Prop {
    const x = Math.round(this.x);
    return { key: (['ball0', 'ball1', 'ball2'] as const)[((x % 3) + 3) % 3] ?? 'ball0', x, y: Math.round(this.y) };
  }

  private fall(): void {
    this.vy -= 0.7;
    this.y += this.vy;
    if (this.y > 0) return;
    this.y = 0;
    this.vy = Math.abs(this.vy) > 1.2 ? -this.vy * 0.45 : 0;
    this.vx *= 0.9;
    this.over = false;
  }

  /** クマの体（左右の余白を除いた 14 ドット）に当たったら跳ね返る。 */
  private bounceOffBear(): void {
    const left = this.w.x + 1;
    const right = this.w.x + BEAR_W - 1;
    if (this.over || this.y >= 12 || this.x + 5 <= left || this.x >= right) return;
    const toLeft = this.x + 2.5 < this.w.x + BEAR_W / 2;
    this.x = toLeft ? left - 5 : right;
    this.vx = (toLeft ? -1 : 1) * Math.max(Math.abs(this.vx) * 0.5, 0.6);
  }
}

/** ボールの所まで歩いて 1 回ける。広い方へけり、後ろに回れない（壁ぎわ）ときは広い側に立って頭の上を越えるようにける。 */
function* kickBall(w: World, b: Ball): Act {
  const dir: 1 | -1 = w.width - 5 - b.x >= b.x ? 1 : -1;
  // クマの絵は左右に 1 ドットずつ余白があるので、ボールにぴったり付くのは右なら 15、左なら 4 ドット離れた所。
  const behind = (d: number): number => (d > 0 ? Math.round(b.x) - 15 : Math.round(b.x) + 4);
  const over = behind(dir) < 0 || behind(dir) > maxX(w);
  const goal = (): number => clamp(behind(over ? -dir : dir), 0, maxX(w));
  let guard = 0;
  while (guard < 80 && (yield* step(w, goal(), 1, b.live))) guard += 1;
  w.dir = over ? (-dir as 1 | -1) : dir;
  yield* hold(w, 'side', 3, b.live);
  b.vx = dir * (over ? 1.6 : 1.8 + w.rand() * 0.8);
  b.vy = over ? 4.6 : 2.2;
  b.over = over;
  yield* hold(w, 'kick', 3, b.live);
  // 転がるのを見送る。頭の上を越えたときは見上げてから振り向く。
  for (let i = 0; i < 45 && b.moving; i += 1) {
    if (over && i === 6) w.dir = dir;
    let look: Look = i < 8 ? 'side' : 'stand';
    if (over && i < 6) look = 'lookUp';
    yield sc(w, look, b.live());
  }
}

/** ボール（落ちてくる → 歩いて行ってける → 転がる → 何度か → ばんざい）。 */
function* ball(w: World): Act {
  w.act = 'ball';
  const b = new Ball(w);
  for (let i = 0; i < 30 && b.moving; i += 1) yield sc(w, 'stand', b.live());
  yield* hold(w, 'surprised', 5, () => ({ props: [...(b.live().props ?? []), overHead(w, 'bang', 0, 3, 17)] }));
  const kicks = between(w.rand, 2, 3);
  for (let k = 0; k < kicks; k += 1) yield* kickBall(w, b);
  yield* hold(w, 'crouch', 2, b.live);
  for (const lift of [2, 4, 5, 5, 4, 2]) yield sc(w, 'jump', { lift, ...b.live() });
  yield* hold(w, 'crouch', 2, b.live);
  yield* hold(w, 'cheer', 10, (i) => ({ props: [b.prop(), ...sparkles(w, i)] }));
  yield* hold(w, 'stand', 4, (i) => ({ props: [{ key: i < 2 ? 'dust' : 'dustS', x: Math.round(b.x), y: 0 }] }));
}

/** 決めポーズの両脇で交互にまたたく星。 */
function sparkles(w: World, i: number): Prop[] {
  const on = i % 4 < 2;
  return [
    { key: on ? 'sparkle' : 'sparkleS', x: w.x - 3, y: 12 },
    { key: on ? 'sparkleS' : 'sparkle', x: w.x + 15, y: 14 },
  ];
}

/** ちょうちょ（ふわふわ飛んでくる → 見上げて追いかける → 跳んでつかまえようとする → 逃げられて ？）。 */
function* butterfly(w: World): Act {
  w.act = 'butterfly';
  const fromLeft = w.rand() < 0.5;
  const f = { x: fromLeft ? -7 : w.width, y: 19, aim: between(w.rand, 4, Math.max(4, w.width - 9)) };
  let t = 0;
  const fly = (): Extra => {
    t += 1;
    if (t % 25 === 0) f.aim = between(w.rand, 2, Math.max(2, w.width - 9));
    f.x += clamp((f.aim - f.x) * 0.06, -0.7, 0.7) + Math.sin(t / 3) * 0.3;
    f.y = 19 + Math.round(Math.sin(t / 5) * 2);
    return { props: [{ key: t % 4 < 2 ? 'flyA' : 'flyB', x: Math.round(f.x), y: f.y }] };
  };
  const total = between(w.rand, 60, 90);
  while (t < total) {
    const target = clamp(Math.round(f.x) - 5, 0, maxX(w));
    if (Math.abs(target - w.x) > 4) {
      yield* step(w, target, 2, fly);
    } else {
      w.dir = f.x + 3 >= w.x + BEAR_W / 2 ? 1 : -1;
      yield sc(w, 'lookUp', fly());
    }
  }
  // つかまえようと跳ぶ。ちょうちょは上へ逃げる。
  yield* hold(w, 'crouchFocus', 4, fly);
  const flee = (): Prop[] => {
    if (f.y >= STAGE_H) return [];
    t += 1;
    f.y += 2;
    f.x += w.dir * 0.8;
    return [{ key: t % 2 ? 'flyA' : 'flyB', x: Math.round(f.x), y: f.y }];
  };
  for (const lift of [2, 4, 6, 7, 7, 6, 4, 2]) yield sc(w, 'jumpReach', { lift, props: flee() });
  yield* hold(w, 'crouch', 2, () => ({ props: flee() }));
  yield* hold(w, 'sitPuzzled', 16, (i) => ({ props: [...flee(), { key: 'question', x: w.x + 13, y: i < 3 ? 14 : 15 }] }));
  yield* hold(w, 'smile', 6);
}

/** うた（体を揺らして音符が浮かぶ → くるっと回って決めポーズ）。 */
function* sing(w: World): Act {
  w.act = 'sing';
  const n = between(w.rand, 40, 64);
  const notes: { x: number; t0: number }[] = [];
  for (let t = 0; t < n; t += 1) {
    if (t % 8 === 0) notes.push({ x: (t / 8) % 2 ? w.x + 14 : w.x - 3, t0: t });
    const sway = Math.floor(t / 8) % 2;
    const props = notes
      .filter((nt) => t - nt.t0 < 16)
      .map((nt): Prop => ({ key: 'note', x: nt.x + (Math.floor((t - nt.t0) / 4) % 2), y: 11 + Math.floor((t - nt.t0) / 2) }));
    yield { ...sc(w, Math.floor(t / 4) % 2 ? 'singB' : 'singA', { props }), x: clamp(w.x + sway, 0, maxX(w)) };
  }
  for (let k = 0; k < 2; k += 1) {
    yield* hold(w, 'stand', 2);
    yield* hold(w, 'side', 2, { flip: false });
    yield* hold(w, 'back', 2);
    yield* hold(w, 'side', 2, { flip: true });
  }
  yield* hold(w, 'crouch', 2);
  yield* hold(w, 'cheer', 10, (i) => ({ props: sparkles(w, i) }));
}

/** 寝ている間の 1 コマ（布団で息をし、鼻ちょうちんがふくらんで割れ、Zzz が上がる）。 */
function sleepScene(w: World, t: number): Scene {
  const bx = lyingX(w);
  const at = (dx: number, key: PropKey): number => rel(w, dx, key, bx, LYING_W);
  const blanket: PropKey = Math.floor(t / 10) % 2 ? 'blanketUp' : 'blanket';
  const props: Prop[] = [
    { key: 'pillow', x: at(11, 'pillow'), y: 0, back: true },
    { key: blanket, x: at(-1, blanket), y: 0 },
  ];
  const cyc = t % 28;
  if (cyc < 10) props.push({ key: 'bubbleS', x: at(19, 'bubbleS'), y: 3 });
  else if (cyc < 18) props.push({ key: 'bubbleL', x: at(19, 'bubbleL'), y: 2 });
  else if (cyc < 20) props.push({ key: 'sparkleS', x: at(19, 'sparkleS'), y: 3 });
  const z = t % 24;
  const zKey: PropKey = z < 12 ? 'zSmall' : 'zBig';
  props.push({ key: zKey, x: at(14 + Math.floor(z / 8), zKey), y: 10 + Math.floor((z % 12) / 3) });
  return sc(w, 'sleep', { props });
}

/** おひるね（あくび → こっくり → 布団で寝る → 起きて伸び）。 */
function* nap(w: World, ticks: number, drowsy = true): Act {
  w.act = 'nap';
  if (drowsy) {
    yield* hold(w, 'yawn', 10);
    for (let k = 0; k < 3; k += 1) {
      yield* hold(w, 'drowsy', 5);
      yield* hold(w, 'sitBlink', 4);
    }
  }
  w.sleeping = true;
  for (let t = 0; t < ticks; t += 1) yield sleepScene(w, t);
  w.sleeping = false;
  yield* hold(w, 'drowsy', 6);
  yield* hold(w, 'yawn', 10);
  yield* hold(w, 'sitBlink', 2);
  yield* hold(w, 'sit', 6);
}

/** こっちに手を振る。 */
function* wave(w: World): Act {
  w.act = 'wave';
  yield* hold(w, 'stand', 3);
  for (let k = 0; k < 5; k += 1) {
    const o = (i: number): Extra => ({ props: [overHead(w, 'heartS', k * 6 + i, 4, 15)] });
    yield* hold(w, 'waveA', 3, o);
    yield* hold(w, 'waveB', 3, (i) => o(i + 3));
  }
  yield* hold(w, 'smile', 6);
}

/** はねて喜ぶ（タップ）。 */
function* hop(w: World): Act {
  yield* hold(w, 'crouch', 2);
  for (const lift of [2, 4, 5, 4, 2]) yield sc(w, 'jump', { lift, props: [overHead(w, 'heart', 0, 1, 15 + lift)] });
  yield* hold(w, 'crouch', 2);
  yield* hold(w, 'happy', 10, (i) => ({ props: [overHead(w, 'heart', i, 2, 17)] }));
}

function isNight(hour: number): boolean {
  return hour >= 22 || hour < 6;
}

/** タップされたとき。寝ていたら飛び起き、何度もつつくと怒る。 */
function* react(w: World, taps: number, wasSleeping: boolean): Act {
  w.act = 'react';
  w.sleeping = false;
  if (wasSleeping) {
    for (const lift of [2, 3, 2, 0]) yield sc(w, 'surprised', { lift, props: [overHead(w, 'bang', 0, 3, 18)] });
    yield* hold(w, 'surprised', 6, { props: [overHead(w, 'bang', 0, 3, 17)] });
    yield* hold(w, 'smile', 10, { props: [overHead(w, 'sweat', 0, 3, 12)] });
    if (isNight(w.hour())) yield* nap(w, between(w.rand, 200, 400));
    else yield* hold(w, 'yawn', 10);
    return;
  }
  if (taps >= 4) {
    const o: Extra = { props: [{ key: 'anger', x: w.x + 12, y: 13 }] };
    for (let k = 0; k < 3; k += 1) {
      yield* hold(w, 'noL', 3, o);
      yield* hold(w, 'noR', 3, o);
    }
    yield* hold(w, 'stand', 6, o);
    return;
  }
  const r = w.rand();
  if (r < 0.5) yield* hop(w);
  else if (r < 0.8) yield* wave(w);
  else yield* hold(w, 'smile', 14, (i) => ({ props: [overHead(w, 'heartS', i, 3, 14), { key: 'heartS', x: w.x - 1, y: 12 + Math.floor(i / 4) }] }));
}

type Choice = readonly [ActName, number];

function choices(w: World, last: ActName): Choice[] {
  const wide = w.width >= 40;
  const list: Choice[] = isNight(w.hour())
    ? [['nap', 70], ['idle', 20], ['stroll', 10]]
    : [
        ['idle', 30],
        ['stroll', 28],
        ['snack', 9],
        ['ball', wide ? 8 : 0],
        ['butterfly', wide ? 7 : 0],
        ['sing', 7],
        ['nap', 7],
        ['wave', 4],
      ];
  return list.filter(([name, weight]) => weight > 0 && (name !== last || name === 'idle'));
}

function choose(w: World, last: ActName): ActName {
  const list = choices(w, last);
  const total = list.reduce((a, [, n]) => a + n, 0);
  let r = w.rand() * total;
  for (const [name, n] of list) {
    r -= n;
    if (r < 0) return name;
  }
  return 'idle';
}

function run(w: World, name: ActName): Act {
  switch (name) {
    case 'stroll':
      return stroll(w);
    case 'snack':
      return snack(w);
    case 'ball':
      return ball(w);
    case 'butterfly':
      return butterfly(w);
    case 'sing':
      return sing(w);
    case 'nap':
      return nap(w, isNight(w.hour()) ? between(w.rand, 300, 600) : between(w.rand, 60, 120));
    case 'wave':
      return wave(w);
    default:
      return idle(w, between(w.rand, 30, 70));
  }
}

/** 暮らし（仕草を選んでは流す。仕草の間には短い間を置く）。 */
function* life(w: World): Act {
  let last: ActName = 'idle';
  // 開いたときは、まずのんびりしているところから。
  yield* idle(w, 20);
  for (;;) {
    const name = choose(w, last);
    yield* run(w, name);
    last = name;
    w.act = 'idle';
    yield* hold(w, 'stand', 3);
  }
}

export interface Bear {
  /** 1 コマ進めて、そのコマの絵を返す。width はステージの幅（ドット）。 */
  tick: (width: number) => Scene;
  /** タップされた。 */
  tap: () => void;
}

export function createBear(width: number, seed: number, hour: () => number = () => new Date().getHours()): Bear {
  const w: World = { width, x: 0, dir: 1, rand: seededRand(seed), hour, act: 'idle', sleeping: false };
  w.x = Math.floor(maxX(w) / 2);
  let gen: Act = life(w);
  let ticks = 0;
  let tapTicks: number[] = [];
  return {
    tick(next) {
      w.width = next;
      w.x = clamp(w.x, 0, maxX(w));
      ticks += 1;
      const r = gen.next();
      if (!r.done) return r.value;
      gen = life(w);
      return gen.next().value ?? sc(w, 'stand');
    },
    tap() {
      // 3 秒の間に何度つつかれたか。
      tapTicks = [...tapTicks.filter((t) => ticks - t < 30), ticks];
      const sleeping = w.sleeping;
      const taps = tapTicks.length;
      gen = (function* (): Act {
        yield* react(w, taps, sleeping);
        yield* life(w);
      })();
    },
  };
}
