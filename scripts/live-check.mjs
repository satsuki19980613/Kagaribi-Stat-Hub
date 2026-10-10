/**
 * 公開しているサイトの確認（読むだけ。.github/workflows/live.yml が毎週走らせる）。
 *
 *   SITE=https://kagaribi-stat-hub.wsk641.workers.dev node scripts/live-check.mjs
 *
 * 1. サイトが開けるか
 * 2. 保護ヘッダが public/_headers の「/*」のとおりに届いているか（Cloudflare の設定がずれていないか）
 * 3. クラブ順位（data/clubs.json）が読めるか
 * 4. Mozilla HTTP Observatory の評価が A+ か
 * どれかが通らなければ失敗で終わる。結果は GitHub の Actions の画面（Summary）にも書く。
 * Summary（ファイル）には決まった文言だけを書き、届いた値（ヘッダ・エラー・Observatory の数字）はログにだけ出す。
 */

import { appendFileSync, readFileSync } from 'node:fs';

const SITE = (process.env.SITE || 'https://kagaribi-stat-hub.wsk641.workers.dev').replace(/\/+$/, '');
const OBSERVATORY = 'https://observatory-api.mdn.mozilla.net/api/v2/scan';
const GRADES = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'];

const lines = [];
let failed = false;
/** label は決まった文言（Summary にも書く）、detail は届いた値（ログにだけ出す）。 */
function report(ok, label, detail = '') {
  if (!ok) failed = true;
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);
  lines.push(`- ${ok ? '✅' : '❌'} ${label}`);
}

/** public/_headers の「/*」の分（全ページ共通のセキュリティヘッダー）。vite.config.ts の siteHeaders と同じ読み方。 */
function expectedHeaders() {
  const headers = {};
  let inAll = false;
  for (const line of readFileSync(new URL('../public/_headers', import.meta.url), 'utf8').split(/\r?\n/)) {
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      inAll = line.trim() === '/*';
      continue;
    }
    const i = line.indexOf(':');
    if (inAll && i > 0) headers[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
  }
  return headers;
}

async function checkSite() {
  const res = await fetch(`${SITE}/`, { redirect: 'manual' });
  report(res.status === 200, `サイト ${SITE}/`, `HTTP ${res.status}`);
  for (const [name, want] of Object.entries(expectedHeaders())) {
    const got = res.headers.get(name);
    report(got === want, `ヘッダ ${name}`, got === want ? '' : `届いた値: ${got ?? '(無し)'}`);
  }
}

async function checkClubs() {
  const res = await fetch(`${SITE}/data/clubs.json`, { cache: 'no-store' });
  let detail = `HTTP ${res.status}`;
  let ok = res.ok;
  if (ok) {
    try {
      const data = await res.json();
      ok = data?.format === 'kagaribi-club-ranking' && Array.isArray(data.rounds);
      detail = ok ? `${data.rounds.length} 節（更新 ${data.updatedAt || '不明'}）` : '形が違う';
    } catch {
      ok = false;
      detail = 'JSON として読めない';
    }
  }
  report(ok, 'クラブ順位 data/clubs.json', detail);
}

async function checkObservatory() {
  const host = new URL(SITE).host;
  const res = await fetch(`${OBSERVATORY}?host=${encodeURIComponent(host)}`, { method: 'POST' });
  if (!res.ok) {
    report(false, 'Mozilla HTTP Observatory', `HTTP ${res.status}`);
    return;
  }
  const r = await res.json();
  if (r.error) {
    report(false, 'Mozilla HTTP Observatory', String(r.error));
    return;
  }
  const grade = GRADES.find((g) => g === r.grade) ?? '不明';
  report(
    grade === 'A+',
    `Mozilla HTTP Observatory ${grade}（https://developer.mozilla.org/en-US/observatory/analyze?host=${host}）`,
    `${r.score} 点、${r.tests_passed}/${r.tests_quantity} 項目合格`,
  );
}

for (const step of [checkSite, checkClubs, checkObservatory]) {
  try {
    await step();
  } catch (e) {
    report(false, `${step.name} が止まった`, e instanceof Error ? e.message : String(e));
  }
}

if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Live\n${lines.join('\n')}\n`);
process.exit(failed ? 1 : 0);
