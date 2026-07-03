import { useCallback, useRef, useState } from "react";

/**
 * Stopwatch driven by requestAnimationFrame, always reading elapsed time from
 * performance.now() deltas rather than counting ticks — a tick pause (tab
 * switch, throttling) never causes drift. See docs/03_TECH_KONZEPT.md §9.
 */
export function useStopwatch() {
  const [elapsedS, setElapsedS] = useState(0);
  const [running, setRunning] = useState(false);
  const startedAtRef = useRef<number | null>(null);
  const accumulatedRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const tick = useCallback(() => {
    if (startedAtRef.current !== null) {
      const now = performance.now();
      setElapsedS((accumulatedRef.current + (now - startedAtRef.current)) / 1000);
      rafRef.current = requestAnimationFrame(tick);
    }
  }, []);

  const start = useCallback(() => {
    startedAtRef.current = performance.now();
    setRunning(true);
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const stop = useCallback(() => {
    if (startedAtRef.current !== null) {
      accumulatedRef.current += performance.now() - startedAtRef.current;
      startedAtRef.current = null;
    }
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    setRunning(false);
  }, []);

  const reset = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    startedAtRef.current = null;
    accumulatedRef.current = 0;
    setElapsedS(0);
    setRunning(false);
  }, []);

  return { elapsedS, running, start, stop, reset };
}
