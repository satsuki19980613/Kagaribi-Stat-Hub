/**
 * X の集計ポスト（コピペ）からクラブ順位を読み、clubs.json に 1 節ぶん足す（同じ節なら置き換える）。
 *
 *   npm run ranking -- --file ../kagaribi-club-data/clubs.json --in paste.txt [--season 31 --round 3] [--dry]
 *
 * --in を省くと標準入力から読む。シーズン・節はポストの「シーズン31 第3節」から読み、引数があればそちらを使う。
 * 読めなかった行・前節との食い違いを表示する。エラーがあれば書き込まない。
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { checkRound, emptyClubData, parseClubData, parseRankingText, serializeClubData, upsertRound, type ClubRound } from '../src/domain/clubRanking';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const file = arg('file');
if (!file) {
  console.error('--file <clubs.json> が必要です');
  process.exit(2);
}
const input = arg('in');
const text = input ? readFileSync(input, 'utf8') : readFileSync(0, 'utf8');
const dry = process.argv.includes('--dry');

const parsed = parseRankingText(text);
const season = Number(arg('season') ?? parsed.season ?? NaN);
const round = Number(arg('round') ?? parsed.round ?? NaN);
const data = existsSync(file) ? parseClubData(JSON.parse(readFileSync(file, 'utf8'))) : emptyClubData();
const r: ClubRound = { season, round, clubs: parsed.clubs };
const { errors, warnings } = checkRound(data, r);

console.log(`S${season} 第${round}節: ${parsed.clubs.length} クラブ`);
for (const c of [...parsed.clubs].sort((a, b) => a.rank - b.rank)) {
  const gain = c.gain > 0 ? `+${c.gain}` : String(c.gain);
  console.log(`  ${String(c.rank).padStart(2)} (${c.prev ?? '-'})  ${String(c.total).padStart(4)}  ${gain.padStart(4)}  ${c.name}`);
}
if (parsed.skipped.length) {
  console.log('\n読めなかった行（順位の行に見えるもの）:');
  for (const s of parsed.skipped) console.log(`  ${s}`);
}
if (warnings.length) {
  console.log('\n確認してほしいこと:');
  for (const w of warnings) console.log(`  - ${w}`);
}
if (errors.length) {
  console.log('\nエラー（書き込みません）:');
  for (const e of errors) console.log(`  - ${e}`);
  process.exit(1);
}
if (dry) {
  console.log('\n--dry なので書き込みません');
} else {
  writeFileSync(file, serializeClubData(upsertRound(data, r, new Date().toISOString())));
  console.log(`\n${file} に書き込みました`);
}
