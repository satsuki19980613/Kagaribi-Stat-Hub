/** 'YYYY-MM-DD'（ローカル日付）の小さな道具箱。文字列のまま比較できる形にそろえる。 */

const p2 = (n: number): string => String(n).padStart(2, '0');

export function isoOf(y: number, m: number, d: number): string {
  return `${y}-${p2(m)}-${p2(d)}`;
}

export function todayIso(now: Date = new Date()): string {
  return isoOf(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function parseIso(s: string): { y: number; m: number; d: number } {
  const [y, m, d] = s.split('-').map(Number);
  return { y: y ?? 0, m: m ?? 0, d: d ?? 0 };
}

export function isIsoDate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const { y, m, d } = parseIso(s);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

export function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

/** 0=日 … 6=土。 */
export function weekdayOf(s: string): number {
  const { y, m, d } = parseIso(s);
  return new Date(y, m - 1, d).getDay();
}

export function addDays(s: string, n: number): string {
  const { y, m, d } = parseIso(s);
  const t = new Date(y, m - 1, d + n);
  return isoOf(t.getFullYear(), t.getMonth() + 1, t.getDate());
}

/** start〜end（両端含む）の日付を順に並べる。 */
export function eachDay(start: string, end: string): string[] {
  const out: string[] = [];
  for (let s = start; s <= end; s = addDays(s, 1)) out.push(s);
  return out;
}

const WD = ['日', '月', '火', '水', '木', '金', '土'];

export function weekdayLabel(s: string): string {
  return WD[weekdayOf(s)] ?? '';
}

/** 10/3(土) */
export function shortDate(s: string): string {
  const { m, d } = parseIso(s);
  return `${m}/${d}(${weekdayLabel(s)})`;
}

/** 2026/10/03 */
export function longDate(s: string): string {
  return s.replace(/-/g, '/');
}
