/**
 * 「今日」。デモ版（`npm run build:demo`）ではサンプルデータに合わせた固定の日付を返す。
 */
import { todayIso } from './domain/date';

export const DEMO = import.meta.env.VITE_DEMO === '1';
/** デモ版の「今日」（S33 の途中）。 */
export const DEMO_TODAY = '2026-12-17';

export function today(): string {
  return DEMO ? DEMO_TODAY : todayIso();
}
