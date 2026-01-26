import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { CinematicSequence } from '@/components/adventure/AdventureCinematicOverlay';

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
  const lastBroadcastIdRef = useRef<string | null>(null);
  const hasCheckedInitialRef = useRef(false);

  // Close the overlay
  const closeOverlay = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Replay locally (just restart the current sequence)
  const replayLocal = useCallback(() => {
    if (currentSequence.length > 0) {
      setIsOpen(false);
      setTimeout(() => setIsOpen(true), 100);
    }
  }, [currentSequence]);

  // Broadcast a cinematic to all players
  const broadcastCinematic = useCallback(async (
    sequence: CinematicSequence[],
    broadcastId?: string
  ) => {
    if (!gameId) return;

    const id = broadcastId || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const { error } = await supabase
      .from('game_events')
      .insert({
        game_id: gameId,
        visibility: 'PUBLIC',
        event_type: 'ADVENTURE_CINEMATIC',
        message: 'Adventure cinematic',
        payload: {
          adventure_id: LA_CARTE_TROUVEE_ID,
          sequence,
          broadcast_id: id,
        },
      });

    if (error) {
      console.error('[useAdventureCinematic] Broadcast error:', error);
    } else {
      console.log('[useAdventureCinematic] Broadcast sent:', sequence);
      // Also show locally for the broadcaster
      lastBroadcastIdRef.current = id;
      setCurrentSequence(sequence);
      setIsOpen(true);
    }
  }, [gameId]);

  // Subscribe to cinematic events
  useEffect(() => {
    if (!gameId || !enabled) return;

    // Initial fetch: check for recent cinematic events (within 2 minutes)
    const checkRecentEvent = async () => {
      if (hasCheckedInitialRef.current) return;
      hasCheckedInitialRef.current = true;

      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

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
        console.error('[useAdventureCinematic] Initial fetch error:', error);
        return;
      }

      if (data && data.length > 0) {
        const event = data[0] as unknown as AdventureCinematicEvent;
        const payload = event.payload;
        
        if (payload?.adventure_id === LA_CARTE_TROUVEE_ID && payload?.sequence) {
          // Don't replay if we already saw this broadcast
          if (lastBroadcastIdRef.current !== payload.broadcast_id) {
            console.log('[useAdventureCinematic] Found recent cinematic:', payload.sequence);
            lastBroadcastIdRef.current = payload.broadcast_id;
            setCurrentSequence(payload.sequence);
            setIsOpen(true);
          }
        }
      }
    };

    checkRecentEvent();

    // Realtime subscription
    const channel = supabase
      .channel(`adventure-cinematic-${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'game_events',
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          const newEvent = payload.new as {
            event_type: string;
            visibility: string;
            payload: {
              adventure_id?: string;
              sequence?: CinematicSequence[];
              broadcast_id?: string;
            } | null;
          };

          if (
            newEvent.event_type === 'ADVENTURE_CINEMATIC' &&
            newEvent.visibility === 'PUBLIC' &&
            newEvent.payload?.adventure_id === LA_CARTE_TROUVEE_ID &&
            newEvent.payload?.sequence
          ) {
            const broadcastId = newEvent.payload.broadcast_id || '';
            
            // Don't replay if we already saw this broadcast
            if (lastBroadcastIdRef.current !== broadcastId) {
              console.log('[useAdventureCinematic] Received cinematic:', newEvent.payload.sequence);
              lastBroadcastIdRef.current = broadcastId;
              setCurrentSequence(newEvent.payload.sequence);
              setIsOpen(true);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, enabled]);

  return {
    isOpen,
    currentSequence,
    closeOverlay,
    replayLocal,
    broadcastCinematic,
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
