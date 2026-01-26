import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { CinematicSequence } from '@/components/adventure/AdventureCinematicOverlay';
import type { DebugState } from '@/components/adventure/AdventureCinematicDebugPanel';

const LA_CARTE_TROUVEE_ID = 'a1b2c3d4-5678-9012-3456-789012345678';

interface AdventureCinematicEvent {
  id: string;
  event_type: string;
  payload: {
    adventure_id: string;
    sequence: CinematicSequence[];
    broadcast_id: string;
  };
  created_at: string;
}

interface UseAdventureCinematicOptions {
  enabled?: boolean;
}

export function useAdventureCinematic(
  gameId: string | undefined,
  options: UseAdventureCinematicOptions = {}
) {
  const { enabled = true } = options;
  
  const [isOpen, setIsOpen] = useState(false);
  const [currentSequence, setCurrentSequence] = useState<CinematicSequence[]>([]);
  const [debugState, setDebugState] = useState<DebugState>({
    gameId: gameId || null,
    mode: null,
    adventureId: null,
    adventureName: null,
    hookActive: enabled,
    channelName: null,
    lastReceivedEvent: null,
    lastBroadcastAttempt: null,
    overlayOpen: false,
    currentSequence: [],
  });
  
  const lastBroadcastIdRef = useRef<string | null>(null);
  const hasCheckedInitialRef = useRef(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Update debug state when overlay state changes
  useEffect(() => {
    setDebugState(prev => ({
      ...prev,
      gameId: gameId || null,
      hookActive: enabled,
      overlayOpen: isOpen,
      currentSequence,
    }));
  }, [gameId, enabled, isOpen, currentSequence]);

  // Close the overlay
  const closeOverlay = useCallback(() => {
    console.log('[CINEMATIC][OVERLAY] Closing overlay');
    setIsOpen(false);
  }, []);

  // Replay locally (just restart the current sequence)
  const replayLocal = useCallback(() => {
    if (currentSequence.length > 0) {
      console.log('[CINEMATIC][OVERLAY] Replaying locally:', currentSequence);
      setIsOpen(false);
      setTimeout(() => setIsOpen(true), 100);
    }
  }, [currentSequence]);

  // Broadcast a cinematic to all players
  const broadcastCinematic = useCallback(async (
    sequence: CinematicSequence[],
    broadcastId?: string
  ) => {
    if (!gameId) {
      console.error('[CINEMATIC][BROADCAST] No gameId provided');
      return;
    }

    // Get current auth session for debugging
    const { data: sessionData } = await supabase.auth.getSession();
    const authUserId = sessionData?.session?.user?.id || null;

    console.log('[CINEMATIC][BROADCAST] Auth check:', {
      gameId,
      authUserId,
      hasSession: !!sessionData?.session,
    });

    // Check if user is host
    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .select('host_user_id')
      .eq('id', gameId)
      .single();

    console.log('[CINEMATIC][BROADCAST] Host check:', {
      hostUserId: gameData?.host_user_id,
      authUserId,
      isHost: gameData?.host_user_id === authUserId,
      gameError: gameError?.message,
    });

    const id = broadcastId || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const payload = {
      adventure_id: LA_CARTE_TROUVEE_ID,
      sequence,
      broadcast_id: id,
    };

    console.log('[CINEMATIC][BROADCAST] Attempting insert:', {
      gameId,
      sequence,
      payload,
    });

    const { data, error } = await supabase
      .from('game_events')
      .insert({
        game_id: gameId,
        visibility: 'PUBLIC',
        event_type: 'ADVENTURE_CINEMATIC',
        message: 'Adventure cinematic',
        payload,
      })
      .select()
      .single();

    const timestamp = new Date().toLocaleTimeString();

    if (error) {
      console.error('[CINEMATIC][BROADCAST] Insert error:', error);
      console.error('[CINEMATIC][BROADCAST] Full error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      setDebugState(prev => ({
        ...prev,
        lastBroadcastAttempt: {
          timestamp,
          sequence,
          success: false,
          error: `${error.message} (auth: ${authUserId?.slice(0, 8) || 'none'}, host: ${gameData?.host_user_id?.slice(0, 8) || 'unknown'})`,
        },
      }));
    } else {
      console.log('[CINEMATIC][BROADCAST] Insert success:', data);
      setDebugState(prev => ({
        ...prev,
        lastBroadcastAttempt: {
          timestamp,
          sequence,
          success: true,
        },
      }));
      // Also show locally for the broadcaster
      lastBroadcastIdRef.current = id;
      setCurrentSequence(sequence);
      setIsOpen(true);
    }
  }, [gameId]);

  // Subscribe to cinematic events
  useEffect(() => {
    if (!gameId || !enabled) {
      console.log('[CINEMATIC][SUBSCRIBE] Skipping - gameId:', gameId, 'enabled:', enabled);
      return;
    }

    const channelName = `adventure-cinematic-${gameId}`;
    console.log('[CINEMATIC][SUBSCRIBE] Setting up channel:', channelName);

    setDebugState(prev => ({
      ...prev,
      channelName,
    }));

    // Initial fetch: check for recent cinematic events (within 2 minutes)
    const checkRecentEvent = async () => {
      if (hasCheckedInitialRef.current) return;
      hasCheckedInitialRef.current = true;

      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

      console.log('[CINEMATIC][INITIAL_FETCH] Checking for recent events since:', twoMinutesAgo);

      const { data, error } = await supabase
        .from('game_events')
        .select('id, event_type, payload, created_at')
        .eq('game_id', gameId)
        .eq('event_type', 'ADVENTURE_CINEMATIC')
        .eq('visibility', 'PUBLIC')
        .gte('created_at', twoMinutesAgo)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('[CINEMATIC][INITIAL_FETCH] Error:', error);
        return;
      }

      console.log('[CINEMATIC][INITIAL_FETCH] Result:', data);

      if (data && data.length > 0) {
        const event = data[0] as unknown as AdventureCinematicEvent;
        const eventPayload = event.payload;
        
        if (eventPayload?.sequence) {
          // Don't replay if we already saw this broadcast
          if (lastBroadcastIdRef.current !== eventPayload.broadcast_id) {
            console.log('[CINEMATIC][INITIAL_FETCH] Found recent cinematic, opening overlay:', eventPayload.sequence);
            lastBroadcastIdRef.current = eventPayload.broadcast_id;
            setCurrentSequence(eventPayload.sequence);
            setIsOpen(true);
            
            setDebugState(prev => ({
              ...prev,
              lastReceivedEvent: {
                id: event.id,
                created_at: event.created_at,
                sequence: eventPayload.sequence,
              },
            }));
          }
        }
      }
    };

    checkRecentEvent();

    // Realtime subscription
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'game_events',
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          console.log('[CINEMATIC][REALTIME] Received event:', payload);
          
          const newEvent = payload.new as {
            id: string;
            event_type: string;
            visibility: string;
            created_at: string;
            payload: {
              adventure_id?: string;
              sequence?: CinematicSequence[];
              broadcast_id?: string;
            } | null;
          };

          if (
            newEvent.event_type === 'ADVENTURE_CINEMATIC' &&
            newEvent.visibility === 'PUBLIC' &&
            newEvent.payload?.sequence
          ) {
            const broadcastId = newEvent.payload.broadcast_id || '';
            
            console.log('[CINEMATIC][REALTIME] Cinematic event detected:', {
              id: newEvent.id,
              sequence: newEvent.payload.sequence,
              broadcastId,
              lastBroadcastId: lastBroadcastIdRef.current,
            });
            
            // Don't replay if we already saw this broadcast
            if (lastBroadcastIdRef.current !== broadcastId) {
              console.log('[CINEMATIC][REALTIME] Opening overlay with sequence:', newEvent.payload.sequence);
              lastBroadcastIdRef.current = broadcastId;
              setCurrentSequence(newEvent.payload.sequence);
              setIsOpen(true);
              
              setDebugState(prev => ({
                ...prev,
                lastReceivedEvent: {
                  id: newEvent.id,
                  created_at: newEvent.created_at,
                  sequence: newEvent.payload!.sequence!,
                },
              }));
            } else {
              console.log('[CINEMATIC][REALTIME] Skipping duplicate broadcast:', broadcastId);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('[CINEMATIC][SUBSCRIBE] Channel status:', status);
      });

    channelRef.current = channel;

    return () => {
      console.log('[CINEMATIC][SUBSCRIBE] Cleaning up channel:', channelName);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [gameId, enabled]);

  return {
    isOpen,
    currentSequence,
    closeOverlay,
    replayLocal,
    broadcastCinematic,
    debugState,
  };
}

// Helper: Get the cinematic sequence for a given game step
export function getSequenceForGameType(
  gameTypeCode: string | null,
  isStart: boolean = true
): CinematicSequence[] {
  switch (gameTypeCode) {
    case 'RIVIERES':
      return isStart ? ['INTRO', 'GUIDE_CHOICE', 'PRE_RIVIERES'] : [];
    case 'FORET':
      return isStart ? ['TRANSITION_1', 'PRE_FORET'] : [];
    case 'SHERIFF':
      return isStart ? ['TRANSITION_2', 'PRE_SHERIFF'] : [];
    case 'INFECTION':
      return isStart ? ['TRANSITION_3', 'PRE_INFECTION'] : [];
    default:
      return [];
  }
}

// Helper: Get end sequence
export function getEndSequence(): CinematicSequence[] {
  return ['END'];
}

// Export the constant for use elsewhere
export { LA_CARTE_TROUVEE_ID };
