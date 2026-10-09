/**
 * 永続化層（IndexedDB, ブラウザ専用）。依存ゼロ方針で生 IndexedDB を薄く Promise で包む。
 *
 * データは多くても数千件なので、起動時に全件読み込んで App の state に持ち、書き込みは都度ここへ通す。
 * records には memberId+date の一意索引を張り、二重記録を保存層でも弾く。
 * Node（Vitest）には IndexedDB が無いので、この層はブラウザ（preview）で確認する。純ロジックは domain/ 側。
 */

import type { AppData, MatchRecord, Member, SeasonOverride, StatSnapshot } from '../domain/model';

const DB_NAME = 'kagaribi-stat-hub';
const VERSION = 1;
const S = { members: 'members', records: 'records', snapshots: 'snapshots', seasons: 'seasons' } as const;
type StoreName = (typeof S)[keyof typeof S];
const ALL: StoreName[] = [S.members, S.records, S.snapshots, S.seasons];

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(t: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error ?? new Error('aborted'));
  });
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(S.members)) db.createObjectStore(S.members, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(S.records)) {
        const os = db.createObjectStore(S.records, { keyPath: 'id' });
        os.createIndex('memberDate', ['memberId', 'date'], { unique: true });
        os.createIndex('date', 'date', { unique: false });
      }
      if (!db.objectStoreNames.contains(S.snapshots)) {
        const os = db.createObjectStore(S.snapshots, { keyPath: 'id' });
        os.createIndex('memberId', 'memberId', { unique: false });
      }
      if (!db.objectStoreNames.contains(S.seasons)) db.createObjectStore(S.seasons, { keyPath: 'no' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

async function write(stores: StoreName[], fn: (t: IDBTransaction) => void): Promise<void> {
  const db = await openDb();
  const t = db.transaction(stores, 'readwrite');
  fn(t);
  await done(t);
}

export async function loadAll(): Promise<AppData> {
  const db = await openDb();
  const t = db.transaction(ALL, 'readonly');
  const [members, records, snapshots, seasons] = await Promise.all([
    reqToPromise(t.objectStore(S.members).getAll()) as Promise<Member[]>,
    reqToPromise(t.objectStore(S.records).getAll()) as Promise<MatchRecord[]>,
    reqToPromise(t.objectStore(S.snapshots).getAll()) as Promise<StatSnapshot[]>,
    reqToPromise(t.objectStore(S.seasons).getAll()) as Promise<SeasonOverride[]>,
  ]);
  return { members: members.sort((a, b) => a.order - b.order), records, snapshots, seasons };
}

export function putMember(m: Member): Promise<void> {
  return write([S.members], (t) => t.objectStore(S.members).put(m));
}

/** メンバーを完全に削除する（記録・スタッツも消す）。 */
export async function purgeMember(id: string, records: readonly MatchRecord[], snapshots: readonly StatSnapshot[]): Promise<void> {
  await write([S.members, S.records, S.snapshots], (t) => {
    t.objectStore(S.members).delete(id);
    for (const r of records) if (r.memberId === id) t.objectStore(S.records).delete(r.id);
    for (const s of snapshots) if (s.memberId === id) t.objectStore(S.snapshots).delete(s.id);
  });
}

/** 1日ぶんの保存（追加・修正・削除）を 1 トランザクションで。一意索引に触れたら全体が取り消される。 */
export function applyRecords(puts: readonly MatchRecord[], deletes: readonly MatchRecord[]): Promise<void> {
  return write([S.records], (t) => {
    const os = t.objectStore(S.records);
    for (const r of deletes) os.delete(r.id);
    for (const r of puts) os.put(r);
  });
}

export function putSnapshot(s: StatSnapshot): Promise<void> {
  return write([S.snapshots], (t) => t.objectStore(S.snapshots).put(s));
}

export function deleteSnapshot(id: string): Promise<void> {
  return write([S.snapshots], (t) => t.objectStore(S.snapshots).delete(id));
}

/** シーズンの手動修正を保存。null なら修正を消す（自動判定へ戻す）。 */
export function saveSeason(no: number, o: SeasonOverride | null): Promise<void> {
  return write([S.seasons], (t) => {
    if (o) t.objectStore(S.seasons).put(o);
    else t.objectStore(S.seasons).delete(no);
  });
}

/** バックアップからの全置き換え。 */
export function replaceAll(data: AppData): Promise<void> {
  return write(ALL, (t) => {
    for (const s of ALL) t.objectStore(s).clear();
    for (const m of data.members) t.objectStore(S.members).put(m);
    for (const r of data.records) t.objectStore(S.records).put(r);
    for (const s of data.snapshots) t.objectStore(S.snapshots).put(s);
    for (const o of data.seasons) t.objectStore(S.seasons).put(o);
  });
}
