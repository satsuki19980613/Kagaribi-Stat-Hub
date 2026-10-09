import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';

/**
 * 依存なしの SVG チャート（折れ線・棒）。
 *
 * - 注目したメンバー（slot あり）は系列色の 2px 線、それ以外は細い灰色の線で文脈として薄く描く。
 *   色はメンバーに付いて回る（slot は選んだときに決まり、順位で塗り替えない）。
 * - 縦のクロスヘアが最寄りの X に吸い付き、ツールチップにその X の値を全部出す。
 * - 注目が 4 本以下なら線の右端に名前を直接書く。値そのものは表（各画面の表）でも読める。
 */

export interface LineSeries {
  id: string;
  name: string;
  values: (number | null)[];
  /** 0〜7 の系列色。null は文脈線（灰色）。 */
  slot: number | null;
}

const PAD = { t: 12, r: 12, b: 26, l: 36 };
const LABEL_W = 64;

function useWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setW(el.clientWidth);
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/** 見やすい目盛り（1・2・5 刻み）。 */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(Number(v.toFixed(6)));
  return out;
}

/** 名前ラベルが重ならないよう縦に散らす。 */
function spread(ys: { id: string; y: number }[], gap: number, lo: number, hi: number): Map<string, number> {
  const sorted = [...ys].sort((a, b) => a.y - b.y);
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1]!;
    const cur = sorted[i]!;
    if (cur.y - prev.y < gap) cur.y = prev.y + gap;
  }
  const over = (sorted.at(-1)?.y ?? 0) - hi;
  if (over > 0) for (const s of sorted) s.y -= over;
  for (const s of sorted) s.y = Math.max(lo, s.y);
  return new Map(sorted.map((s) => [s.id, s.y]));
}

export function LineChart(props: {
  labels: string[];
  series: LineSeries[];
  format: (v: number) => string;
  height?: number;
  /** 0 を軸に含めて線を強調する（ポイントは負にもなる）。false なら値の範囲に合わせる。 */
  zero?: boolean;
  /** 目盛りの表記（省略時は format）。 */
  tickFormat?: (v: number) => string;
  /** 値の点を打つ（点がまばらなシーズン推移向け）。 */
  markers?: boolean;
  ariaLabel: string;
  empty?: string;
}): JSX.Element {
  const { labels, series, format } = props;
  const H = props.height ?? 220;
  const [box, W] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const focused = series.filter((s) => s.slot != null);
  const direct = focused.length > 0 && focused.length <= 4;
  const padR = PAD.r + (direct ? LABEL_W : 0);

  const all = series.flatMap((s) => s.values.filter((v): v is number => v != null));
  const hasData = all.length > 0;
  const lo = props.zero ? Math.min(0, ...all) : Math.min(...all);
  const hi = props.zero ? Math.max(0, ...all) : Math.max(...all);
  const ticks = hasData ? niceTicks(lo, hi) : [0, 1];
  const tickFormat = props.tickFormat ?? format;
  const y0 = ticks[0] ?? 0;
  const y1 = ticks.at(-1) ?? 1;
  const iw = Math.max(10, W - PAD.l - padR);
  const ih = H - PAD.t - PAD.b;
  const n = labels.length;
  const x = (i: number): number => PAD.l + (n <= 1 ? iw / 2 : (i * iw) / (n - 1));
  const y = (v: number): number => PAD.t + ih - ((v - y0) / (y1 - y0 || 1)) * ih;

  function path(values: (number | null)[]): string {
    let d = '';
    let pen = false;
    values.forEach((v, i) => {
      if (v == null) {
        pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  }

  // X ラベルは最大 ~7 個に間引く（最初と最後は必ず出す）。
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 56))));
  const showX = (i: number): boolean => i === 0 || i === n - 1 || (i % every === 0 && n - 1 - i >= every);

  function onMove(e: RPointerEvent<SVGRectElement>): void {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    const i = n <= 1 ? 0 : Math.round((px / r.width) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  }

  const lastIdx = (vals: (number | null)[]): number => {
    for (let i = vals.length - 1; i >= 0; i -= 1) if (vals[i] != null) return i;
    return -1;
  };
  const labelY = direct
    ? spread(
        focused.flatMap((s) => {
          const li = lastIdx(s.values);
          return li < 0 ? [] : [{ id: s.id, y: y(s.values[li]!) }];
        }),
        13,
        PAD.t + 4,
        PAD.t + ih,
      )
    : new Map<string, number>();

  const tip = hover == null ? null : (() => {
    const rows = (focused.length ? focused : series)
      .map((s) => ({ s, v: s.values[hover] ?? null }))
      .filter((r): r is { s: LineSeries; v: number } => r.v != null)
      .sort((a, b) => b.v - a.v);
    return { rows: focused.length ? rows : rows.slice(0, 6), more: focused.length ? 0 : Math.max(0, rows.length - 6) };
  })();
  const tipLeft = hover == null ? 0 : x(hover);

  return (
    <div className="chart" ref={box} style={{ height: H }}>
      {W > 0 && (
        <svg width={W} height={H} role="img" aria-label={props.ariaLabel}>
          {ticks.map((t) => (
            <g key={t}>
              <line className={`grid${t === 0 && props.zero ? ' zero' : ''}`} x1={PAD.l} x2={PAD.l + iw} y1={y(t)} y2={y(t)} />
              <text className="ax" x={PAD.l - 6} y={y(t)} dy="0.32em" textAnchor="end">
                {tickFormat(t)}
              </text>
            </g>
          ))}
          {labels.map((l, i) =>
            showX(i) ? (
              <text key={i} className="ax" x={x(i)} y={H - 8} textAnchor={n > 1 && i === 0 ? 'start' : n > 1 && i === n - 1 ? 'end' : 'middle'}>
                {l}
              </text>
            ) : null,
          )}
          {hasData &&
            series
              .filter((s) => s.slot == null)
              .map((s) => <path key={s.id} className="ctx" d={path(s.values)} />)}
          {focused.map((s) => (
            <g key={s.id} className={`s${s.slot! + 1}`}>
              <path className="ln" d={path(s.values)} />
              {s.values.map((v, i) => {
                if (v == null) return null;
                const solo = s.values[i - 1] == null && s.values[i + 1] == null;
                return props.markers || solo || i === hover ? <circle key={i} className="mk" cx={x(i)} cy={y(v)} r={4} /> : null;
              })}
              {direct && labelY.has(s.id) && (
                <text className="dl" x={x(lastIdx(s.values)) + 8} y={labelY.get(s.id)} dy="0.32em">
                  {s.name.length > 6 ? `${s.name.slice(0, 6)}…` : s.name}
                </text>
              )}
            </g>
          ))}
          {hover != null && <line className="xh" x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={PAD.t + ih} />}
          <rect
            className="hit"
            x={PAD.l - 8}
            y={0}
            width={iw + 16}
            height={H}
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={(e) => {
              if (e.pointerType === 'mouse') setHover(null);
            }}
          />
        </svg>
      )}
      {!hasData && <div className="chart-empty">{props.empty ?? 'まだ記録がありません'}</div>}
      {tip && hasData && (
        <div className={`tip${tipLeft > W / 2 ? ' l' : ''}`} style={{ left: tipLeft }}>
          <b className="tip-h">{labels[hover!]}</b>
          {tip.rows.length === 0 && <span className="tip-r muted">記録なし</span>}
          {tip.rows.map(({ s, v }) => (
            <span key={s.id} className={`tip-r${s.slot != null ? ` s${s.slot + 1}` : ''}`}>
              <i className="key" />
              <b>{format(v)}</b>
              <span>{s.name}</span>
            </span>
          ))}
          {tip.more > 0 && <span className="tip-r muted">ほか {tip.more} 人</span>}
        </div>
      )}
    </div>
  );
}

/** 単一系列の棒（クラブ合計ptのシーズン推移）。負の値は 0 線の下へ伸ばす。 */
export function BarChart(props: { labels: string[]; values: number[]; format: (v: number) => string; height?: number; ariaLabel: string }): JSX.Element {
  const H = props.height ?? 160;
  const [box, W] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const { labels, values } = props;
  const ticks = niceTicks(Math.min(0, ...values), Math.max(0, ...values), 3);
  const y0 = ticks[0] ?? 0;
  const y1 = ticks.at(-1) ?? 1;
  const iw = Math.max(10, W - PAD.l - PAD.r);
  const ih = H - PAD.t - PAD.b;
  const n = labels.length;
  const band = iw / Math.max(1, n);
  const bw = Math.min(36, band - 2);
  const y = (v: number): number => PAD.t + ih - ((v - y0) / (y1 - y0 || 1)) * ih;

  useEffect(() => setHover(null), [n]);

  return (
    <div className="chart" ref={box} style={{ height: H }}>
      {W > 0 && (
        <svg width={W} height={H} role="img" aria-label={props.ariaLabel}>
          {ticks.map((t) => (
            <g key={t}>
              <line className={`grid${t === 0 ? ' zero' : ''}`} x1={PAD.l} x2={PAD.l + iw} y1={y(t)} y2={y(t)} />
              <text className="ax" x={PAD.l - 6} y={y(t)} dy="0.32em" textAnchor="end">
                {props.format(t)}
              </text>
            </g>
          ))}
          {values.map((v, i) => {
            const cx = PAD.l + band * i + band / 2;
            const top = Math.min(y(v), y(0));
            const h = Math.max(1, Math.abs(y(v) - y(0)));
            return (
              <g key={i} className={`bar${hover === i ? ' on' : ''}`}>
                <rect className="b" x={cx - bw / 2} y={top} width={bw} height={h} />
                <text className="ax" x={cx} y={H - 8} textAnchor="middle">
                  {labels[i]}
                </text>
                <text className="bv" x={cx} y={v >= 0 ? top - 4 : top + h + 11} textAnchor="middle">
                  {props.format(v)}
                </text>
                <rect
                  className="hit"
                  x={cx - band / 2}
                  y={0}
                  width={band}
                  height={H}
                  onPointerEnter={() => setHover(i)}
                  onPointerLeave={() => setHover(null)}
                />
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
