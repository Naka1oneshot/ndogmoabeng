import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bug, X, ChevronDown, ChevronUp, Send } from 'lucide-react';
import type { CinematicSequence } from './AdventureCinematicOverlay';

interface DebugState {
  gameId: string | null;
  mode: string | null;
  adventureId: string | null;
  adventureName: string | null;
  hookActive: boolean;
  channelName: string | null;
  lastReceivedEvent: {
    id: string;
    created_at: string;
    sequence: CinematicSequence[];
  } | null;
  lastBroadcastAttempt: {
    timestamp: string;
    sequence: CinematicSequence[];
    success: boolean;
    error?: string;
  } | null;
  overlayOpen: boolean;
  currentSequence: CinematicSequence[];
}

interface AdventureCinematicDebugPanelProps {
  gameId: string | undefined;
  isHost: boolean;
  debugState: DebugState;
  onBroadcastTest?: (sequence: CinematicSequence[]) => void;
}

export function AdventureCinematicDebugPanel({
  gameId,
  isHost,
  debugState,
  onBroadcastTest,
}: AdventureCinematicDebugPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);
  const [gameContext, setGameContext] = useState<{
    mode: string | null;
    adventure_id: string | null;
    adventure_name: string | null;
  } | null>(null);

  // Fetch real game context from DB
  useEffect(() => {
    if (!gameId) return;

    const fetchContext = async () => {
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select('mode, adventure_id')
        .eq('id', gameId)
        .single();

      if (gameError) {
        console.error('[CINEMATIC][DEBUG] Error fetching game:', gameError);
        return;
      }

      let adventureName: string | null = null;
      if (gameData?.adventure_id) {
        const { data: advData } = await supabase
          .from('adventures')
          .select('name')
          .eq('id', gameData.adventure_id)
          .single();
        adventureName = advData?.name || null;
      }

      setGameContext({
        mode: gameData?.mode || null,
        adventure_id: gameData?.adventure_id || null,
        adventure_name: adventureName,
      });

      console.log('[CINEMATIC][DEBUG] Game context fetched:', {
        gameId,
        mode: gameData?.mode,
        adventure_id: gameData?.adventure_id,
        adventure_name: adventureName,
      });
    };

    fetchContext();
  }, [gameId]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-[90] p-2 bg-background border border-primary/30 rounded-full text-primary hover:bg-muted transition-colors"
        title="Debug Cinematic"
      >
        <Bug className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-[90] w-80 bg-background border border-primary/20 rounded-lg shadow-xl text-xs font-mono overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-2 bg-muted border-b border-primary/20">
        <div className="flex items-center gap-2">
          <Bug className="w-4 h-4 text-primary" />
          <span className="text-primary font-semibold">Cinematic Debug</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-accent rounded"
          >
            {isMinimized ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 hover:bg-accent rounded"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div className="p-3 space-y-3 max-h-[400px] overflow-y-auto">
          {/* Game Context */}
          <div className="space-y-1">
            <div className="text-muted-foreground text-[10px] uppercase tracking-wide">
              Game Context
            </div>
            <div className="bg-muted p-2 rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">gameId:</span>
                <span className="text-foreground truncate max-w-[150px]" title={gameId}>
                  {gameId?.slice(0, 8)}...
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">mode:</span>
                <Badge
                  variant={gameContext?.mode === 'ADVENTURE' ? 'default' : 'secondary'}
                  className="text-[10px] px-1 py-0"
                >
                  {gameContext?.mode || debugState.mode || 'N/A'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">adventure_id:</span>
                <span className="text-foreground truncate max-w-[150px]" title={gameContext?.adventure_id || ''}>
                  {gameContext?.adventure_id?.slice(0, 8) || 'null'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">adventure_name:</span>
                <span className="text-primary truncate max-w-[150px]">
                  {gameContext?.adventure_name || 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Hook State */}
          <div className="space-y-1">
            <div className="text-muted-foreground text-[10px] uppercase tracking-wide">
              Hook State
            </div>
            <div className="bg-muted p-2 rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">hook active:</span>
                <Badge
                  variant={debugState.hookActive ? 'default' : 'destructive'}
                  className="text-[10px] px-1 py-0"
                >
                  {debugState.hookActive ? 'YES' : 'NO'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">channel:</span>
                <span className="text-emerald-500 truncate max-w-[150px]">
                  {debugState.channelName || 'none'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">overlay open:</span>
                <Badge
                  variant={debugState.overlayOpen ? 'default' : 'secondary'}
                  className="text-[10px] px-1 py-0"
                >
                  {debugState.overlayOpen ? 'OPEN' : 'CLOSED'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Last Received Event */}
          <div className="space-y-1">
            <div className="text-muted-foreground text-[10px] uppercase tracking-wide">
              Last Received Event
            </div>
            <div className="bg-muted p-2 rounded">
              {debugState.lastReceivedEvent ? (
                <div className="space-y-1">
                  <div className="text-muted-foreground text-[10px]">
                    {new Date(debugState.lastReceivedEvent.created_at).toLocaleTimeString()}
                  </div>
                  <div className="text-foreground">
                    [{debugState.lastReceivedEvent.sequence.join(', ')}]
                  </div>
                </div>
              ) : (
                <span className="text-muted-foreground italic">No events received</span>
              )}
            </div>
          </div>

          {/* Last Broadcast Attempt */}
          <div className="space-y-1">
            <div className="text-muted-foreground text-[10px] uppercase tracking-wide">
              Last Broadcast Attempt
            </div>
            <div className="bg-muted p-2 rounded">
              {debugState.lastBroadcastAttempt ? (
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-[10px]">
                      {debugState.lastBroadcastAttempt.timestamp}
                    </span>
                    <Badge
                      variant={debugState.lastBroadcastAttempt.success ? 'default' : 'destructive'}
                      className="text-[10px] px-1 py-0"
                    >
                      {debugState.lastBroadcastAttempt.success ? 'OK' : 'FAIL'}
                    </Badge>
                  </div>
                  <div className="text-foreground">
                    [{debugState.lastBroadcastAttempt.sequence.join(', ')}]
                  </div>
                  {debugState.lastBroadcastAttempt.error && (
                    <div className="text-destructive text-[10px]">
                      {debugState.lastBroadcastAttempt.error}
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-muted-foreground italic">No broadcast attempts</span>
              )}
            </div>
          </div>

          {/* MJ Actions */}
          {isHost && onBroadcastTest && (
            <div className="space-y-2 pt-2 border-t border-primary/20">
              <div className="text-muted-foreground text-[10px] uppercase tracking-wide">
                MJ Actions
              </div>
              <Button
                size="sm"
                onClick={() => onBroadcastTest(['INTRO'])}
                className="w-full text-xs"
              >
                <Send className="w-3 h-3 mr-2" />
                Broadcast Test (INTRO)
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onBroadcastTest(['INTRO', 'GUIDE_CHOICE', 'PRE_RIVIERES'])}
                className="w-full text-xs"
              >
                Broadcast Full Intro Sequence
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Export debug state type for use in hook
export type { DebugState };
