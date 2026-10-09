import { describe, expect, it } from 'vitest';
import {
  checkRound,
  clubSeries,
  emptyClubData,
  ownSeries,
  perMemberSeries,
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
Oct 5
10/3 シーズン31 第1節

1 56 🥇【γ】
2 47 🥈 SB from リンプして時雨
3 44 🥉 Black Box
3 44 🥉 #41
6:35 PM · Oct 5, 2026
·
623
 Views
#ポーカーチェイス クラブマッチ
シーズン31 第2節
1(3) 88 +44 Black Box
1(2) 88 +41 SB from リンプして時雨
３（１） ８６ ＋３０ 🥉 【γ】
4(外) 76 GOGOマフィン
5(3) 70 −4 #41
6(5) 60 ±0 Night Owls 🦉
7(6) 50
9:30 AM · Oct 7, 2026
3,680
Discover more
シーズン31 第2節
1(3) 88 +44 Black Box
1(2) 89 +41 SB from リンプして時雨`;

describe('X のポストを読む', () => {
  const p = parseRankingText(POST);

  it('見出しごとに 1 節。第1節は得点 = 累計、同点は同じ順位', () => {
    expect(p.rounds.map((r) => [r.season, r.round, r.clubs.length])).toEqual([
      [31, 1, 4],
      [31, 2, 6],
    ]);
    expect(p.rounds[0]?.clubs).toEqual([
      { rank: 1, prev: null, name: '【γ】', total: 56, gain: 56 },
      { rank: 2, prev: null, name: 'SB from リンプして時雨', total: 47, gain: 47 },
      { rank: 3, prev: null, name: 'Black Box', total: 44, gain: 44 },
      { rank: 3, prev: null, name: '#41', total: 44, gain: 44 },
    ]);
  });

  it('第2節以降: 全角・メダル・圏外（得点なし）・負の点・名前の後ろの絵文字', () => {
    expect(p.rounds[1]?.clubs).toEqual([
      { rank: 1, prev: 3, name: 'Black Box', total: 88, gain: 44 },
      { rank: 1, prev: 2, name: 'SB from リンプして時雨', total: 88, gain: 41 },
      { rank: 3, prev: 1, name: '【γ】', total: 86, gain: 30 },
      { rank: 4, prev: null, name: 'GOGOマフィン', total: 76, gain: null },
      { rank: 5, prev: 3, name: '#41', total: 70, gain: -4 },
      { rank: 6, prev: 5, name: 'Night Owls 🦉', total: 60, gain: 0 },
    ]);
  });

  it('名前のない行は読めなかった行に。重複して貼られた節はまとめ、値が違えば知らせる', () => {
    expect(p.skipped).toEqual(['7(6) 50']);
    expect(p.conflicts).toEqual(['S31 第2節 SB from リンプして時雨: 1位 88 と 1位 89']);
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
    expect(warnings).toEqual(['クラブ数が 3 です（30 より少ない。スレッドの続きが欠けていない？）']);
  });

  it('累計の食い違い・前節順位の食い違い・順位と累計の食い違いはわかる', () => {
    const d = upsertRound(emptyClubData(), r1, 't');
    const bad: ClubRound = {
      ...r2,
      clubs: [
        { rank: 1, prev: 1, name: 'B', total: 81, gain: 50 },
        { rank: 1, prev: 1, name: 'A', total: 60, gain: 20 },
      ],
    };
    const { errors, warnings } = checkRound(d, bad);
    expect(errors).toEqual([]);
    // A は累計 60 なので 1 位ではなく 2 位のはず
    expect(warnings).toContain('A: 1位とあるが、累計 60 なら 2位');
    expect(warnings).toContain('B: 前節 30 + 50 ≠ 81');
    expect(warnings).toContain('B: 前節の順位が 1 とあるが、前節のデータでは 2 位');
  });

  it('同点の同じ順位はエラーにしない。圏外とあるのに前節にいれば知らせる', () => {
    const d = upsertRound(emptyClubData(), r1, 't');
    const r: ClubRound = {
      season: 31,
      round: 2,
      clubs: [
        { rank: 1, prev: 1, name: 'A', total: 70, gain: 30 },
        { rank: 1, prev: null, name: 'B', total: 70, gain: null },
        { rank: 3, prev: null, name: 'C', total: 60, gain: null },
      ],
    };
    const { errors, warnings } = checkRound(d, r);
    expect(errors).toEqual([]);
    expect(warnings.filter((w) => !w.startsWith('クラブ数'))).toEqual(['B: 圏外から入ったとあるが、前節のデータでは 2 位']);
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
    // 1 人あたり = 累計 ÷ 定員 20
    expect(perMemberSeries(d, 31, 'avg', 3)).toEqual([1.75, 3.25, null]);
    expect(perMemberSeries(d, 31, 'B', 2)).toEqual([1.5, 4]);
  });
});
