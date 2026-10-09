import { describe, expect, it } from 'vitest';
import type { MatchRecord, Member, Rank, StatSnapshot } from './model';
import { RANK_POINTS, fmtPt } from './points';
import { baseForCount, cumulativeSeries, latestSurvivalSnapshot, matchCountOf, summarize, survivalOf } from './stats';

let seq = 0;
function rec(memberId: string, date: string, rank: Rank): MatchRecord {
  seq += 1;
  return { id: `r${seq}`, memberId, date, rank, createdAt: seq, updatedAt: seq };
}
const member: Member = { id: 'a', name: 'A', archived: false, order: 0, createdAt: 0, baseMatches: 100 };

describe('得点', () => {
  it('公式の配点', () => {
    expect(RANK_POINTS).toEqual({ 1: 5, 2: 3, 3: 2, 4: 1, 5: 0, 6: -1 });
    expect(fmtPt(5)).toBe('+5');
    expect(fmtPt(0)).toBe('±0');
    expect(fmtPt(-1)).toBe('−1');
  });
});

describe('summarize', () => {
  it('合計・平均・加点率・1位率・平均順位', () => {
    const s = summarize([rec('a', '2026-10-03', 1), rec('a', '2026-10-06', 4), rec('a', '2026-10-08', 5), rec('a', '2026-10-10', 6)]);
    expect(s.n).toBe(4);
    expect(s.total).toBe(5 + 1 + 0 - 1);
    expect(s.avg).toBeCloseTo(1.25);
    expect(s.plusRate).toBeCloseTo(0.5);
    expect(s.winRate).toBeCloseTo(0.25);
    expect(s.avgRank).toBeCloseTo(4);
    expect(s.dist).toEqual([1, 0, 0, 1, 1, 1]);
  });

  it('記録が無ければ率は null', () => {
    const s = summarize([]);
    expect(s.avg).toBeNull();
    expect(s.plusRate).toBeNull();
  });
});

describe('生存ターン数', () => {
  it('参加ハンド数 ÷ (参加回数 × VPIP)', () => {
    expect(survivalOf({ matches: 2112, vpip: 34, hands: 31456 })).toBeCloseTo(43.81, 2);
  });

  it('値が欠けていれば null', () => {
    expect(survivalOf({ matches: 10, vpip: undefined, hands: 100 })).toBeNull();
    expect(survivalOf({ matches: 0, vpip: 30, hands: 100 })).toBeNull();
  });

  it('計算できる最新のスナップショットを選ぶ（期間指定あり）', () => {
    const snaps: StatSnapshot[] = [
      { id: '1', memberId: 'a', date: '2026-10-03', matches: 10, vpip: 30, hands: 120, createdAt: 1 },
      { id: '2', memberId: 'a', date: '2026-10-20', matches: 15, wins: 3, createdAt: 2 },
      { id: '3', memberId: 'a', date: '2026-11-05', matches: 20, vpip: 32, hands: 260, createdAt: 3 },
    ];
    expect(latestSurvivalSnapshot(snaps, 'a')?.id).toBe('3');
    expect(latestSurvivalSnapshot(snaps, 'a', '2026-10-31')?.id).toBe('1');
    expect(latestSurvivalSnapshot(snaps, 'a', '2026-10-31', '2026-10-10')).toBeUndefined();
  });
});

describe('参加回数の自動カウント', () => {
  it('登録時の値 + 記録件数。手で直すと base を逆算', () => {
    const rs = [rec('a', '2026-10-03', 2), rec('a', '2026-10-06', 3), rec('b', '2026-10-06', 1)];
    expect(matchCountOf(member, rs)).toBe(102);
    const base = baseForCount(150, member, rs);
    expect(matchCountOf({ ...member, baseMatches: base }, rs)).toBe(150);
  });
});

describe('累積ポイント', () => {
  it('開催日ごとの累積。未来の日は null', () => {
    const rs = [rec('a', '2026-10-03', 1), rec('a', '2026-10-08', 6), rec('b', '2026-10-06', 1)];
    const days = ['2026-10-03', '2026-10-06', '2026-10-08', '2026-10-10'];
    expect(cumulativeSeries(rs, 'a', days, '2026-10-09')).toEqual([5, 5, 4, null]);
  });
});
