/**
 * 自動バックアップ（端末内の履歴）の残し方。
 *
 * データを変えるたびに、変えたあとの全体のコピーを 1 件残す（内容が直前と同じなら残さない）。
 * 1 つ前のコピーに戻せば、直前の操作（消しすぎ・上書き）を取り消せる。
 * 増えすぎないよう、直近 RECENT 件はすべて、それより古いものは 1 日 1 件（その日の最後）を DAYS 日ぶん残す。
 */

import type { AppData } from './model';

export const RECENT = 30;
export const DAYS = 60;

export interface BackupMeta {
  id: number;
  at: number;
  /** 内容の指紋（同じなら残さない）。 */
  hash: string;
  members: number;
  records: number;
}

export interface BackupEntry extends BackupMeta {
  data: AppData;
}

export type BackupPlan = { action: 'skip' } | { action: 'add'; deleteIds: number[] };

function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** 新しい 1 件（at = now）を足したあとに消すものを決める。 */
export function planBackup(existing: readonly BackupMeta[], hash: string, now: number): BackupPlan {
  const sorted = [...existing].sort((a, b) => b.at - a.at);
  if (sorted[0]?.hash === hash) return { action: 'skip' };
  // 新しい 1 件が直近枠の先頭に入るので、既存は RECENT - 1 件まで直近扱い。
  const older = sorted.slice(RECENT - 1);
  const seen = new Set<string>([dayKey(now), ...sorted.slice(0, RECENT - 1).map((b) => dayKey(b.at))]);
  const deleteIds: number[] = [];
  let days = seen.size;
  for (const b of older) {
    const k = dayKey(b.at);
    if (seen.has(k) || days >= DAYS) deleteIds.push(b.id);
    else {
      seen.add(k);
      days += 1;
    }
  }
  return { action: 'add', deleteIds };
}

/** 内容の指紋（FNV-1a 32bit）。並び順に左右されないよう id で並べてから計る。 */
export function hashData(data: AppData): string {
  const byId = <T extends { id: string }>(a: readonly T[]): T[] => [...a].sort((x, y) => (x.id < y.id ? -1 : 1));
  const s = JSON.stringify([
    byId(data.members),
    byId(data.records),
    byId(data.snapshots),
    [...data.seasons].sort((a, b) => a.no - b.no),
  ]);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
