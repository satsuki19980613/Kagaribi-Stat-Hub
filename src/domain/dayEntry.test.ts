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
