import { useEffect, useRef } from 'react';

/**
 * Runs `callback` on an interval while the tab is visible.
 * The latest callback is kept in a ref, so polling always uses the
 * freshest state without re-creating the interval.
 */
const usePolling = (callback: () => void, intervalMs = 10000) => {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const tick = () => {
      if (!document.hidden) callbackRef.current();
    };
    const timer = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
};

export default usePolling;
