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
  // Use ReturnType<typeof setInterval> for correct browser timer typing
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
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

    // Send initial heartbeat (not 'join' to avoid status change)
    sendHeartbeat('heartbeat');

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

  // EXPLICIT leave action - only called when user clicks "Quitter"
  const handleLeave = useCallback(async () => {
    stopHeartbeat();
    await sendHeartbeat('leave');
  }, [stopHeartbeat, sendHeartbeat]);

  // Handle visibility change - ONLY for heartbeat timing, NOT for status
  useEffect(() => {
    if (!enabled || !gameId) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        isActiveRef.current = false;
        // Do NOT send leave when tab becomes hidden
        // Player stays in the game even when browser is closed
      } else {
        isActiveRef.current = true;
        // Send heartbeat when tab becomes visible again
        sendHeartbeat('heartbeat');
      }
    };

    // NO automatic leave on page hide/unload
    // Players stay in the game until they explicitly click "Quitter"

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, gameId, sendHeartbeat]);

  // Start/stop heartbeat based on enabled state
  useEffect(() => {
    if (enabled && gameId && getPlayerToken()) {
      startHeartbeat();
    } else {
      stopHeartbeat();
    }

    return () => {
      stopHeartbeat();
      // Do NOT send leave on unmount - player stays in game
    };
  }, [enabled, gameId, getPlayerToken, startHeartbeat, stopHeartbeat]);

  return {
    sendHeartbeat,
    handleLeave,
    startHeartbeat,
    stopHeartbeat,
  };
}
