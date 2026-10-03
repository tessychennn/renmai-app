import { afterEach, describe, expect, it, vi } from 'vitest';
import { hapticTick } from './haptics';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('觸覺回饋', () => {
  it('支援震動的裝置：呼叫 navigator.vibrate', () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal('navigator', { vibrate });
    hapticTick();
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it('什麼都不支援（沒有 vibrate、沒有 document）時不會丟錯', () => {
    vi.stubGlobal('navigator', {});
    expect(() => hapticTick()).not.toThrow();
  });

  it('vibrate 本身丟錯也不會影響操作', () => {
    vi.stubGlobal('navigator', {
      vibrate: () => {
        throw new Error('blocked');
      },
    });
    expect(() => hapticTick()).not.toThrow();
  });
});
