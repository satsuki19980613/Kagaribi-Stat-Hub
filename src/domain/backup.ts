/**
 * バックアップ（JSON の書き出し・読み込み）。記録は端末のブラウザにしか無いので、
 * 機種変更やブラウザのデータ消去に備えて書き出せるようにする。読み込みは全置き換え。
 */

import { isIsoDate } from './date';
import type { AppData, MatchRecord, Member, SeasonOverride, StatSnapshot } from './model';
import { isRank } from './points';

export const BACKUP_APP = 'kagaribi-stat-hub';
export const BACKUP_VERSION = 1;

export interface BackupFile extends AppData {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
}

export function toBackup(data: AppData, now: Date = new Date()): BackupFile {
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now.toISOString(), ...data };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const optNum = (v: unknown): boolean => v === undefined || isNum(v);

function member(v: unknown): Member | null {
  if (!isObj(v) || !isStr(v.id) || typeof v.name !== 'string' || typeof v.archived !== 'boolean') return null;
  if (!isNum(v.order) || !isNum(v.createdAt) || !isNum(v.baseMatches) || !optNum(v.archivedAt)) return null;
  return v as unknown as Member;
}

function record(v: unknown): MatchRecord | null {
  if (!isObj(v) || !isStr(v.id) || !isStr(v.memberId) || !isIsoDate(v.date) || !isRank(v.rank)) return null;
  if (!(v.part === undefined || v.part === 1 || v.part === 2) || !isNum(v.createdAt) || !isNum(v.updatedAt)) return null;
  return v as unknown as MatchRecord;
}

function snapshot(v: unknown): StatSnapshot | null {
  if (!isObj(v) || !isStr(v.id) || !isStr(v.memberId) || !isIsoDate(v.date) || !isNum(v.matches) || !isNum(v.createdAt)) return null;
  if (!optNum(v.wins) || !optNum(v.vpip) || !optNum(v.hands)) return null;
  return v as unknown as StatSnapshot;
}

function season(v: unknown): SeasonOverride | null {
  if (!isObj(v) || !isNum(v.no) || !isIsoDate(v.start) || !isIsoDate(v.end) || !Array.isArray(v.toggled)) return null;
  if (!v.toggled.every((d) => isIsoDate(d))) return null;
  return v as unknown as SeasonOverride;
}

function all<T>(list: unknown, parse: (v: unknown) => T | null, label: string): T[] {
  if (!Array.isArray(list)) throw new Error(`${label} がありません。`);
  return list.map((v, i) => {
    const r = parse(v);
    if (!r) throw new Error(`${label} の ${i + 1} 件目が読み取れません。`);
    return r;
  });
}

/** 読み込んだ JSON を検証して AppData にする。壊れていれば理由つきで throw。 */
export function parseBackup(json: unknown): AppData {
  if (!isObj(json) || json.app !== BACKUP_APP) throw new Error('Kagaribi Stat Hub のバックアップではありません。');
  if (!isNum(json.version) || json.version > BACKUP_VERSION) throw new Error('新しい版のアプリで書き出されたファイルです。アプリを更新してください。');
  const data: AppData = {
    members: all(json.members, member, 'メンバー'),
    records: all(json.records, record, '記録'),
    snapshots: all(json.snapshots, snapshot, 'スタッツ'),
    seasons: all(json.seasons, season, 'シーズン設定'),
  };
  const ids = new Set(data.members.map((m) => m.id));
  if (data.records.some((r) => !ids.has(r.memberId)) || data.snapshots.some((s) => !ids.has(s.memberId))) {
    throw new Error('存在しないメンバーの記録が含まれています。');
  }
  const keys = new Set<string>();
  for (const r of data.records) {
    const k = `${r.memberId}|${r.date}`;
    if (keys.has(k)) throw new Error('同じメンバー・同じ日の記録が重複しています。');
    keys.add(k);
  }
  return data;
}
