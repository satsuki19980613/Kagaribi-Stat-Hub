import { describe, expect, it } from 'vitest';
import { draftFromRecords, planIsEmpty, planSave } from './dayEntry';
import type { MatchRecord } from './model';

const existing: MatchRecord[] = [
  { id: 'r1', memberId: 'a', date: '2026-10-03', rank: 2, createdAt: 1, updatedAt: 1 },
  { id: 'r2', memberId: 'b', date: '2026-10-03', rank: 5, part: 2, createdAt: 1, updatedAt: 1 },
  { id: 'r3', memberId: 'a', date: '2026-10-06', rank: 1, createdAt: 1, updatedAt: 1 },
];

describe('1日ぶんの入力', () => {
  it('既存の記録を下書きに読み込む', () => {
    expect(draftFromRecords(existing, '2026-10-03')).toEqual({ a: { rank: 2, part: null }, b: { rank: 5, part: 2 } });
  });

  it('変更なしなら何もしない', () => {
    expect(planIsEmpty(planSave(existing, '2026-10-03', draftFromRecords(existing, '2026-10-03')))).toBe(true);
  });

  it('追加・修正・削除を 1 回で計画する（同じ id を保って修正）', () => {
    const plan = planSave(existing, '2026-10-03', { a: { rank: 3, part: 1 }, b: { rank: null, part: null }, c: { rank: 1, part: null } }, 99);
    expect(plan.added).toBe(1);
    expect(plan.updated).toBe(1);
    expect(plan.deletes.map((r) => r.id)).toEqual(['r2']);
    const upd = plan.puts.find((r) => r.memberId === 'a');
    expect(upd).toMatchObject({ id: 'r1', rank: 3, part: 1, createdAt: 1, updatedAt: 99 });
    expect(plan.puts.find((r) => r.memberId === 'c')).toMatchObject({ date: '2026-10-03', rank: 1, createdAt: 99 });
    expect(plan.puts.find((r) => r.memberId === 'c')).not.toHaveProperty('part');
  });

  it('部の指定を外すと part が消える', () => {
    const plan = planSave(existing, '2026-10-03', { a: { rank: 2, part: null }, b: { rank: 5, part: null } });
    expect(plan.puts).toHaveLength(1);
    expect(plan.puts[0]).not.toHaveProperty('part');
  });
});

describe('記録画面のスタッツ（任意）', async () => {
  const { planStats, matchesOnDay, draftFromRecords: fromRecords } = await import('./dayEntry');
  const members = [
    { id: 'a', name: 'A', archived: false, order: 0, createdAt: 0, baseMatches: 76 },
    { id: 'b', name: 'B', archived: false, order: 1, createdAt: 0, baseMatches: 10 },
  ];
  const snaps = [{ id: 's1', memberId: 'b', date: '2026-10-03', matches: 11, vpip: 30, hands: 200, createdAt: 5 }];

  it('参加回数はその日の試合を終えた時点の自動カウント', () => {
    // a は 10/3 より前の記録なし → 76 + 今日の 1
    expect(matchesOnDay(members[0]!, existing, '2026-10-03', true)).toBe(77);
    // a は 10/6 時点で 10/3 の記録が 1 件 → 76 + 1 + 1
    expect(matchesOnDay(members[0]!, existing, '2026-10-06', true)).toBe(78);
  });

  it('既存のその日のスタッツを下書きに読み込む', () => {
    expect(fromRecords(existing, '2026-10-03', snaps).b).toEqual({ rank: 5, part: 2, stats: { wins: '', vpip: '30', hands: '200' } });
  });

  it('新規・変更なし・空にして削除・不正入力', () => {
    const plan = planStats(
      members,
      existing,
      snaps,
      '2026-10-03',
      {
        a: { rank: 2, part: null, stats: { wins: '20', vpip: '28', hands: '1377' } },
        b: { rank: 5, part: 2, stats: { wins: '', vpip: '30', hands: '200' } },
      },
      9,
    );
    expect(plan.puts).toHaveLength(1);
    expect(plan.puts[0]).toMatchObject({ memberId: 'a', date: '2026-10-03', matches: 77, wins: 20, vpip: 28, hands: 1377, createdAt: 9 });
    expect(plan.deletes).toEqual([]);

    const cleared = planStats(members, existing, snaps, '2026-10-03', { b: { rank: 5, part: 2, stats: { wins: '', vpip: '', hands: '' } } });
    expect(cleared.deletes.map((s) => s.id)).toEqual(['s1']);

    const bad = planStats(members, existing, snaps, '2026-10-03', { a: { rank: 1, part: null, stats: { wins: '', vpip: '28', hands: '' } } });
    expect(bad.issues.a?.length).toBeGreaterThan(0);
    expect(bad.puts).toEqual([]);
  });

  it('順位を外した人のスタッツは見ない', () => {
    const plan = planStats(members, existing, snaps, '2026-10-03', { a: { rank: null, part: null, stats: { wins: '1', vpip: '20', hands: '10' } } });
    expect(plan.puts).toEqual([]);
  });
});
