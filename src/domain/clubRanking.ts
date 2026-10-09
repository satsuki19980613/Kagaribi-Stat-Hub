/**
 * クラブマッチの順位（上位 30 クラブ）。X の集計ポスト（@c0pmvd）を AI が取り込み、
 * データ用の公開リポジトリの clubs.json に置く。アプリはネットにつながったときにそれを読む。
 *
 * ポストの 1 行は「順位(前節の順位) 累計 +その節の得点 メダル クラブ名」:
 *   1(1) 138 +50 🥇 SB from リンプして時雨
 *
 * ここは純関数だけ（取り込みスクリプト scripts/club-ranking.ts からも使う）。
 */

export const CLUB_FORMAT = 'kagaribi-club-ranking';
export const CLUB_VERSION = 1;
/** 自分のクラブの名前（順位に入っていれば公式の値を使う）。 */
export const OWN_CLUB = '燎';
/** クラブの定員。他クラブの人数はポストに無いので、1 人あたりは累計 ÷ 定員で見る。 */
export const CLUB_CAPACITY = 20;

export interface ClubEntry {
  rank: number;
  /** 前節の順位（圏外・初登場は null）。 */
  prev: number | null;
  name: string;
  /** そのシーズンの累計。 */
  total: number;
  /** その節の得点。 */
  gain: number;
}

export interface ClubRound {
  season: number;
  /** 第 N 節（シーズンの N 番目の開催日）。 */
  round: number;
  clubs: ClubEntry[];
}

export interface ClubData {
  format: typeof CLUB_FORMAT;
  version: typeof CLUB_VERSION;
  updatedAt: string;
  rounds: ClubRound[];
}

export function emptyClubData(): ClubData {
  return { format: CLUB_FORMAT, version: CLUB_VERSION, updatedAt: '', rounds: [] };
}

const toHalf = (s: string): string => s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

// 「1(1) 138 +50 🥇 名前」。前節は (-) (NEW) (圏外) なども許す。
const LINE = /^\s*(\d+)\s*[(（]\s*([^)）]*)\s*[)）]\s*(-?\d+)\s*(?:pt|Pt|PT)?\s+([+＋\-−－±]\s*\d+)\s*(?:pt|Pt|PT)?\s*(.*)$/;
// 名前の前に付く記号（メダル・矢印など）。クラブ名の中の絵文字は消さない。
const LEAD = /^(?:[\u{1F947}-\u{1F949}\u{1F3C5}\u{1F396}\u{1F451}\u{1F525}\u{2B06}\u{2B07}\u{2197}\u{2198}\u{27A1}\u{2191}\u{2193}\u{2934}\u{2935}\u{FE0F}↑↓→]\s*)+/u;
const HEAD = /シーズン\s*(\d+)\s*第\s*(\d+)\s*節/;

export interface ParsedRanking {
  season: number | null;
  round: number | null;
  clubs: ClubEntry[];
  /** 読めなかった行のうち、順位の行に見えるもの。 */
  skipped: string[];
}

/** X のポスト（スレッド全体をコピペしたもの）から順位を読む。関係ない行（名前・時刻・いいね数など）は無視する。 */
export function parseRankingText(text: string): ParsedRanking {
  let season: number | null = null;
  let round: number | null = null;
  const clubs: ClubEntry[] = [];
  const skipped: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = toHalf(raw.normalize('NFC')).trim();
    if (!line) continue;
    const h = HEAD.exec(line);
    if (h && season == null) {
      season = Number(h[1]);
      round = Number(h[2]);
      continue;
    }
    const m = LINE.exec(line);
    if (!m) {
      if (/^\d+\s*[(（]/.test(line)) skipped.push(raw.trim());
      continue;
    }
    const prevText = m[2]!.trim();
    const sign = m[4]!.replace(/\s/g, '');
    const gainAbs = Number(sign.slice(1));
    const name = m[5]!.replace(LEAD, '').trim();
    if (!name) {
      skipped.push(raw.trim());
      continue;
    }
    clubs.push({
      rank: Number(m[1]),
      prev: /^\d+$/.test(prevText) ? Number(prevText) : null,
      name,
      total: Number(m[3]),
      gain: /^[-−－]/.test(sign) ? -gainAbs : gainAbs,
    });
  }
  return { season, round, clubs, skipped };
}

/** 取り込む前の確認。errors があれば取り込まない。warnings は目で確かめる。 */
export function checkRound(data: ClubData, r: ClubRound): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!Number.isInteger(r.season) || r.season < 1) errors.push('シーズンが読めません');
  if (!Number.isInteger(r.round) || r.round < 1) errors.push('節が読めません');
  if (r.clubs.length === 0) errors.push('順位の行がありません');
  const ranks = r.clubs.map((c) => c.rank);
  const dupRank = ranks.filter((x, i) => ranks.indexOf(x) !== i);
  if (dupRank.length) errors.push(`同じ順位が 2 つあります: ${[...new Set(dupRank)].join(', ')}`);
  const names = r.clubs.map((c) => c.name);
  const dupName = names.filter((x, i) => names.indexOf(x) !== i);
  if (dupName.length) errors.push(`同じクラブが 2 回あります: ${[...new Set(dupName)].join(', ')}`);
  if (r.clubs.length !== 30) warnings.push(`クラブ数が ${r.clubs.length} です（ふつうは 30）`);
  const sorted = [...r.clubs].sort((a, b) => a.rank - b.rank);
  sorted.forEach((c, i) => {
    const next = sorted[i + 1];
    if (next && next.total > c.total) warnings.push(`${c.rank}位 ${c.name}（${c.total}）より ${next.rank}位 ${next.name}（${next.total}）の累計が多い`);
  });
  const max = Math.max(0, ...ranks);
  const missing: number[] = [];
  for (let k = 1; k <= max; k += 1) if (!ranks.includes(k)) missing.push(k);
  // 同点で順位が飛ぶ（1, 1, 3）のはありうるので警告だけ。
  if (missing.length) warnings.push(`抜けている順位: ${missing.join(', ')}（同点なら問題なし）`);

  const before = data.rounds.find((x) => x.season === r.season && x.round === r.round - 1);
  if (r.round === 1) {
    for (const c of r.clubs) if (c.total !== c.gain) warnings.push(`第1節なのに累計と得点が違う: ${c.name}`);
  } else if (before) {
    for (const c of r.clubs) {
      const p = before.clubs.find((x) => x.name === c.name);
      if (!p) {
        if (c.prev != null) warnings.push(`${c.name}: 前節の順位 ${c.prev} とあるが、前節のデータにいない（名前の表記ゆれ？）`);
        continue;
      }
      if (p.total + c.gain !== c.total) warnings.push(`${c.name}: 前節 ${p.total} + ${c.gain} ≠ ${c.total}`);
      if (c.prev != null && c.prev !== p.rank) warnings.push(`${c.name}: 前節の順位が ${c.prev} とあるが、前節のデータでは ${p.rank} 位`);
    }
  } else {
    warnings.push(`前節（第${r.round - 1}節）のデータがないので、累計の突き合わせはしていません`);
  }
  return { errors, warnings };
}

/** 同じシーズン・節があれば置き換えて足す（シーズン・節の順に並べる）。 */
export function upsertRound(data: ClubData, r: ClubRound, now: string): ClubData {
  const rounds = data.rounds.filter((x) => !(x.season === r.season && x.round === r.round));
  rounds.push({ ...r, clubs: [...r.clubs].sort((a, b) => a.rank - b.rank) });
  rounds.sort((a, b) => a.season - b.season || a.round - b.round);
  return { format: CLUB_FORMAT, version: CLUB_VERSION, updatedAt: now, rounds };
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

/** 読み込んだ JSON を確かめる。形が違えば例外。 */
export function parseClubData(raw: unknown): ClubData {
  const o = raw as Partial<ClubData> | null;
  if (!o || o.format !== CLUB_FORMAT) throw new Error('クラブ順位のデータではありません');
  if (o.version !== CLUB_VERSION) throw new Error(`対応していない版です（${String(o.version)}）`);
  if (!Array.isArray(o.rounds)) throw new Error('rounds がありません');
  const rounds = o.rounds.map((r, i) => {
    if (!r || !isInt(r.season) || !isInt(r.round) || !Array.isArray(r.clubs)) throw new Error(`rounds[${i}] の形が違います`);
    const clubs = r.clubs.map((c, j) => {
      if (!c || !isInt(c.rank) || !isInt(c.total) || !isInt(c.gain) || typeof c.name !== 'string' || !(c.prev === null || isInt(c.prev))) {
        throw new Error(`rounds[${i}].clubs[${j}] の形が違います`);
      }
      return { rank: c.rank, prev: c.prev, name: c.name, total: c.total, gain: c.gain };
    });
    return { season: r.season, round: r.round, clubs };
  });
  return { format: CLUB_FORMAT, version: CLUB_VERSION, updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : '', rounds };
}

// ===== スタッツビュー用 =====

export function roundsOf(data: ClubData, season: number): ClubRound[] {
  return data.rounds.filter((r) => r.season === season).sort((a, b) => a.round - b.round);
}

/** その節までの最新の順位表（グラフで選ぶクラブの並び）。 */
export function latestRound(data: ClubData, season: number): ClubRound | null {
  return roundsOf(data, season).at(-1) ?? null;
}

/** 第 1〜n 節のクラブの累計（その節の順位に入っていなければ null）。 */
export function clubSeries(data: ClubData, season: number, name: string, n: number): (number | null)[] {
  const rs = roundsOf(data, season);
  return Array.from({ length: n }, (_, i) => rs.find((r) => r.round === i + 1)?.clubs.find((c) => c.name === name)?.total ?? null);
}

/** 第 1〜n 節の上位クラブの累計の平均（その節のデータが無ければ null）。 */
export function topAverage(data: ClubData, season: number, n: number): (number | null)[] {
  const rs = roundsOf(data, season);
  return Array.from({ length: n }, (_, i) => {
    const r = rs.find((x) => x.round === i + 1);
    if (!r || r.clubs.length === 0) return null;
    return r.clubs.reduce((a, c) => a + c.total, 0) / r.clubs.length;
  });
}

/**
 * メンバーのグラフに重ねる他クラブの 1 人あたり（累計 ÷ 定員）。pick は 'avg'（上位 30 平均）かクラブ名。
 * 第 1〜n 節の値（無い節は null）。
 */
export function perMemberSeries(data: ClubData, season: number, pick: string, n: number): (number | null)[] {
  const vs = pick === 'avg' ? topAverage(data, season, n) : clubSeries(data, season, pick, n);
  return vs.map((v) => (v == null ? null : v / CLUB_CAPACITY));
}

/**
 * 自分のクラブの累計。順位に入っている節は公式の値、入っていない節はアプリの記録の合計（appTotals）を使う。
 * official は公式の値を使った節の印。
 */
export function ownSeries(data: ClubData, season: number, appTotals: readonly (number | null)[]): { values: (number | null)[]; official: boolean[] } {
  const off = clubSeries(data, season, OWN_CLUB, appTotals.length);
  return {
    values: appTotals.map((v, i) => off[i] ?? v),
    official: off.map((v) => v != null),
  };
}

/** clubs.json の書き出し（1 クラブ 1 行にして差分を読みやすくする）。 */
export function serializeClubData(d: ClubData): string {
  const rounds = d.rounds
    .map((r) => {
      const clubs = r.clubs.map((c) => `    ${JSON.stringify(c)}`).join(',\n');
      return `  {"season": ${r.season}, "round": ${r.round}, "clubs": [\n${clubs}\n  ]}`;
    })
    .join(',\n');
  return `{\n "format": ${JSON.stringify(d.format)},\n "version": ${d.version},\n "updatedAt": ${JSON.stringify(d.updatedAt)},\n "rounds": [\n${rounds}\n ]\n}\n`;
}
