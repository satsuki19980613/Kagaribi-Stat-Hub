/**
 * クラブを選ぶプルダウン（Picker.tsx）の、DOM に依らない部分。
 * キー操作での移動先と、開いた一覧を置く場所を決める。
 */

/** PageUp / PageDown で動く行数。 */
const PAGE = 8;

/**
 * キーを押したときの次の行。動かないキーなら null。
 * 端では止まる（上の端から上へ回り込まない）。
 */
export function nextIndex(key: string, cur: number, len: number): number | null {
  if (len <= 0) return null;
  const last = len - 1;
  const at = Math.min(Math.max(cur, 0), last);
  switch (key) {
    case 'ArrowDown':
      return cur < 0 ? 0 : Math.min(at + 1, last);
    case 'ArrowUp':
      return cur < 0 ? last : Math.max(at - 1, 0);
    case 'Home':
      return 0;
    case 'End':
      return last;
    case 'PageDown':
      return Math.min(at + PAGE, last);
    case 'PageUp':
      return Math.max(at - PAGE, 0);
    default:
      return null;
  }
}

export interface Box {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface Placement {
  /** 画面の端からの位置（position: fixed）。下に開くときは top、上に開くときは bottom を使う。 */
  left: number;
  top?: number;
  bottom?: number;
  width: number;
  maxHeight: number;
}

/** 画面の端からあける幅。 */
const GUTTER = 8;
/** 押した欄との間。 */
const GAP = 4;
/** 一覧の幅の下限と、高さの上限。 */
const MIN_WIDTH = 280;
const MAX_HEIGHT = 440;
/** 下にこれだけの高さが取れないときは、上に開く。 */
const MIN_BELOW = 220;

/**
 * 開いた一覧の置き場所。押した欄の右端にそろえ、幅は欄の幅か MIN_WIDTH の広い方（画面からはみ出さない）。
 * 下に十分な高さがあれば下へ、無ければ広い方へ開く。
 */
export function placePopup(anchor: Box, viewW: number, viewH: number): Placement {
  const width = Math.min(Math.max(anchor.right - anchor.left, MIN_WIDTH), viewW - GUTTER * 2);
  const left = Math.min(Math.max(anchor.right - width, GUTTER), viewW - GUTTER - width);
  const below = viewH - anchor.bottom - GAP - GUTTER;
  const above = anchor.top - GAP - GUTTER;
  if (below >= MIN_BELOW || below >= above) {
    return { left, top: anchor.bottom + GAP, width, maxHeight: Math.max(Math.min(below, MAX_HEIGHT), 0) };
  }
  return { left, bottom: viewH - anchor.top + GAP, width, maxHeight: Math.min(above, MAX_HEIGHT) };
}
