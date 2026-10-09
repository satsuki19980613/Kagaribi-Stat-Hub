import type { Rank } from './model';

/** クラブマッチの個人ポイント（公式）: 1位 +5 / 2位 +3 / 3位 +2 / 4位 +1 / 5位 ±0 / 6位 −1。 */
export const RANK_POINTS: Readonly<Record<Rank, number>> = { 1: 5, 2: 3, 3: 2, 4: 1, 5: 0, 6: -1 };

export const RANKS: readonly Rank[] = [1, 2, 3, 4, 5, 6];

export function pointsOf(rank: Rank): number {
  return RANK_POINTS[rank];
}

/** 加点（+1 以上）になる順位か。1〜4位。 */
export function isPlus(rank: Rank): boolean {
  return rank <= 4;
}

export function isRank(v: unknown): v is Rank {
  return v === 1 || v === 2 || v === 3 || v === 4 || v === 5 || v === 6;
}

/** +5 / ±0 / −1 */
export function fmtPt(v: number): string {
  if (v === 0) return '±0';
  return v > 0 ? `+${v}` : `−${Math.abs(v)}`;
}
