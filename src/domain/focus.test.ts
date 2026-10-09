import { describe, expect, it } from 'vitest';
import { MAX_FOCUS, parseFocus, toggleFocus } from './focus';

describe('注目メンバーの色', () => {
  it('空いている最小の slot を割り当て、外しても他の色は変えない', () => {
    let f = toggleFocus([], 'a');
    f = toggleFocus(f, 'b');
    f = toggleFocus(f, 'c');
    f = toggleFocus(f, 'a');
    expect(f).toEqual([
      { id: 'b', slot: 1 },
      { id: 'c', slot: 2 },
    ]);
    f = toggleFocus(f, 'd');
    expect(f.find((e) => e.id === 'd')?.slot).toBe(0);
  });

  it('上限を超えては増えない', () => {
    let f = toggleFocus([], 'x0');
    for (let i = 1; i < MAX_FOCUS + 3; i += 1) f = toggleFocus(f, `x${i}`);
    expect(f).toHaveLength(MAX_FOCUS);
  });

  it('保存値の読み直しで不明なメンバー・重複 slot を落とす', () => {
    const raw = JSON.stringify([{ id: 'a', slot: 0 }, { id: 'gone', slot: 1 }, { id: 'b', slot: 0 }, { id: 'c', slot: 3 }]);
    expect(parseFocus(raw, new Set(['a', 'b', 'c']))).toEqual([
      { id: 'a', slot: 0 },
      { id: 'c', slot: 3 },
    ]);
    expect(parseFocus('{', new Set())).toBeNull();
  });
});
