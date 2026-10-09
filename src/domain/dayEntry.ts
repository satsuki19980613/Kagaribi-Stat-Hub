/**
 * 記録画面（1日ぶんの入力）の下書きと保存計画。
 *
 * 1人 1日 1件（クラブマッチは 1日 1回まで）なので、記録画面は「その日の記録を開いて直す」画面を兼ねる。
 * 既に記録がある人は下書きに読み込み、順位を変えれば修正、外せば削除、新しく付ければ追加になる。
 * 二重記録はこの形そのもので起きない（memberId+date を鍵に 1 件へまとめる）。
 */

import type { MatchRecord, Part, Rank } from './model';
import { newId } from './model';

export interface DraftRow {
  rank: Rank | null;
  part: Part | null;
}

export type Draft = Record<string, DraftRow>;

export function draftFromRecords(records: readonly MatchRecord[], date: string): Draft {
  const d: Draft = {};
  for (const r of records) if (r.date === date) d[r.memberId] = { rank: r.rank, part: r.part ?? null };
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
