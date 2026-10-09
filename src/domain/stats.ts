/**
 * 集計。記録（順位）から得点・率を出し、スタッツのスナップショットから生存ターン数を出す。
 *
 * 指標の定義:
 * - 平均ポイント = 合計pt ÷ 参加数
 * - 加点率       = 1〜4位（+1 以上）の回数 ÷ 参加数
 * - 1位率        = 1位の回数 ÷ 参加数
 * - 平均順位     = 順位の平均
 * - 生存ターン数 = 参加ハンド数 ÷ (参加回数 × VPIP[%])
 *   …参加ハンド数は VPIP したハンド数なので、÷VPIP で配られた総ハンド数、÷参加回数で 1 試合あたり。
 *   参加回数・VPIP・参加ハンド数はすべて同じスナップショット（同じ時点の値）を使う。
 */

import type { MatchRecord, Member, StatSnapshot } from './model';
import { isPlus, pointsOf } from './points';

export interface Summary {
  /** 参加数（記録件数）。 */
  n: number;
  total: number;
  /** n = 0 のときは null。以下同じ。 */
  avg: number | null;
  plusRate: number | null;
  winRate: number | null;
  avgRank: number | null;
  /** 1〜6位の回数。 */
  dist: [number, number, number, number, number, number];
}

export function summarize(records: readonly MatchRecord[]): Summary {
  const dist: Summary['dist'] = [0, 0, 0, 0, 0, 0];
  let total = 0;
  let plus = 0;
  let rankSum = 0;
  for (const r of records) {
    dist[r.rank - 1] = (dist[r.rank - 1] ?? 0) + 1;
    total += pointsOf(r.rank);
    if (isPlus(r.rank)) plus += 1;
    rankSum += r.rank;
  }
  const n = records.length;
  return {
    n,
    total,
    avg: n ? total / n : null,
    plusRate: n ? plus / n : null,
    winRate: n ? dist[0] / n : null,
    avgRank: n ? rankSum / n : null,
    dist,
  };
}

/** スナップショット 1 件から生存ターン数。必要な値が揃っていなければ null。 */
export function survivalOf(s: Pick<StatSnapshot, 'matches' | 'vpip' | 'hands'> | undefined): number | null {
  if (!s || s.vpip == null || s.hands == null) return null;
  if (!(s.matches > 0) || !(s.vpip > 0) || !(s.hands >= 0)) return null;
  return s.hands / (s.matches * (s.vpip / 100));
}

/** 生存ターン数を計算できるスナップショットのうち、date 以前で最新のもの。 */
export function latestSurvivalSnapshot(
  snapshots: readonly StatSnapshot[],
  memberId: string,
  onOrBefore?: string,
  onOrAfter?: string,
): StatSnapshot | undefined {
  let best: StatSnapshot | undefined;
  for (const s of snapshots) {
    if (s.memberId !== memberId || survivalOf(s) == null) continue;
    if (onOrBefore && s.date > onOrBefore) continue;
    if (onOrAfter && s.date < onOrAfter) continue;
    if (!best || s.date > best.date || (s.date === best.date && s.createdAt > best.createdAt)) best = s;
  }
  return best;
}

/** メンバーの最新スナップショット（値の欠けは問わない）。 */
export function latestSnapshot(snapshots: readonly StatSnapshot[], memberId: string): StatSnapshot | undefined {
  let best: StatSnapshot | undefined;
  for (const s of snapshots) {
    if (s.memberId !== memberId) continue;
    if (!best || s.date > best.date || (s.date === best.date && s.createdAt > best.createdAt)) best = s;
  }
  return best;
}

/** 表示する参加回数 = 登録時の値 + アプリでの記録件数。 */
export function matchCountOf(member: Member, records: readonly MatchRecord[]): number {
  let n = 0;
  for (const r of records) if (r.memberId === member.id) n += 1;
  return member.baseMatches + n;
}

/** 参加回数を手で直したとき、自動カウントと辻褄が合うように baseMatches を逆算する。 */
export function baseForCount(count: number, member: Member, records: readonly MatchRecord[]): number {
  return count - (matchCountOf(member, records) - member.baseMatches);
}

/**
 * 累積ポイントの推移。days の各日の「その日までの合計」。
 * upTo より後の日は null（まだ来ていない開催日に線を伸ばさない）。
 */
export function cumulativeSeries(
  records: readonly MatchRecord[],
  memberId: string,
  days: readonly string[],
  upTo: string,
): (number | null)[] {
  const byDay = new Map<string, number>();
  for (const r of records) {
    if (r.memberId !== memberId) continue;
    byDay.set(r.date, (byDay.get(r.date) ?? 0) + pointsOf(r.rank));
  }
  let acc = 0;
  return days.map((d) => {
    if (d > upTo) return null;
    acc += byDay.get(d) ?? 0;
    return acc;
  });
}

export function recordsInRange(records: readonly MatchRecord[], start: string, end: string): MatchRecord[] {
  return records.filter((r) => r.date >= start && r.date <= end);
}

export function fmtRate(v: number | null): string {
  return v == null ? '—' : `${(v * 100).toFixed(1)}%`;
}

export function fmtNum(v: number | null, digits = 2): string {
  return v == null ? '—' : v.toFixed(digits);
}
