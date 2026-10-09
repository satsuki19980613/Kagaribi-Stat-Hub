/**
 * クラブ順位（上位 30）の取り込み。アプリと一緒に配る data/clubs.json（リポジトリの public/data/clubs.json）を、
 * ネットにつながったときに読む。main に入るとアプリと一緒に配り直されるので、次に開いたときに新しい順位が届く。
 * 読めたものは端末（meta）に残すので、オフラインでも前回の内容を出せる。
 * デモ版はネットを使わず、サンプルを出す。
 */

import { DEMO } from '../clock';
import { parseClubData, type ClubData } from '../domain/clubRanking';
import { getMeta, setMeta } from './store';

export const CLUB_DATA_URL = (import.meta.env.VITE_CLUB_DATA_URL as string | undefined) ?? `${import.meta.env.BASE_URL}data/clubs.json`;

const KEY = 'clubData';
const AT_KEY = 'clubDataAt';

export interface ClubState {
  data: ClubData | null;
  /** 最後に読みに行って成功した時刻。 */
  checkedAt: number | null;
  /** 最後の読み込みが失敗したときの理由。 */
  error: string | null;
}

export async function loadCachedClub(): Promise<ClubState> {
  if (DEMO) return { data: (await import('../demo/clubSample')).buildClubSample(), checkedAt: Date.now(), error: null };
  try {
    const raw = await getMeta<unknown>(KEY);
    return { data: raw ? parseClubData(raw) : null, checkedAt: (await getMeta<number>(AT_KEY)) ?? null, error: null };
  } catch {
    return { data: null, checkedAt: null, error: null };
  }
}

/** サーバーから読み直す。失敗したら前回の内容のまま error だけ付ける。 */
export async function fetchClub(prev: ClubState): Promise<ClubState> {
  if (DEMO) return prev;
  try {
    const res = await fetch(`${CLUB_DATA_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(res.status === 404 ? 'データがまだありません' : `HTTP ${res.status}`);
    const data = parseClubData(await res.json());
    const now = Date.now();
    await setMeta(KEY, data);
    await setMeta(AT_KEY, now);
    return { data, checkedAt: now, error: null };
  } catch (e) {
    return { ...prev, error: e instanceof Error ? e.message : String(e) };
  }
}
