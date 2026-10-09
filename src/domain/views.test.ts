import { describe, expect, it } from 'vitest';
import type { AppData } from './model';
import { clubAppTotals, clubAxisLabels, clubAxisLength, seasonAxis, seasonCumulative, seasonRows, trendValue } from './views';

const data: AppData = {
  members: [
    { id: 'a', name: 'A', archived: false, order: 0, createdAt: 0, baseMatches: 0 },
    { id: 'b', name: 'B', archived: true, order: 1, createdAt: 0, baseMatches: 0 },
    { id: 'c', name: 'C', archived: true, order: 2, createdAt: 0, baseMatches: 0 },
  ],
  records: [
    { id: '1', memberId: 'a', date: '2026-10-03', rank: 1, createdAt: 0, updatedAt: 0 },
    { id: '2', memberId: 'a', date: '2026-10-06', rank: 6, createdAt: 0, updatedAt: 0 },
    { id: '3', memberId: 'b', date: '2026-10-07', rank: 2, createdAt: 0, updatedAt: 0 },
    { id: '4', memberId: 'a', date: '2026-11-03', rank: 3, createdAt: 0, updatedAt: 0 },
  ],
  snapshots: [
    { id: 's1', memberId: 'a', date: '2026-10-01', matches: 10, vpip: 25, hands: 100, createdAt: 0 },
    { id: 's2', memberId: 'a', date: '2026-11-04', matches: 12, vpip: 25, hands: 150, createdAt: 0 },
  ],
  seasons: [],
};

describe('シーズンの表', () => {
  it('有効メンバー + そのシーズンに記録のあるアーカイブ済みメンバー', () => {
    const rows = seasonRows(data, 31);
    expect(rows.map((r) => r.member.id)).toEqual(['a', 'b']);
    expect(rows[0]?.sum.total).toBe(4);
    expect(rows[0]?.survival).toBeCloseTo(40);
    expect(rows[0]?.survivalStale).toBe(true);
  });

  it('開催日以外の記録日も X 軸に入る', () => {
    const axis = seasonAxis(data, 31);
    expect(axis).toContain('2026-10-07');
    expect(axis).toHaveLength(14);
  });

  it('累積は今日で止まる', () => {
    const v = seasonCumulative(data, 31, 'a', '2026-10-06');
    expect(v.slice(0, 3)).toEqual([5, 4, null]);
  });
});

describe('シーズン推移', () => {
  it('参加の無いシーズンは null、生存ターン数はそのシーズン中の入力だけ', () => {
    expect(trendValue(data, 31, 'a', 'total')).toBe(4);
    expect(trendValue(data, 32, 'a', 'winRate')).toBe(0);
    expect(trendValue(data, 32, 'b', 'total')).toBeNull();
    expect(trendValue(data, 31, 'a', 'survival')).toBeNull();
    expect(trendValue(data, 32, 'a', 'survival')).toBeCloseTo(50);
  });
});

describe('メンバー平均', () => {
  it('累積はその日までのクラブ合計 ÷ そのシーズンの参加者数', async () => {
    const { seasonAverage, trendAverage } = await import('./views');
    // S31 の参加者は a・b（2 人）。10/3: a=5,b=0 → 2.5 / 10/6: a=4 → 2 / 10/7: b=3 → 3.5
    const avg = seasonAverage(data, 31, '2026-10-31');
    expect(avg.slice(0, 3)).toEqual([2.5, 2, 3.5]);
    // 推移の平均は値のあるメンバーだけで割る（S32 は a だけ）
    expect(trendAverage(data, [31, 32], ['a', 'b', 'c'], 'total')).toEqual([3.5, 2]);
  });
});

describe('クラブ順位のグラフの軸', () => {
  it('開催日の数・取り込んだ節の大きい方。アプリの合計は今日まで', () => {
    // S31 の開催日: 10/3(土) 10/6(火) 10/8(木) ...
    expect(clubAxisLength(data, 31, '2026-10-07', 0)).toBe(2);
    expect(clubAxisLength(data, 31, '2026-10-07', 3)).toBe(3);
    expect(clubAxisLabels(data, 31, 3)).toEqual(['10/3', '10/6', '10/8']);
    // 10/7 の記録（開催日以外）は 10/8 の時点に入る。
    expect(clubAppTotals(data, 31, 3, '2026-10-08')).toEqual([5, 4, 7]);
    expect(clubAppTotals(data, 31, 3, '2026-10-07')).toEqual([5, 4, null]);
  });
});
