import { describe, expect, it } from 'vitest';
import {
  checkRound,
  clubSeries,
  emptyClubData,
  ownSeries,
  parseClubData,
  parseRankingText,
  serializeClubData,
  topAverage,
  upsertRound,
  type ClubRound,
} from './clubRanking';

const POST = `1357cm
@c0pmvd
·
9h
#ポーカーチェイス クラブマッチ
シーズン31 第3節
1(1) 138 +50 🥇 SB from リンプして時雨
2(3) 136 +50 🥇 Accentier
３（２） １２０ ＋３５ 🥈 燎
4(-) 99 -2 Night Owls 🦉
5(new) 90 ±0 ⬆️ テスト クラブ
6(5) 80 −3 マイナス
7(6) 70
21
2.3K`;

describe('X のポストを読む', () => {
  it('シーズン・節・各行（全角・メダル・圏外・負の点）', () => {
    const p = parseRankingText(POST);
    expect(p.season).toBe(31);
    expect(p.round).toBe(3);
    expect(p.clubs).toEqual([
      { rank: 1, prev: 1, name: 'SB from リンプして時雨', total: 138, gain: 50 },
      { rank: 2, prev: 3, name: 'Accentier', total: 136, gain: 50 },
      { rank: 3, prev: 2, name: '燎', total: 120, gain: 35 },
      // 名前の後ろの絵文字は名前の一部として残す。
      { rank: 4, prev: null, name: 'Night Owls 🦉', total: 99, gain: -2 },
      { rank: 5, prev: null, name: 'テスト クラブ', total: 90, gain: 0 },
      { rank: 6, prev: 5, name: 'マイナス', total: 80, gain: -3 },
    ]);
    // 得点の無い行は読めなかった行として出す。いいね数などは無視。
    expect(p.skipped).toEqual(['7(6) 70']);
  });
});

const r1: ClubRound = {
  season: 31,
  round: 1,
  clubs: [
    { rank: 1, prev: null, name: 'A', total: 40, gain: 40 },
    { rank: 2, prev: null, name: 'B', total: 30, gain: 30 },
  ],
};
const r2: ClubRound = {
  season: 31,
  round: 2,
  clubs: [
    { rank: 1, prev: 2, name: 'B', total: 80, gain: 50 },
    { rank: 2, prev: 1, name: 'A', total: 60, gain: 20 },
    { rank: 3, prev: null, name: '燎', total: 55, gain: 55 },
  ],
};

describe('取り込む前の確認', () => {
  it('前節と累計・順位が合っていれば警告はクラブ数だけ', () => {
    const d = upsertRound(emptyClubData(), r1, 't');
    const { errors, warnings } = checkRound(d, r2);
    expect(errors).toEqual([]);
    expect(warnings).toEqual(['クラブ数が 3 です（ふつうは 30）']);
  });

  it('累計の食い違い・前節順位の食い違い・同じ順位はわかる', () => {
    const d = upsertRound(emptyClubData(), r1, 't');
    const bad: ClubRound = {
      ...r2,
      clubs: [
        { rank: 1, prev: 1, name: 'B', total: 81, gain: 50 },
        { rank: 1, prev: 1, name: 'A', total: 60, gain: 20 },
      ],
    };
    const { errors, warnings } = checkRound(d, bad);
    expect(errors).toEqual(['同じ順位が 2 つあります: 1']);
    expect(warnings).toContain('B: 前節 30 + 50 ≠ 81');
    expect(warnings).toContain('B: 前節の順位が 1 とあるが、前節のデータでは 2 位');
  });

  it('第1節は累計 = 得点', () => {
    const { warnings } = checkRound(emptyClubData(), { ...r1, clubs: [{ rank: 1, prev: null, name: 'A', total: 40, gain: 30 }] });
    expect(warnings).toContain('第1節なのに累計と得点が違う: A');
  });
});

describe('データの扱い', () => {
  const d = upsertRound(upsertRound(emptyClubData(), r2, 't1'), r1, 't2');

  it('同じ節は置き換え、節の順に並べる', () => {
    expect(d.rounds.map((r) => r.round)).toEqual([1, 2]);
    const again = upsertRound(d, { ...r1, clubs: [{ rank: 1, prev: null, name: 'A', total: 41, gain: 41 }] }, 't3');
    expect(again.rounds.length).toBe(2);
    expect(again.rounds[0]?.clubs[0]?.total).toBe(41);
    expect(again.updatedAt).toBe('t3');
  });

  it('書き出したものは読み戻せる。形が違えば例外', () => {
    expect(parseClubData(JSON.parse(serializeClubData(d)))).toEqual(d);
    expect(() => parseClubData({ format: 'x' })).toThrow();
    expect(() => parseClubData({ ...d, rounds: [{ season: 31, round: 1, clubs: [{ rank: '1' }] }] })).toThrow();
  });

  it('クラブの線・上位平均・燎（公式があれば公式、無ければアプリの合計）', () => {
    expect(clubSeries(d, 31, 'A', 3)).toEqual([40, 60, null]);
    expect(topAverage(d, 31, 3)).toEqual([35, 65, null]);
    expect(ownSeries(d, 31, [12, 30, 45])).toEqual({ values: [12, 55, 45], official: [false, true, false] });
  });
});
