import { useRef, useCallback, useEffect } from 'react';

/**
 * Custom hook for throttled realtime event handling.
 * Groups rapid-fire realtime events and calls the callback at most once per delay.
 * 
 * Key features:
 * - Avoids "refetch storms" when multiple realtime events fire rapidly
 * - Uses trailing edge throttle: executes after delay, not immediately
 * - Stable callback reference prevents stale closures in Supabase handlers
 * - Proper cleanup on unmount
 */
export function useRealtimeThrottle<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number = 250
): { throttledFn: () => void; cancel: () => void } {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);
  const pendingRef = useRef(false);
  const isMountedRef = useRef(true);

  // Always keep callback ref updated to avoid stale closures
  // This is critical for realtime handlers that capture fetchData
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  const throttledFn = useCallback(() => {
    // Mark that we have a pending execution
    pendingRef.current = true;

    // If no timeout is scheduled, schedule one
    if (!timeoutRef.current) {
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        
        // Only execute if still mounted and has pending work
        if (isMountedRef.current && pendingRef.current) {
          pendingRef.current = false;
          callbackRef.current();
        }
      }, delay);
    }
  }, [delay]);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    pendingRef.current = false;
  }, []);

  return { throttledFn, cancel };
}

/**
 * Creates a stable function reference that always calls the latest callback.
 * Useful for Supabase realtime handlers to prevent stale closures.
 * 
 * Usage:
 * const stableFetch = useStableCallback(fetchData);
 * // Use stableFetch in realtime handlers - it will always call latest fetchData
 */
export function useStableCallback<T extends (...args: unknown[]) => unknown>(
  callback: T
): T {
  const callbackRef = useRef(callback);
  
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Return a stable function that delegates to the ref
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(
    ((...args: Parameters<T>) => callbackRef.current(...args)) as T,
    []
  );
}
