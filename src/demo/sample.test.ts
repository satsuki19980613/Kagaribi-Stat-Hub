import { describe, expect, it } from 'vitest';
import { parseBackup, toBackup } from '../domain/backup';
import { seasonOf } from '../domain/season';
import { latestSurvivalSnapshot, matchCountOf, survivalOf } from '../domain/stats';
import { DEMO_TODAY } from '../clock';
import { buildSampleData } from './sample';

describe('デモのサンプルデータ', () => {
  const data = buildSampleData();

  it('バックアップとして正しい形（重複なし・メンバー整合）', () => {
    expect(() => parseBackup(JSON.parse(JSON.stringify(toBackup(data))))).not.toThrow();
  });

  it('毎回同じものができる', () => {
    expect(buildSampleData()).toEqual(data);
  });

  it('記録はすべてどこかのシーズンに入り、今日より先は無い', () => {
    for (const r of data.records) {
      expect(seasonOf(r.date, data.seasons)).not.toBeNull();
      expect(r.date <= DEMO_TODAY).toBe(true);
    }
  });

  it('有効メンバーが 20 人、アーカイブ済みが 1 人', () => {
    expect(data.members.filter((m) => !m.archived)).toHaveLength(20);
    expect(data.members.filter((m) => m.archived)).toHaveLength(1);
  });

  it('さつきの 10/9 時点のスタッツは実際の画面と同じ（生存ターン数 ≈ 62.3）', () => {
    const satsuki = data.members.find((m) => m.name === 'さつき')!;
    const snap = latestSurvivalSnapshot(data.snapshots, satsuki.id, '2026-10-09');
    expect(snap).toMatchObject({ matches: 79, wins: 20, vpip: 28, hands: 1377 });
    expect(survivalOf(snap)).toBeCloseTo(62.25, 1);
    // スナップショットの参加回数は、その時点の自動カウントと一致する。
    const upTo = data.records.filter((r) => r.date <= '2026-10-09');
    expect(matchCountOf(satsuki, upTo)).toBe(79);
  });
});
