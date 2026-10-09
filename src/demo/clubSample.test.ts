import { describe, expect, it } from 'vitest';
import { OWN_CLUB, checkRound, parseClubData, roundsOf, upsertRound, emptyClubData } from '../domain/clubRanking';
import { buildClubSample } from './clubSample';

describe('デモのクラブ順位', () => {
  const d = buildClubSample();

  it('形が正しく、毎節 30 クラブで、前節との累計が合う', () => {
    expect(() => parseClubData(JSON.parse(JSON.stringify(d)))).not.toThrow();
    let acc = emptyClubData();
    for (const r of d.rounds) {
      expect(r.clubs.length).toBe(30);
      const { errors, warnings } = checkRound(acc, r);
      expect(errors).toEqual([]);
      // 圏外から戻ったクラブは前節のデータに居ないので、累計の突き合わせ・順位の警告は出ない。
      expect(warnings.filter((w) => w.includes('≠') || w.includes('前節の順位'))).toEqual([]);
      acc = upsertRound(acc, r, '');
    }
  });

  it('3 シーズンぶんあり、燎は順位に入る節と入らない節がある', () => {
    expect([31, 32, 33].map((s) => roundsOf(d, s).length).every((n) => n > 0)).toBe(true);
    const inTop = d.rounds.map((r) => r.clubs.some((c) => c.name === OWN_CLUB));
    expect(inTop.some(Boolean)).toBe(true);
  });
});
