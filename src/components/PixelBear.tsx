import { useEffect, useRef } from 'react';
import { BALL_FRAMES, BEAR_COLORS, BEAR_FRAMES, HEART, ZZZ, type Sprite } from './bearSprites';
import { BALL_W, BEAR_W, SLEEP_W, TICK_MS, bearPose, initialBear, poke, seededRand, stepBear, type BearState } from './bearLogic';

/** 1 ドットの大きさ（CSS px）とステージの高さ（ドット）。 */
const DOT = 3;
const STAGE_H = 26;

function drawSprite(ctx: CanvasRenderingContext2D, sp: Sprite, x: number, y: number, flip = false): void {
  sp.forEach((row, dy) => {
    const w = row.length;
    for (let dx = 0; dx < w; dx += 1) {
      const c = BEAR_COLORS[row.charAt(flip ? w - 1 - dx : dx)];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x + dx, y + dy, 1, 1);
    }
  });
}

function draw(ctx: CanvasRenderingContext2D, s: BearState, width: number): void {
  ctx.clearRect(0, 0, width, STAGE_H);
  const ground = STAGE_H - 1;
  const pose = bearPose(s);
  const sp = BEAR_FRAMES[pose.frame];
  // 寝ているときは横に長いので、はみ出さないよう左へ寄せる。
  const x = pose.frame === 'sleep' ? Math.max(0, Math.min(s.x - 2, width - SLEEP_W)) : s.x;
  const top = ground - sp.length - pose.lift;
  drawSprite(ctx, sp, x, top, pose.flip);

  if (s.mode === 'sleep') {
    // Zzz は頭の上でゆっくり浮かんでは戻る。
    const rise = Math.floor(s.t / 6) % 3;
    drawSprite(ctx, ZZZ, x + SLEEP_W - 4, Math.max(0, top - 5 - rise));
  }
  if (s.mode === 'hop' && s.t < 6) drawSprite(ctx, HEART, x + BEAR_W - 3, Math.max(0, top - 5 - Math.floor(s.t / 2)));
  if (s.ball != null) {
    // 転がった距離で帯の位置を変える。
    const ball = BALL_FRAMES[((s.ball % 3) + 3) % 3];
    if (ball) drawSprite(ctx, ball, s.ball, ground - BALL_W);
  }
}

/**
 * 見出しの空きで暮らすドット絵のクマ（飾り）。歩く・寝る・ボールで遊ぶを気ままに繰り返し、
 * タップすると跳ねる。動きを減らす設定のときは立ったまま動かない。
 */
export function PixelBear(): JSX.Element {
  const wrap = useRef<HTMLButtonElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const state = useRef<BearState | null>(null);

  useEffect(() => {
    const el = wrap.current;
    const cv = canvas.current;
    const ctx = cv?.getContext('2d');
    if (!el || !cv || !ctx) return undefined;
    const rand = seededRand(Date.now());
    let width = 0;
    const still = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    const resize = (): void => {
      width = Math.max(BEAR_W, Math.floor(el.clientWidth / DOT));
      cv.width = width;
      cv.height = STAGE_H;
      cv.style.width = `${width * DOT}px`;
      state.current ??= initialBear(width, rand);
      draw(ctx, state.current, width);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    if (still) return () => ro.disconnect();

    const id = globalThis.setInterval(() => {
      // 裏に回っている間は止めておく。
      if (document.hidden || !state.current) return;
      state.current = stepBear(state.current, width, rand);
      draw(ctx, state.current, width);
    }, TICK_MS);
    return () => {
      ro.disconnect();
      globalThis.clearInterval(id);
    };
  }, []);

  return (
    <button
      type="button"
      ref={wrap}
      className="pixbear"
      aria-label="クマ（タップで跳ねる）"
      onClick={() => {
        if (state.current) state.current = poke(state.current);
      }}
    >
      <canvas ref={canvas} height={STAGE_H} style={{ height: STAGE_H * DOT }} aria-hidden="true" />
    </button>
  );
}
