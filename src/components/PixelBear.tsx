import { useEffect, useRef } from 'react';
import { BEAR_COLORS, LYING, POSES, PROPS, composePose, type PoseKey, type Sprite } from './bearSprites';
import { BEAR_W, STAGE_H, TICK_MS, createBear, isLying, type Bear, type Scene } from './bearLogic';

/** 1 ドットの大きさ（CSS px）。 */
const DOT = 3;

/** ポーズは毎コマ組み立てず、最初に 1 枚の絵にしておく。 */
const POSE_SPRITES = Object.fromEntries(Object.entries(POSES).map(([k, p]) => [k, composePose(p)])) as Record<PoseKey, Sprite>;

/** 絵を下端 bottom（キャンバスの y）に揃えて描く。 */
function drawSprite(ctx: CanvasRenderingContext2D, sp: Sprite, x: number, bottom: number, flip = false): void {
  const top = bottom - sp.length;
  sp.forEach((row, dy) => {
    const w = row.length;
    for (let dx = 0; dx < w; dx += 1) {
      const c = BEAR_COLORS[row.charAt(flip ? w - 1 - dx : dx)];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x + dx, top + dy, 1, 1);
    }
  });
}

function draw(ctx: CanvasRenderingContext2D, s: Scene, width: number): void {
  ctx.clearRect(0, 0, width, STAGE_H);
  for (const p of s.props) if (p.back) drawSprite(ctx, PROPS[p.key], p.x, STAGE_H - p.y, p.flip);
  const bear = isLying(s.look) ? LYING[s.look] : POSE_SPRITES[s.look];
  drawSprite(ctx, bear, s.x, STAGE_H - s.lift, s.flip);
  for (const p of s.props) if (!p.back) drawSprite(ctx, PROPS[p.key], p.x, STAGE_H - p.y, p.flip);
}

/**
 * 見出しの空きで暮らすドット絵のクマ（飾り）。仕草は bearLogic の台本で、タップすると反応する。
 * 動きを減らす設定のときは立ったまま動かない。
 */
export function PixelBear(): JSX.Element {
  const wrap = useRef<HTMLButtonElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const bear = useRef<Bear | null>(null);

  useEffect(() => {
    const el = wrap.current;
    const cv = canvas.current;
    const ctx = cv?.getContext('2d');
    if (!el || !cv || !ctx) return undefined;
    let width = 0;
    const still = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let last: Scene | null = null;

    const resize = (): void => {
      width = Math.max(BEAR_W, Math.floor(el.clientWidth / DOT));
      cv.width = width;
      cv.height = STAGE_H;
      cv.style.width = `${width * DOT}px`;
      bear.current ??= createBear(width, Date.now());
      last ??= bear.current.tick(width);
      draw(ctx, still ? { ...last, look: 'stand', lift: 0, props: [], flip: false } : last, width);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    if (still) return () => ro.disconnect();

    const id = globalThis.setInterval(() => {
      // 裏に回っている間は止めておく。
      if (document.hidden || !bear.current) return;
      last = bear.current.tick(width);
      draw(ctx, last, width);
    }, TICK_MS);
    return () => {
      ro.disconnect();
      globalThis.clearInterval(id);
    };
  }, []);

  return (
    <button type="button" ref={wrap} className="pixbear" aria-label="クマ（タップで反応する）" onClick={() => bear.current?.tap()}>
      <canvas ref={canvas} height={STAGE_H} style={{ height: STAGE_H * DOT }} />
    </button>
  );
}
