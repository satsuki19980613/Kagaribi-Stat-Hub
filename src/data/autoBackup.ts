/**
 * 自動バックアップ（ブラウザ専用のグルー）。データを変えるたびに App から呼ばれる。
 *
 * 1. 端末内の履歴: 全体のコピーを IndexedDB の backups に残す（残し方は domain/autoBackup.ts）。
 *    操作ミス（消しすぎ・上書き）からはここで戻せる。どのブラウザでも動く。
 * 2. ファイルへの自動保存: PC の Chrome / Edge では、一度選んだ JSON ファイルへ毎回書き出す
 *    （File System Access API）。ブラウザのデータが消えても、このファイルから読み込めば戻る。
 *    ファイルの扱い（handle）は meta に残すが、書き込みの許可はブラウザを開き直すたびに 1 タップで出し直す必要がある。
 * 3. 保存領域の保護: navigator.storage.persist() で、容量不足時にブラウザが勝手に消さないよう頼む。
 */

import { hashData, planBackup, type BackupEntry } from '../domain/autoBackup';
import { toBackup } from '../domain/backup';
import type { AppData } from '../domain/model';
import { getMeta, listBackups, setMeta, writeBackup } from './store';

// File System Access API（TypeScript の DOM 型にまだ無い部分）。
interface FsPermissionHandle {
  queryPermission?(o: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission?(o: { mode: 'readwrite' }): Promise<PermissionState>;
}
type FileHandle = FileSystemFileHandle & FsPermissionHandle;
type SavePicker = (o: {
  suggestedName?: string;
  types?: { description: string; accept: Record<string, string[]> }[];
}) => Promise<FileHandle>;

const FILE_KEY = 'autoFile';
const FILE_AT_KEY = 'autoFileAt';

export type FileState = 'unsupported' | 'off' | 'needs-permission' | 'on' | 'error';

export interface FileStatus {
  state: FileState;
  name?: string;
  lastAt?: number;
  error?: string;
}

function picker(): SavePicker | null {
  const w = window as unknown as { showSaveFilePicker?: SavePicker; self?: unknown; top?: unknown };
  // 埋め込み表示（iframe）では使えないことが多いので、トップレベルのときだけ使う。
  if (typeof w.showSaveFilePicker !== 'function' || window.self !== window.top) return null;
  return w.showSaveFilePicker.bind(window);
}

export function fileSupported(): boolean {
  return picker() != null;
}

/** 端末内の履歴にコピーを残す。内容が変わっていなければ何もしない。 */
export async function snapshot(data: AppData, now = Date.now()): Promise<void> {
  const hash = hashData(data);
  const list = await listBackups();
  const plan = planBackup(list, hash, now);
  if (plan.action === 'skip') return;
  const entry: BackupEntry = {
    id: now,
    at: now,
    hash,
    members: data.members.length,
    records: data.records.length,
    data,
  };
  await writeBackup(entry, plan.deleteIds);
}

export async function fileStatus(): Promise<FileStatus> {
  if (!fileSupported()) return { state: 'unsupported' };
  const h = await getMeta<FileHandle>(FILE_KEY);
  if (!h) return { state: 'off' };
  const lastAt = await getMeta<number>(FILE_AT_KEY);
  const perm = (await h.queryPermission?.({ mode: 'readwrite' })) ?? 'granted';
  return { state: perm === 'granted' ? 'on' : 'needs-permission', name: h.name, lastAt };
}

async function writeTo(h: FileHandle, data: AppData): Promise<void> {
  const w = await h.createWritable();
  await w.write(JSON.stringify(toBackup(data), null, 1));
  await w.close();
  await setMeta(FILE_AT_KEY, Date.now());
}

/** 許可済みならファイルへ書き出す。許可が無い・未設定なら何もしない。 */
export async function writeFileIfOn(data: AppData): Promise<FileStatus> {
  const st = await fileStatus();
  if (st.state !== 'on') return st;
  const h = (await getMeta<FileHandle>(FILE_KEY))!;
  try {
    await writeTo(h, data);
    return await fileStatus();
  } catch (e) {
    return { ...st, state: 'error', error: e instanceof Error ? e.message : String(e) };
  }
}

/** 保存先のファイルを選び、すぐ 1 回書き出す（クリック操作の中で呼ぶ）。キャンセルなら false。 */
export async function chooseFile(data: AppData): Promise<boolean> {
  const pick = picker();
  if (!pick) return false;
  let h: FileHandle;
  try {
    h = await pick({
      suggestedName: 'kagaribi-stat-hub-backup.json',
      types: [{ description: 'Kagaribi Stat Hub バックアップ', accept: { 'application/json': ['.json'] } }],
    });
  } catch {
    return false;
  }
  await setMeta(FILE_KEY, h);
  await writeTo(h, data);
  return true;
}

/** ブラウザを開き直したあとの書き込み許可（クリック操作の中で呼ぶ）。 */
export async function resumeFile(data: AppData): Promise<boolean> {
  const h = await getMeta<FileHandle>(FILE_KEY);
  if (!h) return false;
  const perm = (await h.requestPermission?.({ mode: 'readwrite' })) ?? 'granted';
  if (perm !== 'granted') return false;
  await writeTo(h, data);
  return true;
}

export async function stopFile(): Promise<void> {
  await setMeta(FILE_KEY, undefined);
  await setMeta(FILE_AT_KEY, undefined);
}

/** 保存領域の保護を頼む。結果（保護されているか）を返す。使えない環境では null。 */
export async function requestPersist(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}
