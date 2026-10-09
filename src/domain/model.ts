/**
 * データモデル。すべて端末内（IndexedDB）に保存し、JSON でバックアップできる形にしておく。
 * 日付はすべて端末のローカル日付の 'YYYY-MM-DD'（クラブマッチは 23:59 までで日付をまたがない）。
 */

/** クラブマッチの順位（6人卓）。 */
export type Rank = 1 | 2 | 3 | 4 | 5 | 6;
/** 1部（11:00〜13:59）／2部（21:00〜23:59）。 */
export type Part = 1 | 2;

export interface Member {
  id: string;
  name: string;
  /** 脱退などで外したメンバー。履歴は残し、記録画面の選択肢からは外す。 */
  archived: boolean;
  /** 並び順（登録順）。 */
  order: number;
  createdAt: number;
  archivedAt?: number;
  /**
   * アプリで記録する前からのクラブマッチ参加回数。
   * 表示する参加回数 = baseMatches + このアプリでの記録件数（自動カウント）。
   */
  baseMatches: number;
}

/** 1人・1日ぶんのクラブマッチ結果（1日1回までなので memberId+date で一意）。 */
export interface MatchRecord {
  id: string;
  memberId: string;
  date: string;
  rank: Rank;
  part?: Part;
  createdAt: number;
  updatedAt: number;
}

/**
 * ゲーム内のクラブ用スタッツ画面の値（任意入力）。入力した日の値として残す。
 * 生存ターン数はこのスナップショットの値だけで計算する（自動カウントの参加回数は混ぜない）。
 */
export interface StatSnapshot {
  id: string;
  memberId: string;
  date: string;
  /** その時点の参加回数。 */
  matches: number;
  wins?: number;
  /** VPIP [%]。 */
  vpip?: number;
  /** 参加ハンド数（VPIP したハンド数）。 */
  hands?: number;
  createdAt: number;
}

/** シーズン期間の手動修正（自動判定＝暦月からのずれを直す）。 */
export interface SeasonOverride {
  no: number;
  start: string;
  end: string;
  /** 既定の開催日（火・木・土）から外した日／足した日。 */
  toggled: string[];
}

export interface AppData {
  members: Member[];
  records: MatchRecord[];
  snapshots: StatSnapshot[];
  seasons: SeasonOverride[];
}

export const MAX_ACTIVE_MEMBERS = 20;

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
