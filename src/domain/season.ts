/**
 * クラブマッチのシーズン。
 *
 * 公式シーズンはほぼ「月初の開催日〜月末」なので、既定は暦月で自動判定する
 * （S31 = 2026年10月、以降 1 か月ごとに +1。S31 だけ公式の開始日 10/3 から）。
 * 急な短縮・延長・休催があったときのために、シーズンごとに期間と開催日を手動で直せる
 * （SeasonOverride）。直した期間はその前後のシーズンと重ならないことを検証する。
 */

import { daysInMonth, eachDay, isIsoDate, isoOf, parseIso, weekdayOf } from './date';
import type { SeasonOverride } from './model';

export const FIRST_SEASON = 31;
export const FIRST_SEASON_START = '2026-10-03';
/** S31 の暦月（2026年10月）を月通し番号で。 */
const FIRST_MONTH = 2026 * 12 + 9;
/** 開催曜日（火・木・土）。 */
export const MATCH_WEEKDAYS: readonly number[] = [2, 4, 6];

export interface SeasonRange {
  no: number;
  start: string;
  end: string;
}

function monthIndexOf(date: string): number {
  const { y, m } = parseIso(date);
  return y * 12 + (m - 1);
}

/** 既定（暦月）の期間。 */
export function defaultSeasonRange(no: number): SeasonRange {
  const mi = FIRST_MONTH + (no - FIRST_SEASON);
  const y = Math.floor(mi / 12);
  const m = (mi % 12) + 1;
  const start = no === FIRST_SEASON ? FIRST_SEASON_START : isoOf(y, m, 1);
  return { no, start, end: isoOf(y, m, daysInMonth(y, m)) };
}

export function overrideOf(no: number, overrides: readonly SeasonOverride[]): SeasonOverride | undefined {
  return overrides.find((o) => o.no === no);
}

/** 手動修正を反映した期間。 */
export function seasonRange(no: number, overrides: readonly SeasonOverride[]): SeasonRange {
  const o = overrideOf(no, overrides);
  return o ? { no, start: o.start, end: o.end } : defaultSeasonRange(no);
}

/** 日付が属するシーズン。どのシーズンにも入らない（S31 より前・修正で空いた隙間）なら null。 */
export function seasonOf(date: string, overrides: readonly SeasonOverride[]): number | null {
  const n0 = FIRST_SEASON + (monthIndexOf(date) - FIRST_MONTH);
  for (const no of [n0, n0 - 1, n0 + 1]) {
    if (no < FIRST_SEASON) continue;
    const r = seasonRange(no, overrides);
    if (r.start <= date && date <= r.end) return no;
  }
  return null;
}

/** 既定で開催日か（火・木・土）。 */
export function isDefaultMatchDay(date: string): boolean {
  return MATCH_WEEKDAYS.includes(weekdayOf(date));
}

/** シーズンの開催日（期間内の火・木・土に、手動の休催／追加開催を反映）。 */
export function matchDays(no: number, overrides: readonly SeasonOverride[]): string[] {
  const r = seasonRange(no, overrides);
  const toggled = new Set(overrideOf(no, overrides)?.toggled ?? []);
  return eachDay(r.start, r.end).filter((d) => isDefaultMatchDay(d) !== toggled.has(d));
}

export function isMatchDay(date: string, overrides: readonly SeasonOverride[]): boolean {
  const no = seasonOf(date, overrides);
  if (no == null) return false;
  const toggled = overrideOf(no, overrides)?.toggled ?? [];
  return isDefaultMatchDay(date) !== toggled.includes(date);
}

/** 表示するシーズンの一覧（S31 〜 今日と記録のある最新シーズン）。新しい順。 */
export function seasonList(today: string, recordDates: readonly string[], overrides: readonly SeasonOverride[]): number[] {
  let max = FIRST_SEASON;
  for (const d of [today, ...recordDates]) {
    const no = seasonOf(d, overrides) ?? FIRST_SEASON + (monthIndexOf(d) - FIRST_MONTH);
    if (no > max) max = no;
  }
  const out: number[] = [];
  for (let no = max; no >= FIRST_SEASON; no -= 1) out.push(no);
  return out;
}

/** 今日のシーズン。期間の隙間なら直前のシーズン。 */
export function currentSeason(today: string, overrides: readonly SeasonOverride[]): number {
  const no = seasonOf(today, overrides);
  if (no != null) return no;
  const guess = FIRST_SEASON + (monthIndexOf(today) - FIRST_MONTH);
  for (let n = guess; n >= FIRST_SEASON; n -= 1) {
    if (seasonRange(n, overrides).end < today) return n;
  }
  return FIRST_SEASON;
}

/**
 * 期間の手動修正を検証する。問題が無ければ空配列。
 * - 開始 ≦ 終了
 * - 既定の暦月から前後 1 か月の範囲内（自動判定が探しに行ける範囲）
 * - 前後のシーズンと重ならない
 */
export function validateSeasonEdit(edit: SeasonOverride, overrides: readonly SeasonOverride[]): string[] {
  const issues: string[] = [];
  if (!isIsoDate(edit.start) || !isIsoDate(edit.end)) return ['日付の形式が正しくありません。'];
  if (edit.start > edit.end) issues.push('開始日が終了日より後になっています。');
  if (edit.start < defaultSeasonRange(edit.no - 1).start) issues.push('開始日が前の月より前になっています。');
  if (edit.end > defaultSeasonRange(edit.no + 1).end) issues.push('終了日が次の月より後になっています。');
  const others = overrides.filter((o) => o.no !== edit.no);
  if (edit.no > FIRST_SEASON) {
    const prev = seasonRange(edit.no - 1, others);
    if (edit.start <= prev.end) issues.push(`S${edit.no - 1}（〜${prev.end.slice(5).replace('-', '/')}）と期間が重なっています。`);
  }
  const next = seasonRange(edit.no + 1, others);
  if (edit.end >= next.start) issues.push(`S${edit.no + 1}（${next.start.slice(5).replace('-', '/')}〜）と期間が重なっています。`);
  return issues;
}

/** 期間の外に出た休催／追加開催の指定を落とす。既定と同じなら null（＝修正を消す）。 */
export function normalizeOverride(edit: SeasonOverride): SeasonOverride | null {
  const toggled = [...new Set(edit.toggled)].filter((d) => d >= edit.start && d <= edit.end).sort();
  const base = defaultSeasonRange(edit.no);
  if (edit.start === base.start && edit.end === base.end && toggled.length === 0) return null;
  return { no: edit.no, start: edit.start, end: edit.end, toggled };
}
