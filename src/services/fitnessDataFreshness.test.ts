import { describe, expect, it, vi } from 'vitest';

import { registerFitnessDataFlusher, trackFitnessDataWrite, waitForFreshFitnessData } from './fitnessDataFreshness';

describe('fitnessDataFreshness', () => {
  it('runs registered flushers before resolving freshness waits', async () => {
    const flusher = vi.fn().mockResolvedValue(undefined);
    const unregister = registerFitnessDataFlusher(flusher);

    await waitForFreshFitnessData();

    expect(flusher).toHaveBeenCalledTimes(1);
    unregister();
  });

  it('waits for tracked writes to settle', async () => {
    let resolveWrite: (value: string) => void = () => undefined;
    const write = new Promise<string>((resolve) => {
      resolveWrite = resolve;
    });
    const trackedWrite = trackFitnessDataWrite(write);
    let fresh = false;

    const freshnessWait = waitForFreshFitnessData().then(() => {
      fresh = true;
    });
    await Promise.resolve();

    expect(fresh).toBe(false);
    resolveWrite('ok');
    await freshnessWait;
    await expect(trackedWrite).resolves.toBe('ok');
  });
});
