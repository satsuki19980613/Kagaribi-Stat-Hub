import { describe, expect, it } from 'vitest';
import { DAYS, RECENT, hashData, planBackup, type BackupMeta } from './autoBackup';
import type { AppData } from './model';

const meta = (id: number, at: number, hash = `h${id}`): BackupMeta => ({ id, at, hash, members: 0, records: 0 });

const HOUR = 3600_000;
const DAY = 24 * HOUR;

describe('自動バックアップの残し方', () => {
  it('最初の 1 件は追加', () => {
    expect(planBackup([], 'a', 1000)).toEqual({ action: 'add', deleteIds: [] });
  });

  it('内容が直前と同じなら残さない', () => {
    expect(planBackup([meta(1, 0, 'a')], 'a', DAY)).toEqual({ action: 'skip' });
  });

  it('直前の操作のすぐ後でも、1 件ずつ残す（直前の状態に戻せる）', () => {
    expect(planBackup([meta(1, 0)], 'x', 1000)).toEqual({ action: 'add', deleteIds: [] });
  });

  it(`直近 ${RECENT} 件はすべて、それより古いものは 1 日 1 件`, () => {
    const now = 100 * DAY + 12 * HOUR;
    // 直近 29 件（今日）+ 古いもの: 2 日前に 3 件、3 日前に 1 件
    const recent = Array.from({ length: RECENT - 1 }, (_, i) => meta(100 + i, now - (i + 1) * 60_000));
    const old = [meta(1, now - 2 * DAY), meta(2, now - 2 * DAY - HOUR), meta(3, now - 2 * DAY - 2 * HOUR), meta(4, now - 3 * DAY)];
    const plan = planBackup([...recent, ...old], 'new', now);
    expect(plan).toEqual({ action: 'add', deleteIds: [2, 3] });
  });

  it(`古い日は ${DAYS} 日ぶんまで`, () => {
    const now = 500 * DAY;
    const daily = Array.from({ length: RECENT + DAYS + 5 }, (_, i) => meta(i + 1, now - (i + 1) * DAY));
    const plan = planBackup(daily, 'new', now);
    if (plan.action !== 'add') throw new Error('add のはず');
    // 残るのは 新 1 + 直近 29 + 古い日（合計 DAYS 日になるまで）
    expect(daily.length + 1 - plan.deleteIds.length).toBe(RECENT + (DAYS - RECENT));
  });
});

describe('内容の指紋', () => {
  const a: AppData = {
    members: [
      { id: 'm1', name: 'A', archived: false, order: 0, createdAt: 0, baseMatches: 0 },
      { id: 'm2', name: 'B', archived: false, order: 1, createdAt: 0, baseMatches: 0 },
    ],
    records: [],
    snapshots: [],
    seasons: [],
  };

  it('並び順が違っても同じ、中身が違えば変わる', () => {
    const b: AppData = { ...a, members: [...a.members].reverse() };
    expect(hashData(b)).toBe(hashData(a));
    const c: AppData = { ...a, members: [{ ...a.members[0]!, name: 'Z' }, a.members[1]!] };
    expect(hashData(c)).not.toBe(hashData(a));
  });
});
