import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const HEARTBEAT_INTERVAL = 10000; // 10 seconds
const PLAYER_TOKEN_PREFIX = 'ndogmoabeng_player_';

interface UsePlayerPresenceOptions {
  gameId: string | undefined;
  enabled?: boolean;
  onInvalidToken?: () => void;
}

export function usePlayerPresence({ 
  gameId, 
  enabled = true, 
  onInvalidToken 
}: UsePlayerPresenceOptions) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef(true);

  const getPlayerToken = useCallback(() => {
    if (!gameId) return null;
    return localStorage.getItem(`${PLAYER_TOKEN_PREFIX}${gameId}`);
  }, [gameId]);

  const sendHeartbeat = useCallback(async (action: 'heartbeat' | 'join' | 'leave' = 'heartbeat') => {
    const playerToken = getPlayerToken();
    if (!gameId || !playerToken) return false;

    try {
      console.log(`[Presence] Sending ${action} for game ${gameId}`);
      const { data, error } = await supabase.functions.invoke('player-heartbeat', {
        body: { gameId, playerToken, action },
      });

      if (error) {
        console.error('[Presence] Heartbeat error:', error);
        return false;
      }

      if (data?.valid === false) {
        console.warn('[Presence] Token invalid');
        onInvalidToken?.();
        return false;
      }

      console.log(`[Presence] ${action} successful`);
      return true;
    } catch (err) {
      console.error('[Presence] Heartbeat failed:', err);
      return false;
    }
  }, [gameId, getPlayerToken, onInvalidToken]);

  const startHeartbeat = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Send initial join heartbeat
    sendHeartbeat('join');

    // Start periodic heartbeat
    intervalRef.current = setInterval(() => {
      if (isActiveRef.current) {
        sendHeartbeat('heartbeat');
      }
    }, HEARTBEAT_INTERVAL);

    console.log('[Presence] Heartbeat started');
  }, [sendHeartbeat]);

  const stopHeartbeat = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    console.log('[Presence] Heartbeat stopped');
  }, []);

  const handleLeave = useCallback(async () => {
    stopHeartbeat();
    await sendHeartbeat('leave');
  }, [stopHeartbeat, sendHeartbeat]);

  // Handle visibility change
  useEffect(() => {
    if (!enabled || !gameId) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        isActiveRef.current = false;
        // Try to send leave when tab becomes hidden
        sendHeartbeat('leave');
      } else {
        isActiveRef.current = true;
        // Resume heartbeat when tab becomes visible
        sendHeartbeat('join');
      }
    };

    const handlePageHide = () => {
      // Best effort leave on page hide
      sendHeartbeat('leave');
    };

    const handleBeforeUnload = () => {
      // Best effort leave on page unload
      // Use sendBeacon for reliability
      const playerToken = getPlayerToken();
      if (gameId && playerToken) {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/player-heartbeat`;
        navigator.sendBeacon(url, JSON.stringify({
          gameId,
          playerToken,
          action: 'leave'
        }));
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [enabled, gameId, sendHeartbeat, getPlayerToken]);

  // Start/stop heartbeat based on enabled state
  useEffect(() => {
    if (enabled && gameId && getPlayerToken()) {
      startHeartbeat();
    } else {
      stopHeartbeat();
    }

    return () => {
      stopHeartbeat();
    };
  }, [enabled, gameId, getPlayerToken, startHeartbeat, stopHeartbeat]);

  return {
    sendHeartbeat,
    handleLeave,
    startHeartbeat,
    stopHeartbeat,
  };
}
