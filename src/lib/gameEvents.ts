import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export type EventVisibility = 'MJ' | 'PUBLIC' | 'PRIVATE';

export interface GameEventData {
  gameId: string;
  manche: number;
  phase: string;
  visibility: EventVisibility;
  eventType: string;
  playerId?: string | null;
  playerNum?: number | null;
  message: string;
  payload?: Json | null;
}

/**
 * Log a game event to the history table (game_events).
 * This is a READ-ONLY history store that doesn't affect game state.
 */
export async function logGameEvent(data: GameEventData): Promise<void> {
  try {
    const { error } = await supabase
      .from('game_events')
      .insert({
        game_id: data.gameId,
        manche: data.manche,
        phase: data.phase,
        visibility: data.visibility,
        event_type: data.eventType,
        player_id: data.playerId || null,
        player_num: data.playerNum || null,
        message: data.message,
        payload: data.payload || null,
      });

    if (error) {
      console.error('[gameEvents] Failed to log event:', error);
    }
  } catch (err) {
    console.error('[gameEvents] Error logging event:', err);
  }
}

/**
 * Log multiple events at once (batch insert)
 */
export async function logGameEventsBatch(events: GameEventData[]): Promise<void> {
  if (events.length === 0) return;

  try {
    const { error } = await supabase
      .from('game_events')
      .insert(
        events.map((data) => ({
          game_id: data.gameId,
          manche: data.manche,
          phase: data.phase,
          visibility: data.visibility,
          event_type: data.eventType,
          player_id: data.playerId || null,
          player_num: data.playerNum || null,
          message: data.message,
          payload: data.payload || null,
        }))
      );

    if (error) {
      console.error('[gameEvents] Failed to batch log events:', error);
    }
  } catch (err) {
    console.error('[gameEvents] Error batch logging events:', err);
  }
}
