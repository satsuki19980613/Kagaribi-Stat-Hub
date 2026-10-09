/**
 * X の集計ポスト（スレッドをまとめてコピペしたもの）からクラブ順位を読み、clubs.json に足す（同じ節なら置き換える）。
 *
 *   npm run ranking -- --file public/data/clubs.json --in paste.txt [--dry]
 *
 * --in を省くと標準入力から読む。「シーズン31 第3節」の見出しごとに 1 節として読み、古い節から順に前節と突き合わせる。
 * 見出しが無いポスト（1 節ぶんだけ）は --season 31 --round 3 で指定する。
 * 読めなかった行・前節との食い違いを表示する。エラーがあれば何も書き込まない。
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { checkRound, emptyClubData, parseClubData, parseRankingText, serializeClubData, upsertRound } from '../src/domain/clubRanking';

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
let text = input ? readFileSync(input, 'utf8') : readFileSync(0, 'utf8');
const dry = process.argv.includes('--dry');
if (arg('season') && arg('round')) text = `シーズン${arg('season')} 第${arg('round')}節\n${text}`;

const parsed = parseRankingText(text);
let data = existsSync(file) ? parseClubData(JSON.parse(readFileSync(file, 'utf8'))) : emptyClubData();
const now = new Date().toISOString();
let failed = false;

if (parsed.rounds.length === 0) {
  console.log('「シーズンN 第M節」の見出しが見つかりません（--season と --round で指定できます）');
  failed = true;
}
for (const r of parsed.rounds) {
  const { errors, warnings } = checkRound(data, r);
  console.log(`\n=== S${r.season} 第${r.round}節: ${r.clubs.length} クラブ ===`);
  for (const c of [...r.clubs].sort((a, b) => a.rank - b.rank || b.total - a.total)) {
    const gain = c.gain == null ? '—' : c.gain > 0 ? `+${c.gain}` : String(c.gain);
    console.log(`  ${String(c.rank).padStart(2)} (${c.prev ?? '外'})  ${String(c.total).padStart(4)}  ${gain.padStart(4)}  ${c.name}`);
  }
  if (warnings.length) {
    console.log('確認してほしいこと:');
    for (const w of warnings) console.log(`  - ${w}`);
  }
  if (errors.length) {
    console.log('エラー:');
    for (const e of errors) console.log(`  - ${e}`);
    failed = true;
  }
  data = upsertRound(data, r, now);
}
if (parsed.skipped.length) {
  console.log('\n読めなかった行（順位の行に見えるもの）:');
  for (const s of parsed.skipped) console.log(`  ${s}`);
}
if (parsed.conflicts.length) {
  console.log('\n同じ節に違う値で 2 回出てきたもの（先に出た方を使っています）:');
  for (const c of parsed.conflicts) console.log(`  - ${c}`);
}
if (failed) {
  console.log('\nエラーがあるので書き込みません');
  process.exit(1);
}
if (dry) {
  console.log('\n--dry なので書き込みません');
} else {
  writeFileSync(file, serializeClubData(data));
  console.log(`\n${file} に書き込みました`);
}
