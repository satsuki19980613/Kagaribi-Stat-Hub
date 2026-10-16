import { describe, expect, it } from 'vitest';
import { nextIndex, placePopup } from './pickerLogic';

describe('nextIndex', () => {
  it('↑↓ で 1 行ずつ動き、端で止まる', () => {
    expect(nextIndex('ArrowDown', 0, 3)).toBe(1);
    expect(nextIndex('ArrowDown', 2, 3)).toBe(2);
    expect(nextIndex('ArrowUp', 1, 3)).toBe(0);
    expect(nextIndex('ArrowUp', 0, 3)).toBe(0);
  });

  it('Home・End・PageUp・PageDown', () => {
    expect(nextIndex('Home', 5, 31)).toBe(0);
    expect(nextIndex('End', 5, 31)).toBe(30);
    expect(nextIndex('PageDown', 5, 31)).toBe(13);
    expect(nextIndex('PageDown', 28, 31)).toBe(30);
    expect(nextIndex('PageUp', 5, 31)).toBe(0);
  });

  it('動かないキーと空の一覧は null', () => {
    expect(nextIndex('a', 0, 3)).toBeNull();
    expect(nextIndex('ArrowDown', 0, 0)).toBeNull();
  });
});

describe('placePopup', () => {
  it('下に余裕があれば下へ、欄の右端にそろえて開く', () => {
    const p = placePopup({ top: 100, bottom: 134, left: 700, right: 1000 }, 1200, 900);
    expect(p).toEqual({ left: 700, top: 138, width: 300, maxHeight: 440 });
  });

  it('欄が狭くても一覧は 280 幅を取り、画面の左端からははみ出さない', () => {
    const p = placePopup({ top: 100, bottom: 134, left: 10, right: 150 }, 360, 800);
    expect(p.width).toBe(280);
    expect(p.left).toBe(8);
  });

  it('画面より広くはしない', () => {
    const p = placePopup({ top: 100, bottom: 134, left: 0, right: 300 }, 260, 800);
    expect(p.width).toBe(244);
    expect(p.left).toBe(8);
  });

  it('下に場所が無く上の方が広ければ上へ開く（欄の上端から下をそろえる）', () => {
    const p = placePopup({ top: 700, bottom: 734, left: 700, right: 1000 }, 1200, 800);
    expect(p.top).toBeUndefined();
    expect(p.bottom).toBe(104);
    expect(p.maxHeight).toBe(440);
  });
});
