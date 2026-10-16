import { useEffect, useRef, useState } from 'react';
import { BEAR_COLORS, LYING, POSES, PROPS, VARIANT_COLORS, VARIANT_NAMES, composePose, type BearVariant, type PoseKey, type Sprite } from './bearSprites';
import { BEAR_W, STAGE_H, TICK_MS, createBear, isLying, type Bear, type Scene } from './bearLogic';

/** 1 ドットの大きさ（CSS px）。 */
const DOT = 3;

/** ポーズは毎コマ組み立てず、最初に 1 枚の絵にしておく。 */
const POSE_SPRITES = Object.fromEntries(Object.entries(POSES).map(([k, p]) => [k, composePose(p)])) as Record<PoseKey, Sprite>;

type Palette = Readonly<Record<string, string>>;

/** 色違いごとのパレット（クマの絵と持つ手に使う）。 */
const PALETTES = Object.fromEntries(
  Object.entries(VARIANT_COLORS).map(([k, v]) => [k, { ...BEAR_COLORS, ...v }]),
) as Record<BearVariant, Palette>;

/** 絵を下端 bottom（キャンバスの y）に揃えて描く。 */
function drawSprite(ctx: CanvasRenderingContext2D, sp: Sprite, x: number, bottom: number, flip = false, pal: Palette = BEAR_COLORS): void {
  const top = bottom - sp.length;
  sp.forEach((row, dy) => {
    const w = row.length;
    for (let dx = 0; dx < w; dx += 1) {
      const c = pal[row.charAt(flip ? w - 1 - dx : dx)];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x + dx, top + dy, 1, 1);
    }
  });
}

/** 足もとの影（浮くほど小さく薄く）。 */
function drawShadow(ctx: CanvasRenderingContext2D, s: Scene, bearW: number): void {
  const w = Math.max(4, bearW - 2 - s.lift * 2);
  ctx.fillStyle = `rgba(150, 40, 80, ${s.lift > 0 ? 0.1 : 0.16})`;
  ctx.fillRect(s.x + Math.round((bearW - w) / 2), STAGE_H - 1, w, 1);
}

function draw(ctx: CanvasRenderingContext2D, s: Scene, width: number, variant: BearVariant): void {
  const pal = PALETTES[variant];
  ctx.clearRect(0, 0, width, STAGE_H);
  const bear = isLying(s.look) ? LYING[s.look] : POSE_SPRITES[s.look];
  drawShadow(ctx, s, bear[0]?.length ?? BEAR_W);
  for (const p of s.props) if (p.back) drawSprite(ctx, PROPS[p.key], p.x, STAGE_H - p.y, p.flip);
  drawSprite(ctx, bear, s.x, STAGE_H - s.lift, s.flip, pal);
  for (const p of s.props) if (!p.back) drawSprite(ctx, PROPS[p.key], p.x, STAGE_H - p.y, p.flip, p.key === 'paws' ? pal : BEAR_COLORS);
}

/**
 * ホームの下で暮らすドット絵のクマ（飾り）。仕草は bearLogic の台本で、タップすると反応する。
 * 開くたびに色を引き、たまにレアクマが出る。動きを減らす設定のときは立ったまま動かない。
 */
export function PixelBear(): JSX.Element {
  const wrap = useRef<HTMLButtonElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const bear = useRef<Bear | null>(null);
  const [variant, setVariant] = useState<BearVariant>('brown');

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
      if (!bear.current) {
        bear.current = createBear(width, Date.now());
        setVariant(bear.current.variant);
      }
      last ??= bear.current.tick(width);
      draw(ctx, still ? { ...last, look: 'stand', lift: 0, props: [], flip: false } : last, width, bear.current.variant);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    if (still) return () => ro.disconnect();

    const id = globalThis.setInterval(() => {
      // 裏に回っている間は止めておく。
      if (document.hidden || !bear.current) return;
      last = bear.current.tick(width);
      draw(ctx, last, width, bear.current.variant);
    }, TICK_MS);
    return () => {
      ro.disconnect();
      globalThis.clearInterval(id);
    };
  }, []);

  return (
    <button type="button" ref={wrap} className="pixbear" aria-label={`${VARIANT_NAMES[variant]}（タップで反応する）`} onClick={() => bear.current?.tap()}>
      <canvas ref={canvas} height={STAGE_H} style={{ height: STAGE_H * DOT }} />
    </button>
  );
}
