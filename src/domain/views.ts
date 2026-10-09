/**
 * スタッツビューが使う表・グラフの元データ（純関数）。
 */

import { parseIso } from './date';
import type { AppData, Member } from './model';
import { matchDays, seasonOf, seasonRange } from './season';
import { cumulativeSeries, latestSurvivalSnapshot, recordsInRange, summarize, survivalOf, type Summary } from './stats';

export interface MemberSeasonRow {
  member: Member;
  sum: Summary;
  /** シーズン末時点の生存ターン数。 */
  survival: number | null;
  /** そのスナップショットの日付。シーズンより前の値なら stale。 */
  survivalDate: string | null;
  survivalStale: boolean;
}

/** シーズンの表に出すメンバー: 有効メンバー全員 + そのシーズンに記録のあるアーカイブ済みメンバー。 */
export function seasonRows(data: AppData, no: number): MemberSeasonRow[] {
  const r = seasonRange(no, data.seasons);
  const recs = recordsInRange(data.records, r.start, r.end);
  const played = new Set(recs.map((x) => x.memberId));
  return data.members
    .filter((m) => !m.archived || played.has(m.id))
    .map((m) => {
      const snap = latestSurvivalSnapshot(data.snapshots, m.id, r.end);
      return {
        member: m,
        sum: summarize(recs.filter((x) => x.memberId === m.id)),
        survival: survivalOf(snap),
        survivalDate: snap?.date ?? null,
        survivalStale: !!snap && snap.date < r.start,
      };
    });
}

/** M/D */
export function md(date: string): string {
  const { m, d } = parseIso(date);
  return `${m}/${d}`;
}

/**
 * シーズン内の X 軸: 開催日 + 開催日以外に記録がある日。
 */
export function seasonAxis(data: AppData, no: number): string[] {
  const r = seasonRange(no, data.seasons);
  const days = new Set(matchDays(no, data.seasons));
  for (const x of recordsInRange(data.records, r.start, r.end)) days.add(x.date);
  return [...days].sort();
}

/** 累積ポイントの推移（今日より先は伸ばさない）。 */
export function seasonCumulative(data: AppData, no: number, memberId: string, today: string): (number | null)[] {
  const r = seasonRange(no, data.seasons);
  return cumulativeSeries(recordsInRange(data.records, r.start, r.end), memberId, seasonAxis(data, no), today < r.end ? today : r.end);
}

export type TrendMetric = 'total' | 'avg' | 'plusRate' | 'winRate' | 'avgRank' | 'survival';

export const TREND_METRICS: { key: TrendMetric; label: string; unit: string }[] = [
  { key: 'total', label: '合計ポイント', unit: 'pt' },
  { key: 'avg', label: '平均ポイント', unit: 'pt' },
  { key: 'plusRate', label: '加点率', unit: '%' },
  { key: 'winRate', label: '1位率', unit: '%' },
  { key: 'avgRank', label: '平均順位', unit: '位' },
  { key: 'survival', label: '生存ターン数', unit: 'ターン' },
];

/**
 * シーズンごとの指標。参加 0 のシーズンは null（線を切る）。
 * 生存ターン数はそのシーズン中に入力したスナップショットの最新値（入力が無いシーズンは null）。
 */
export function trendValue(data: AppData, no: number, memberId: string, metric: TrendMetric): number | null {
  const r = seasonRange(no, data.seasons);
  if (metric === 'survival') return survivalOf(latestSurvivalSnapshot(data.snapshots, memberId, r.end, r.start));
  const s = summarize(recordsInRange(data.records, r.start, r.end).filter((x) => x.memberId === memberId));
  if (s.n === 0) return null;
  switch (metric) {
    case 'total':
      return s.total;
    case 'avg':
      return s.avg;
    case 'plusRate':
      return s.plusRate == null ? null : s.plusRate * 100;
    case 'winRate':
      return s.winRate == null ? null : s.winRate * 100;
    case 'avgRank':
      return s.avgRank;
  }
}

export function clubTotal(data: AppData, no: number): number {
  const r = seasonRange(no, data.seasons);
  return summarize(recordsInRange(data.records, r.start, r.end)).total;
}

/** メンバーが記録を持つシーズン（古い順）。 */
export function seasonsOfMember(data: AppData, memberId: string): number[] {
  const set = new Set<number>();
  for (const r of data.records) {
    if (r.memberId !== memberId) continue;
    const no = seasonOf(r.date, data.seasons);
    if (no != null) set.add(no);
  }
  return [...set].sort((a, b) => a - b);
}

/** 値の平均（null は除く。全部 null なら null）。 */
function meanOf(vs: readonly (number | null)[]): number | null {
  const xs = vs.filter((v): v is number => v != null);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

/**
 * 累積ポイントのメンバー平均（その日までのクラブ合計 ÷ そのシーズンに 1 回以上参加したメンバー数）。
 * 参加者がいなければ空配列。
 */
export function seasonAverage(data: AppData, no: number, today: string): (number | null)[] {
  const ids = seasonRows(data, no)
    .filter((r) => r.sum.n > 0)
    .map((r) => r.member.id);
  if (ids.length === 0) return [];
  const series = ids.map((id) => seasonCumulative(data, no, id, today));
  return seasonAxis(data, no).map((_, i) => {
    const vs = series.map((s) => s[i] ?? null);
    return vs.every((v) => v == null) ? null : meanOf(vs.map((v) => v ?? 0));
  });
}

/** シーズン推移のメンバー平均（そのシーズンに値のあるメンバーの平均）。 */
export function trendAverage(data: AppData, seasons: readonly number[], memberIds: readonly string[], metric: TrendMetric): (number | null)[] {
  return seasons.map((no) => meanOf(memberIds.map((id) => trendValue(data, no, id, metric))));
}

/**
 * クラブ順位のグラフの X 軸の長さ: 取り込んだ節の最後と、今日までの開催日の数の大きい方（開催日の数を超えない）。
 */
export function clubAxisLength(data: AppData, no: number, today: string, lastRound: number): number {
  const days = matchDays(no, data.seasons);
  const held = days.filter((d) => d <= today).length;
  return Math.min(Math.max(held, lastRound), Math.max(days.length, lastRound));
}

/** 第 1〜n 節の X 軸の名前（N 番目の開催日。開催日が足りなければ「第N節」）。 */
export function clubAxisLabels(data: AppData, no: number, n: number): string[] {
  const days = matchDays(no, data.seasons);
  return Array.from({ length: n }, (_, i) => {
    const d = days[i];
    return d ? md(d) : `第${i + 1}節`;
  });
}

/** 第 1〜n 節時点のアプリの記録の合計（クラブの累計。今日より先は null）。 */
export function clubAppTotals(data: AppData, no: number, n: number, today: string): (number | null)[] {
  const r = seasonRange(no, data.seasons);
  const days = matchDays(no, data.seasons);
  const recs = recordsInRange(data.records, r.start, r.end);
  return Array.from({ length: n }, (_, i) => {
    const d = days[i];
    if (!d || d > today) return null;
    return summarize(recs.filter((x) => x.date <= d)).total;
  });
}
