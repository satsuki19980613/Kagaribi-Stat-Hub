import { describe, expect, it } from 'vitest';
import { parseBackup, toBackup } from './backup';
import type { AppData } from './model';

const data: AppData = {
  members: [{ id: 'a', name: 'A', archived: false, order: 0, createdAt: 1, baseMatches: 3 }],
  records: [{ id: 'r', memberId: 'a', date: '2026-10-03', rank: 1, createdAt: 1, updatedAt: 1 }],
  snapshots: [{ id: 's', memberId: 'a', date: '2026-10-03', matches: 4, vpip: 30, hands: 50, createdAt: 1 }],
  seasons: [{ no: 31, start: '2026-10-03', end: '2026-10-30', toggled: [] }],
};

describe('バックアップ', () => {
  it('書き出したものはそのまま読める', () => {
    const json = JSON.parse(JSON.stringify(toBackup(data)));
    expect(parseBackup(json)).toEqual(data);
  });

  it('別アプリのファイル・壊れた記録・重複は弾く', () => {
    expect(() => parseBackup({ app: 'x' })).toThrow();
    const bad = JSON.parse(JSON.stringify(toBackup(data)));
    bad.records[0].rank = 7;
    expect(() => parseBackup(bad)).toThrow(/記録/);
    const dup = JSON.parse(JSON.stringify(toBackup(data)));
    dup.records.push({ ...dup.records[0], id: 'r2' });
    expect(() => parseBackup(dup)).toThrow(/重複/);
  });
});
