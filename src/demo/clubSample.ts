/**
 * デモ用のクラブ順位（上位 30）。架空のクラブ 30 + 燎（サンプルの記録の合計）を毎節競わせ、上位 30 を出す。
 * 燎は順位に入った節だけ載る（圏外の節はアプリの記録の合計で線がつながる）。
 */

import { DEMO_TODAY } from '../clock';
import { CLUB_FORMAT, CLUB_VERSION, OWN_CLUB, type ClubData, type ClubEntry, type ClubRound } from '../domain/clubRanking';
import { matchDays } from '../domain/season';
import { clubAppTotals } from '../domain/views';
import { buildSampleData, rng } from './sample';

const NAMES = [
  '宵月', 'Midnight River', 'ナッツ同好会', 'Tilt Proof', '朝凪ポーカー部', 'オールインの森', 'Blue Ace', '三日月亭',
  'ベリーボード', 'Silent Fold', 'こたつ卓', 'River Kings', 'ふわふわスタック', '白夜', 'Check Raise Club', '花冷え',
  'チップリーダーズ', 'Gutshot', '夜更かし組', 'ポケットペア', 'Moonlight Bluff', 'しぐれ荘', 'Lucky Seven', '流星群',
  'ターンの魔物', 'Kicker', '春告鳥', 'フロップ観測所', 'Snowfall', 'まったり卓',
];

export function buildClubSample(): ClubData {
  const app = buildSampleData();
  const r = rng(77);
  const rounds: ClubRound[] = [];
  for (const season of [31, 32, 33]) {
    const days = matchDays(season, app.seasons).filter((d) => d < DEMO_TODAY);
    const own = clubAppTotals(app, season, days.length, DEMO_TODAY);
    const totals = new Map<string, number>(NAMES.map((n) => [n, 0]));
    let prevRank = new Map<string, number>();
    days.forEach((_, i) => {
      const last = new Map(totals);
      NAMES.forEach((n, k) => {
        const mean = 44 - k * 1.1;
        const gain = Math.max(-4, Math.min(50, Math.round(mean + (r() - 0.5) * 22)));
        totals.set(n, (totals.get(n) ?? 0) + gain);
      });
      totals.set(OWN_CLUB, own[i] ?? 0);
      const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
      const clubs: ClubEntry[] = ranked.map(([name, total], j) => {
        return { rank: j + 1, prev: prevRank.get(name) ?? null, name, total, gain: total - (last.get(name) ?? 0) };
      });
      prevRank = new Map(clubs.map((c) => [c.name, c.rank]));
      rounds.push({ season, round: i + 1, clubs });
    });
  }
  return { format: CLUB_FORMAT, version: CLUB_VERSION, updatedAt: `${DEMO_TODAY}T00:00:00Z`, rounds };
}
