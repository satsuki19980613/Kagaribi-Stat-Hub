/**
 * 記録画面（1日ぶんの入力）の下書きと保存計画。
 *
 * 1人 1日 1件（クラブマッチは 1日 1回まで）なので、記録画面は「その日の記録を開いて直す」画面を兼ねる。
 * 既に記録がある人は下書きに読み込み、順位を変えれば修正、外せば削除、新しく付ければ追加になる。
 * 二重記録はこの形そのもので起きない（memberId+date を鍵に 1 件へまとめる）。
 *
 * 参加した人には、その日のスタッツ（優勝回数・VPIP・参加ハンド数、任意）も入れられる。
 * その日の日付のスナップショットとして残し、参加回数はその日までの自動カウントを使う。
 */

import type { MatchRecord, Member, Part, Rank, StatSnapshot } from './model';
import { newId } from './model';
import { EMPTY_STAT_TEXT, isBlankStat, parseStatText, type StatText, type StatValues } from './statInput';

export interface DraftRow {
  rank: Rank | null;
  part: Part | null;
  /** 任意のスタッツ入力（開いていなければ undefined）。 */
  stats?: StatText;
}

export type Draft = Record<string, DraftRow>;

/** その日のスナップショット（同じ日に複数あれば最後のもの）。 */
export function snapshotOn(snapshots: readonly StatSnapshot[], memberId: string, date: string): StatSnapshot | undefined {
  let best: StatSnapshot | undefined;
  for (const s of snapshots) if (s.memberId === memberId && s.date === date && (!best || s.createdAt > best.createdAt)) best = s;
  return best;
}

export function statTextOf(s: StatValues | undefined): StatText {
  if (!s) return { ...EMPTY_STAT_TEXT };
  return { wins: s.wins != null ? String(s.wins) : '', vpip: s.vpip != null ? String(s.vpip) : '', hands: s.hands != null ? String(s.hands) : '' };
}

export function draftFromRecords(records: readonly MatchRecord[], date: string, snapshots: readonly StatSnapshot[] = []): Draft {
  const d: Draft = {};
  for (const r of records) {
    if (r.date !== date) continue;
    const snap = snapshotOn(snapshots, r.memberId, date);
    d[r.memberId] = { rank: r.rank, part: r.part ?? null, ...(snap ? { stats: statTextOf(snap) } : {}) };
  }
  return d;
}

export interface SavePlan {
  puts: MatchRecord[];
  deletes: MatchRecord[];
  added: number;
  updated: number;
}

export function planSave(records: readonly MatchRecord[], date: string, draft: Draft, now: number = Date.now()): SavePlan {
  const existing = new Map<string, MatchRecord>();
  for (const r of records) if (r.date === date) existing.set(r.memberId, r);
  const plan: SavePlan = { puts: [], deletes: [], added: 0, updated: 0 };
  const ids = new Set([...existing.keys(), ...Object.keys(draft)]);
  for (const memberId of ids) {
    const row = draft[memberId];
    const cur = existing.get(memberId);
    if (!row || row.rank == null) {
      if (cur) plan.deletes.push(cur);
      continue;
    }
    const part = row.part ?? undefined;
    if (!cur) {
      plan.puts.push({ id: newId(), memberId, date, rank: row.rank, ...(part ? { part } : {}), createdAt: now, updatedAt: now });
      plan.added += 1;
    } else if (cur.rank !== row.rank || cur.part !== part) {
      const { part: _old, ...rest } = cur;
      plan.puts.push({ ...rest, rank: row.rank, ...(part ? { part } : {}), updatedAt: now });
      plan.updated += 1;
    }
  }
  return plan;
}

export function planIsEmpty(p: SavePlan): boolean {
  return p.puts.length === 0 && p.deletes.length === 0;
}

/** その日の試合を終えた時点の参加回数（登録時の値 + その日より前の記録 + その日に参加したなら 1）。 */
export function matchesOnDay(member: Member, records: readonly MatchRecord[], date: string, playedToday: boolean): number {
  let n = member.baseMatches;
  for (const r of records) if (r.memberId === member.id && r.date < date) n += 1;
  return n + (playedToday ? 1 : 0);
}

export interface StatPlan {
  puts: StatSnapshot[];
  deletes: StatSnapshot[];
  /** 入力に問題がある人（memberId → 理由）。1 人でもいれば保存しない。 */
  issues: Record<string, string[]>;
}

const sameStats = (a: StatValues, b: StatValues): boolean => a.wins === b.wins && a.vpip === b.vpip && a.hands === b.hands;

/**
 * その日のスタッツの保存計画。順位を付けた（参加した）人の入力だけを見る。
 * - 入力が既存のその日のスナップショットと同じなら何もしない
 * - 空にしたら、その日のスナップショットを消す
 * - それ以外はその日のスナップショットとして保存（参加回数はその日までの自動カウント）
 */
export function planStats(
  members: readonly Member[],
  records: readonly MatchRecord[],
  snapshots: readonly StatSnapshot[],
  date: string,
  draft: Draft,
  now: number = Date.now(),
): StatPlan {
  const plan: StatPlan = { puts: [], deletes: [], issues: {} };
  for (const [memberId, row] of Object.entries(draft)) {
    if (row.rank == null || !row.stats) continue;
    const member = members.find((m) => m.id === memberId);
    if (!member) continue;
    const cur = snapshotOn(snapshots, memberId, date);
    if (isBlankStat(row.stats)) {
      if (cur) plan.deletes.push(cur);
      continue;
    }
    const matches = matchesOnDay(member, records, date, true);
    const { values, issues } = parseStatText(row.stats, matches);
    if (issues.length) {
      plan.issues[memberId] = issues;
      continue;
    }
    if (!values || (cur && sameStats(values, cur))) continue;
    plan.puts.push({ id: cur?.id ?? newId(), memberId, date, matches, ...values, createdAt: cur?.createdAt ?? now });
  }
  return plan;
}

export interface DayPlan {
  rec: SavePlan;
  stats: StatPlan;
  /** 保存するものがあるか。 */
  dirty: boolean;
  /** 入力に問題があって保存できないか。 */
  blocked: boolean;
}

/** 記録画面の保存計画（記録 + 任意のスタッツ）。 */
export function planDay(
  data: { members: readonly Member[]; records: readonly MatchRecord[]; snapshots: readonly StatSnapshot[] },
  date: string,
  draft: Draft,
  now: number = Date.now(),
): DayPlan {
  const rec = planSave(data.records, date, draft, now);
  const stats = planStats(data.members, data.records, data.snapshots, date, draft, now);
  return {
    rec,
    stats,
    dirty: !planIsEmpty(rec) || stats.puts.length > 0 || stats.deletes.length > 0,
    blocked: Object.keys(stats.issues).length > 0,
  };
}
