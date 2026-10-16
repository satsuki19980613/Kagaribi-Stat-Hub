import { describe, expect, it } from 'vitest';
import { BALL_W, BEAR_W, bearPose, initialBear, poke, seededRand, stepBear, type BearState } from './bearLogic';
import { BALL_FRAMES, BEAR_COLORS, BEAR_FRAMES, HEART, ZZZ } from './bearSprites';

const W = 40;

function run(s: BearState, n: number, width = W, seed = 1): BearState[] {
  const rand = seededRand(seed);
  const out: BearState[] = [];
  let cur = s;
  for (let i = 0; i < n; i += 1) {
    cur = stepBear(cur, width, rand);
    out.push(cur);
  }
  return out;
}

describe('bearSprites', () => {
  it('どの絵も行の幅がそろい、決まった色の文字だけでできている', () => {
    const all = [...Object.values(BEAR_FRAMES), ...BALL_FRAMES, HEART, ZZZ];
    for (const sp of all) {
      const w = sp[0]?.length;
      for (const row of sp) {
        expect(row.length).toBe(w);
        for (const c of row) expect(c === '.' || c in BEAR_COLORS).toBe(true);
      }
    }
  });
});

describe('stepBear', () => {
  it('長く動かしても、クマもボールもステージからはみ出さない', () => {
    for (const seed of [1, 2, 3, 42]) {
      const states = run(initialBear(W, seededRand(seed)), 3000, W, seed);
      for (const s of states) {
        expect(s.x).toBeGreaterThanOrEqual(0);
        expect(s.x).toBeLessThanOrEqual(W - BEAR_W);
        if (s.ball != null) {
          expect(s.ball).toBeGreaterThanOrEqual(0);
          expect(s.ball).toBeLessThanOrEqual(W - BALL_W);
        }
      }
      // 歩く・寝る・遊ぶ・跳ねるが、どれも一度は出てくる。
      expect(new Set(states.map((s) => s.mode))).toEqual(new Set(['idle', 'walk', 'sleep', 'play', 'hop']));
    }
  });

  it('歩くと行き先に着いて次の様子に移る', () => {
    const s: BearState = { mode: 'walk', t: 0, dur: 999, x: 2, dir: 1, goal: 6, ball: null };
    const states = run(s, 5);
    expect(states.slice(0, 4).map((x) => x.x)).toEqual([3, 4, 5, 6]);
    expect(states[4]?.mode).not.toBe('walk');
  });

  it('幅が縮んで行き先が外に出ても、端で止まって次の様子に移る', () => {
    const s: BearState = { mode: 'walk', t: 0, dur: 999, x: 10, dir: 1, goal: 30, ball: null };
    const states = run(s, 20, 20);
    expect(states.some((x) => x.mode !== 'walk')).toBe(true);
  });

  it('ボールを端まで転がすと跳ねる', () => {
    const s: BearState = { mode: 'play', t: 0, dur: 999, x: 0, dir: 1, goal: 0, ball: BEAR_W + 1 };
    const states = run(s, 60);
    const hop = states.findIndex((x) => x.mode === 'hop');
    expect(hop).toBeGreaterThan(0);
    expect(states[hop - 1]?.ball).toBe(W - BALL_W);
  });

  it('タップすると寝ていても起きて跳ねる', () => {
    const s: BearState = { mode: 'sleep', t: 3, dur: 50, x: 5, dir: 1, goal: 0, ball: null };
    const p = poke(s);
    expect(p.mode).toBe('hop');
    expect(bearPose(p).frame).toBe('crouch');
    expect(bearPose({ ...p, t: 1 }).frame).toBe('cheer');
  });
});

describe('bearPose', () => {
  it('左へ歩くときは反転し、寝ているときは寝ころんだ絵', () => {
    const base: BearState = { mode: 'walk', t: 0, dur: 999, x: 5, dir: -1, goal: 0, ball: null };
    expect(bearPose(base)).toEqual({ frame: 'walkA', lift: 0, flip: true });
    expect(bearPose({ ...base, t: 1 })).toEqual({ frame: 'walkB', lift: 1, flip: true });
    expect(bearPose({ ...base, mode: 'sleep' }).frame).toBe('sleep');
    expect(bearPose({ ...base, mode: 'idle', t: 21 }).frame).toBe('blink');
  });
});
