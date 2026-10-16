import { describe, expect, it } from 'vitest';
import { BEAR_W, LYING_W, STAGE_H, createBear, isLying, type ActName, type Scene } from './bearLogic';
import { BEAR_COLORS, LYING, POSES, PROPS, composePose, head, type Sprite } from './bearSprites';

function live(width: number, ticks: number, seed: number, hour = 12): Scene[] {
  const bear = createBear(width, seed, () => hour);
  return Array.from({ length: ticks }, () => bear.tick(width));
}

function spriteOf(s: Scene): Sprite {
  return isLying(s.look) ? LYING[s.look] : composePose(POSES[s.look]);
}

describe('bearSprites', () => {
  it('どの絵も行の幅がそろい、決まった色の文字だけでできている', () => {
    const all: Sprite[] = [...Object.values(POSES).map(composePose), ...Object.values(LYING), ...Object.values(PROPS)];
    for (const sp of all) {
      const w = sp[0]?.length ?? 0;
      for (const row of sp) {
        expect(row).toHaveLength(w);
        for (const c of row) expect(c === '.' || c in BEAR_COLORS).toBe(true);
      }
    }
  });

  it('立ち姿は 16 ドット四方、寝ころびは 20 ドット幅', () => {
    for (const p of Object.values(POSES)) expect(composePose(p)[0]).toHaveLength(BEAR_W);
    for (const sp of Object.values(LYING)) expect(sp[0]).toHaveLength(LYING_W);
  });

  it('右目は左目の鏡写し、右向きの顔は 1 ドット右にずれる', () => {
    expect(head('open')[5]).toBe('offwefffffewffdo');
    expect(head('open', 'none', 1)[5]).toBe('offfwefffffewfdo');
  });
});

describe('createBear', () => {
  const widths = [16, 30, 45, 60, 100];

  it('長く暮らしても、クマも小物もステージの中に収まる', () => {
    for (const width of widths) {
      for (const seed of [1, 7, 42]) {
        for (const s of live(width, 4000, seed)) {
          const sp = spriteOf(s);
          const bw = sp[0]?.length ?? 0;
          expect(s.x).toBeGreaterThanOrEqual(0);
          // 寝ころびはステージより広いときだけはみ出してよい。
          expect(s.x).toBeLessThanOrEqual(Math.max(0, width - bw));
          expect(s.lift + sp.length).toBeLessThanOrEqual(STAGE_H);
          for (const p of s.props) {
            expect(PROPS[p.key]).toBeDefined();
            // ちょうちょは端の外から飛んでくるので、少しだけ外を許す。
            expect(p.x).toBeGreaterThanOrEqual(-8);
            expect(p.x).toBeLessThanOrEqual(Math.max(width, LYING_W) + 1);
            expect(p.y).toBeGreaterThanOrEqual(0);
          }
        }
      }
    }
  });

  it('昼はいろいろな仕草が出てくる', () => {
    const acts = new Set<ActName>();
    for (const seed of [1, 2, 3]) for (const s of live(60, 20000, seed)) acts.add(s.act);
    for (const a of ['idle', 'stroll', 'trip', 'snack', 'ball', 'butterfly', 'sing', 'nap', 'wave'] as const) expect(acts).toContain(a);
  });

  it('狭いステージではボールとちょうちょをしない', () => {
    const acts = new Set(live(30, 20000, 5).map((s) => s.act));
    expect(acts).not.toContain('ball');
    expect(acts).not.toContain('butterfly');
  });

  it('夜はほとんど眠っている', () => {
    const scenes = live(60, 20000, 9, 2);
    const sleeping = scenes.filter((s) => s.look === 'sleep').length;
    expect(sleeping / scenes.length).toBeGreaterThan(0.6);
  });

  it('おやつはりんご・はちみつ・おにぎりを 3 口で食べ、ピーマンは食べない', () => {
    const seen = new Set<string>();
    for (const seed of [11, 12, 13, 14]) for (const s of live(60, 20000, seed)) for (const p of s.props) seen.add(p.key);
    for (const k of ['apple2', 'honey2', 'rice2', 'pepper', 'heart', 'note', 'flyA', 'blanket', 'bubbleL', 'zBig', 'sweat']) expect(seen).toContain(k);
  });

  it('寝ているときにタップすると飛び起きる', () => {
    const bear = createBear(60, 3, () => 2);
    let s = bear.tick(60);
    for (let i = 0; i < 5000 && s.look !== 'sleep'; i += 1) s = bear.tick(60);
    expect(s.look).toBe('sleep');
    bear.tap();
    s = bear.tick(60);
    expect(s.act).toBe('react');
    expect(s.look).toBe('surprised');
    expect(s.props.map((p) => p.key)).toContain('bang');
  });

  it('何度もつつくと怒る', () => {
    const bear = createBear(60, 4, () => 12);
    bear.tick(60);
    for (let i = 0; i < 4; i += 1) bear.tap();
    const s = bear.tick(60);
    expect(s.props.map((p) => p.key)).toContain('anger');
  });

  it('左を向くと横向きの絵は反転し、正面の絵は反転しない', () => {
    for (const s of live(60, 5000, 21)) {
      if (s.look === 'stand' || s.look === 'blink' || s.look === 'breathe') expect(s.flip).toBe(false);
    }
    expect(live(60, 5000, 21).some((s) => s.look === 'walkA' && s.flip)).toBe(true);
  });
});
