/**
 * 基本スタッツ（優勝回数・VPIP・参加ハンド数）の入力を読む。メンバー画面と記録画面で共通。
 * どれも任意。ただし生存ターン数に使う VPIP と参加ハンド数はセットで入れる。
 */

export interface StatText {
  wins: string;
  vpip: string;
  hands: string;
}

export interface StatValues {
  wins?: number;
  vpip?: number;
  hands?: number;
}

export const EMPTY_STAT_TEXT: StatText = { wins: '', vpip: '', hands: '' };

/** 数値入力の文字列を読む。空なら undefined、数でなければ NaN。全角数字・カンマ・% も受け付ける。 */
export function readNum(s: string): number | undefined {
  const t = s.trim().replace(/[,，%％]/g, '');
  if (t === '') return undefined;
  const n = Number(t.replace(/[０-９．]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)));
  return Number.isFinite(n) ? n : NaN;
}

export function isBlankStat(t: StatText): boolean {
  return t.wins.trim() === '' && t.vpip.trim() === '' && t.hands.trim() === '';
}

/**
 * 入力を検証して数値にする。何も入っていなければ values は null。
 * matches はその時点の参加回数（優勝回数の上限チェックと、スタッツを入れる前提に使う）。
 */
export function parseStatText(t: StatText, matches: number): { values: StatValues | null; issues: string[] } {
  const issues: string[] = [];
  const w = readNum(t.wins);
  const v = readNum(t.vpip);
  const h = readNum(t.hands);
  if (w !== undefined && (!Number.isInteger(w) || w < 0)) issues.push('優勝回数は 0 以上の整数で入力してください。');
  else if (w !== undefined && w > matches) issues.push('優勝回数が参加回数を超えています。');
  if (v !== undefined && !(v > 0 && v <= 100)) issues.push('VPIP は 0〜100 の % で入力してください。');
  if (h !== undefined && (!Number.isInteger(h) || h < 0)) issues.push('参加ハンド数は 0 以上の整数で入力してください。');
  if ((v === undefined) !== (h === undefined)) issues.push('VPIP と参加ハンド数はセットで入力してください（生存ターン数の計算に両方使います）。');
  if ((v !== undefined || h !== undefined) && matches === 0) issues.push('スタッツを入れるときは参加回数も入力してください。');
  if (issues.length) return { values: null, issues };
  if (w === undefined && v === undefined && h === undefined) return { values: null, issues };
  return { values: { ...(w !== undefined ? { wins: w } : {}), ...(v !== undefined ? { vpip: v } : {}), ...(h !== undefined ? { hands: h } : {}) }, issues };
}
