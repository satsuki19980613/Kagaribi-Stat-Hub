/**
 * デモ用のサンプルデータ（`npm run build:demo` のときだけ使う）。
 *
 * 有効メンバー 20 人+ アーカイブ 1 人で、S31〜S33 の 3 シーズンぶんを、決まった乱数の種から毎回同じに作る。
 * 「今日」は DEMO_TODAY（S33 の途中）として扱う。
 * さつきの S31 序盤（10/3 1位・10/6 1位・10/8 5位）とスタッツ（参加 79・優勝 20・VPIP 28%・参加ハンド 1377）は実際の画面の値。
 */

import { DEMO_TODAY } from '../clock';
import type { AppData, MatchRecord, Member, Rank, SeasonOverride, StatSnapshot } from '../domain/model';
import { matchDays } from '../domain/season';


/** サンプルの版。変えると、デモを開いたときに入れ直す。 */
export const SAMPLE_VERSION = 2;

interface Profile {
  name: string;
  /** 正なら上位に寄る。 */
  skill: number;
  /** 開催日に参加する確率。 */
  attend: number;
  vpip: number;
  survival: number;
  base: number;
  /** スタッツを入力する日（シーズン末など）。 */
  statDays: string[];
  joined?: string;
  left?: string;
}

const PROFILES: Profile[] = [
  { name: 'さつき', skill: 0.35, attend: 0.9, vpip: 28, survival: 62, base: 76, statDays: ['2026-10-31', '2026-11-28', '2026-12-15'] },
  { name: 'ほむら', skill: 0.25, attend: 0.8, vpip: 31, survival: 55, base: 140, statDays: ['2026-10-31', '2026-11-28'] },
  { name: 'かがり', skill: 0.15, attend: 0.85, vpip: 24, survival: 66, base: 95, statDays: ['2026-10-31', '2026-11-28', '2026-12-15'] },
  { name: 'あかね', skill: 0.05, attend: 0.7, vpip: 36, survival: 47, base: 61, statDays: ['2026-11-28'] },
  { name: 'しずく', skill: 0.0, attend: 0.75, vpip: 22, survival: 70, base: 33, statDays: ['2026-10-31', '2026-12-15'] },
  { name: 'とうか', skill: -0.05, attend: 0.65, vpip: 33, survival: 51, base: 120, statDays: ['2026-10-31', '2026-11-28'] },
  { name: 'こはる', skill: -0.1, attend: 0.6, vpip: 40, survival: 44, base: 18, statDays: [] },
  { name: 'ひかげ', skill: 0.1, attend: 0.55, vpip: 26, survival: 58, base: 210, statDays: ['2026-11-28'] },
  { name: 'つむぎ', skill: -0.2, attend: 0.7, vpip: 35, survival: 49, base: 8, statDays: ['2026-12-15'] },
  { name: 'みお', skill: -0.15, attend: 0.5, vpip: 29, survival: 53, base: 45, statDays: [] },
  { name: 'れん', skill: 0.2, attend: 0.85, vpip: 27, survival: 60, base: 0, statDays: ['2026-12-15'], joined: '2026-12-01' },
  { name: 'ゆうひ', skill: 0.3, attend: 0.75, vpip: 25, survival: 64, base: 150, statDays: ['2026-10-31', '2026-12-15'] },
  { name: 'なぎ', skill: -0.25, attend: 0.6, vpip: 38, survival: 45, base: 22, statDays: ['2026-11-28'] },
  { name: 'そら', skill: 0.05, attend: 0.9, vpip: 30, survival: 56, base: 88, statDays: ['2026-10-31', '2026-11-28', '2026-12-15'] },
  { name: 'ひなた', skill: 0.1, attend: 0.65, vpip: 27, survival: 59, base: 64, statDays: [] },
  { name: 'いろは', skill: -0.05, attend: 0.8, vpip: 33, survival: 52, base: 40, statDays: ['2026-11-28'] },
  { name: 'あおい', skill: 0.2, attend: 0.55, vpip: 24, survival: 67, base: 175, statDays: ['2026-10-31'] },
  { name: 'まひろ', skill: -0.3, attend: 0.7, vpip: 41, survival: 42, base: 12, statDays: ['2026-12-15'] },
  { name: 'かえで', skill: 0.0, attend: 0.6, vpip: 29, survival: 57, base: 70, statDays: ['2026-11-28'] },
  { name: 'ことね', skill: 0.15, attend: 0.7, vpip: 26, survival: 61, base: 0, statDays: ['2026-12-15'], joined: '2026-11-03' },
  { name: 'ゆずは', skill: -0.1, attend: 0.6, vpip: 32, survival: 50, base: 52, statDays: ['2026-10-31'], left: '2026-11-14' },
];

/** S32 は「急遽 1 日短縮（11/28 終了）・11/17 休催」の例。 */
const SEASONS: SeasonOverride[] = [{ no: 32, start: '2026-11-01', end: '2026-11-28', toggled: ['2026-11-17'] }];

const SATSUKI_FIXED: Record<string, Rank> = { '2026-10-03': 1, '2026-10-06': 1, '2026-10-08': 5 };
const SATSUKI_STATS: Omit<StatSnapshot, 'id' | 'memberId'> = { date: '2026-10-09', matches: 79, wins: 20, vpip: 28, hands: 1377, createdAt: 0 };

/** mulberry32: 小さく速い決定的乱数。 */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickRank(skill: number, r: () => number): Rank {
  const w = [1, 2, 3, 4, 5, 6].map((k) => Math.exp(-skill * 1.6 * (k - 3.5)));
  let x = r() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < 6; i += 1) {
    x -= w[i]!;
    if (x <= 0) return (i + 1) as Rank;
  }
  return 6;
}

const ts = (date: string, h = 21): number => new Date(`${date}T${String(h).padStart(2, '0')}:30:00`).getTime();

export function buildSampleData(): AppData {
  const r = rng(31);
  const days = [31, 32, 33].flatMap((no) => matchDays(no, SEASONS)).filter((d) => d <= DEMO_TODAY);
  const members: Member[] = [];
  const records: MatchRecord[] = [];
  const snapshots: StatSnapshot[] = [];

  PROFILES.forEach((p, i) => {
    const id = `demo-${i + 1}`;
    const m: Member = { id, name: p.name, archived: !!p.left, order: i, createdAt: ts(p.joined ?? '2026-10-01', 10), baseMatches: p.base };
    if (p.left) m.archivedAt = ts('2026-11-20', 10);
    members.push(m);

    // さつきは実際の画面（10/8 時点で優勝 20 回）に合わせる。
    let wins = p.name === 'さつき' ? 18 : Math.round(p.base * (0.17 + p.skill * 0.12));
    let count = p.base;
    let statIdx = 0;
    const play = (d: string): void => {
      if (p.joined && d < p.joined) return;
      if (p.left && d > p.left) return;
      const fixed = p.name === 'さつき' ? SATSUKI_FIXED[d] : undefined;
      if (!fixed && r() > p.attend) return;
      const rank = fixed ?? pickRank(p.skill, r);
      const part = (r() < 0.45 ? 1 : 2) as 1 | 2;
      const t = ts(d, part === 1 ? 13 : 23);
      records.push({ id: `${id}-${d}`, memberId: id, date: d, rank, part, createdAt: t, updatedAt: t });
      count += 1;
      if (rank === 1) wins += 1;
      if (p.name === 'さつき' && d === '2026-10-08') {
        snapshots.push({ id: `${id}-real`, memberId: id, ...SATSUKI_STATS, createdAt: ts('2026-10-09', 12) });
      }
    };
    const flush = (upTo: string): void => {
      while (statIdx < p.statDays.length && p.statDays[statIdx]! <= upTo) {
        const date = p.statDays[statIdx]!;
        const surv = p.survival + (r() - 0.5) * 4;
        const vpip = Math.round(p.vpip + (r() - 0.5) * 2);
        snapshots.push({
          id: `${id}-s${statIdx}`,
          memberId: id,
          date,
          matches: count,
          wins,
          vpip,
          hands: Math.round(surv * count * (vpip / 100)),
          createdAt: ts(date, 23),
        });
        statIdx += 1;
      }
    };

    for (const d of days) {
      // その日の試合のあとに入力した、という想定でスタッツは当日の記録まで含める。
      play(d);
      flush(d);
    }
    flush(DEMO_TODAY);
  });

  return { members, records, snapshots, seasons: SEASONS };
}
