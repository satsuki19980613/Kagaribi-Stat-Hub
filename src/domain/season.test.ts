import { describe, expect, it } from 'vitest';
import {
  currentSeason,
  defaultSeasonRange,
  isMatchDay,
  matchDays,
  normalizeOverride,
  seasonList,
  seasonOf,
  validateSeasonEdit,
} from './season';

describe('既定のシーズン（暦月）', () => {
  it('S31 は 2026/10/3〜10/31、S32 は 11 月', () => {
    expect(defaultSeasonRange(31)).toEqual({ no: 31, start: '2026-10-03', end: '2026-10-31' });
    expect(defaultSeasonRange(32)).toEqual({ no: 32, start: '2026-11-01', end: '2026-11-30' });
    expect(defaultSeasonRange(34)).toEqual({ no: 34, start: '2027-01-01', end: '2027-01-31' });
  });

  it('日付からシーズンを判定する', () => {
    expect(seasonOf('2026-10-03', [])).toBe(31);
    expect(seasonOf('2026-10-31', [])).toBe(31);
    expect(seasonOf('2026-11-01', [])).toBe(32);
    expect(seasonOf('2027-02-14', [])).toBe(35);
  });

  it('S31 より前は対象外', () => {
    expect(seasonOf('2026-10-02', [])).toBeNull();
    expect(seasonOf('2026-09-30', [])).toBeNull();
  });

  it('S31 の開催日は火・木・土の 13 日', () => {
    const days = matchDays(31, []);
    expect(days).toHaveLength(13);
    expect(days[0]).toBe('2026-10-03');
    expect(days.at(-1)).toBe('2026-10-31');
  });
});

describe('シーズンの手動修正', () => {
  it('終了を 1 日早めると、その日はどのシーズンにも入らない', () => {
    const ov = [{ no: 31, start: '2026-10-03', end: '2026-10-30', toggled: [] }];
    expect(seasonOf('2026-10-31', ov)).toBeNull();
    expect(matchDays(31, ov)).toHaveLength(12);
  });

  it('翌月にずれ込んだ期間も拾う', () => {
    const ov = [
      { no: 31, start: '2026-10-03', end: '2026-11-02', toggled: [] },
      { no: 32, start: '2026-11-03', end: '2026-11-30', toggled: [] },
    ];
    expect(seasonOf('2026-11-02', ov)).toBe(31);
    expect(seasonOf('2026-11-03', ov)).toBe(32);
  });

  it('休催日・追加開催日を反映する', () => {
    const ov = [{ no: 31, start: '2026-10-03', end: '2026-10-31', toggled: ['2026-10-06', '2026-10-07'] }];
    const days = matchDays(31, ov);
    expect(days).not.toContain('2026-10-06'); // 火 → 休催
    expect(days).toContain('2026-10-07'); // 水 → 追加開催
    expect(isMatchDay('2026-10-06', ov)).toBe(false);
    expect(isMatchDay('2026-10-07', ov)).toBe(true);
  });

  it('前後のシーズンとの重なりを弾く', () => {
    const issues = validateSeasonEdit({ no: 32, start: '2026-10-31', end: '2026-11-30', toggled: [] }, []);
    expect(issues.some((s) => s.includes('S31'))).toBe(true);
    expect(validateSeasonEdit({ no: 31, start: '2026-10-03', end: '2026-10-30', toggled: [] }, [])).toEqual([]);
  });

  it('開始が終了より後なら弾く', () => {
    expect(validateSeasonEdit({ no: 31, start: '2026-10-20', end: '2026-10-10', toggled: [] }, []).length).toBeGreaterThan(0);
  });

  it('既定と同じ修正は消える。期間外の指定は落とす', () => {
    expect(normalizeOverride({ no: 32, start: '2026-11-01', end: '2026-11-30', toggled: [] })).toBeNull();
    expect(normalizeOverride({ no: 32, start: '2026-11-01', end: '2026-11-28', toggled: ['2026-11-29', '2026-11-03'] })).toEqual({
      no: 32,
      start: '2026-11-01',
      end: '2026-11-28',
      toggled: ['2026-11-03'],
    });
  });
});

describe('一覧と現在のシーズン', () => {
  it('S31 から今日のシーズンまでを新しい順に', () => {
    expect(seasonList('2026-12-05', [], [])).toEqual([33, 32, 31]);
    expect(seasonList('2026-10-09', [], [])).toEqual([31]);
  });

  it('隙間の日は直前のシーズン', () => {
    const ov = [{ no: 31, start: '2026-10-03', end: '2026-10-30', toggled: [] }];
    expect(currentSeason('2026-10-31', ov)).toBe(31);
    expect(currentSeason('2026-11-10', ov)).toBe(32);
  });
});
