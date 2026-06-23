type FitnessDataFlusher = () => Promise<void>;

const flushers = new Set<FitnessDataFlusher>();
const pendingWrites = new Set<Promise<void>>();

export function registerFitnessDataFlusher(flusher: FitnessDataFlusher) {
  flushers.add(flusher);
  return () => {
    flushers.delete(flusher);
  };
}

export function trackFitnessDataWrite<T>(write: Promise<T>): Promise<T> {
  const tracked = write.then(
    () => undefined,
    () => undefined,
  );
  pendingWrites.add(tracked);
  tracked.finally(() => pendingWrites.delete(tracked));
  return write;
}

export async function waitForFreshFitnessData() {
  const activeFlushers = Array.from(flushers);
  if (activeFlushers.length) {
    await Promise.allSettled(activeFlushers.map((flush) => flush()));
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const activeWrites = Array.from(pendingWrites);
    if (!activeWrites.length) return;
    await Promise.allSettled(activeWrites);
  }
}
