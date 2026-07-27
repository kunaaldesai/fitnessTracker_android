import { describe, expect, it } from 'vitest';

import { MOTION_TIMING, resolveMotionPreset } from './motion';

describe('motion presets', () => {
  it('uses fluid motion without delaying interaction', () => {
    expect(resolveMotionPreset(false)).toEqual({
      contentMs: 180,
      sheetMs: 260,
      chartMs: 320,
      translateDistance: 6,
      layoutEnabled: true,
    });
  });

  it('removes spatial motion and caps timing when Reduce Motion is enabled', () => {
    const preset = resolveMotionPreset(true);

    expect(preset.layoutEnabled).toBe(false);
    expect(preset.translateDistance).toBe(0);
    expect(preset.contentMs).toBeLessThanOrEqual(100);
    expect(preset.sheetMs).toBeLessThanOrEqual(100);
    expect(preset.chartMs).toBeLessThanOrEqual(100);
    expect(preset.contentMs).toBe(MOTION_TIMING.reducedContentMs);
  });
});
