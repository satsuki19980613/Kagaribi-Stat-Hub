/**
 * グラフで注目するメンバーと、その系列色（slot 0〜7）。
 * 色は選んだときに空いている最小の slot を割り当て、外すまで変えない（順位で塗り替えない）。
 */

export interface FocusEntry {
  id: string;
  slot: number;
}

export const MAX_FOCUS = 8;

export function toggleFocus(focus: readonly FocusEntry[], id: string): FocusEntry[] {
  if (focus.some((f) => f.id === id)) return focus.filter((f) => f.id !== id);
  if (focus.length >= MAX_FOCUS) return [...focus];
  const used = new Set(focus.map((f) => f.slot));
  let slot = 0;
  while (used.has(slot)) slot += 1;
  return [...focus, { id, slot }];
}

export function slotOf(focus: readonly FocusEntry[], id: string): number | null {
  return focus.find((f) => f.id === id)?.slot ?? null;
}

/** 保存値を読み直す（壊れていたら null）。存在しないメンバーは落とす。 */
export function parseFocus(raw: string | null, memberIds: ReadonlySet<string>): FocusEntry[] | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return null;
    const out: FocusEntry[] = [];
    const slots = new Set<number>();
    for (const e of v) {
      if (typeof e !== 'object' || e === null) continue;
      const { id, slot } = e as Record<string, unknown>;
      if (typeof id !== 'string' || !memberIds.has(id)) continue;
      if (typeof slot !== 'number' || !Number.isInteger(slot) || slot < 0 || slot >= MAX_FOCUS || slots.has(slot)) continue;
      slots.add(slot);
      out.push({ id, slot });
    }
    return out;
  } catch {
    return null;
  }
}
