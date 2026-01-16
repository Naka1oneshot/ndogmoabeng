import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Trophy, MapPin } from 'lucide-react';

interface BetRanking {
  num_joueur: number;
  mise: number;
  nom?: string;
}

interface FinalPosition {
  num_joueur: number;
  nom: string | null;
  position_finale: number | null;
  slot_attaque: number | null;
  rang_priorite: number | null;
}

interface ResultsPanelProps {
  gameId: string;
  manche: number;
  phase: string;
  phaseLocked: boolean;
  className?: string;
}

export function ResultsPanel({ gameId, manche, phase, phaseLocked, className }: ResultsPanelProps) {
  const [betRankings, setBetRankings] = useState<BetRanking[]>([]);
  const [finalPositions, setFinalPositions] = useState<FinalPosition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResults();

    const channel = supabase
      .channel(`results-${gameId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'round_bets',
          filter: `game_id=eq.${gameId}`,
        },
        () => fetchResults()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'positions_finales',
          filter: `game_id=eq.${gameId}`,
        },
        () => fetchResults()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, manche]);

  const fetchResults = async () => {
    // Fetch bet rankings for current round
    const { data: bets } = await supabase
      .from('round_bets')
      .select('num_joueur, mise')
      .eq('game_id', gameId)
      .eq('manche', manche)
      .order('mise', { ascending: false });

    if (bets) {
      // Get player names
      const { data: players } = await supabase
        .from('game_players')
        .select('player_number, display_name')
        .eq('game_id', gameId)
        .eq('status', 'ACTIVE');

      const playerMap = new Map(players?.map(p => [p.player_number, p.display_name]) || []);
      
      setBetRankings(bets.map(bet => ({
        ...bet,
        nom: playerMap.get(bet.num_joueur) || `Joueur ${bet.num_joueur}`,
      })));
    }

    // Fetch final positions
    const { data: positions } = await supabase
      .from('positions_finales')
      .select('num_joueur, nom, position_finale, slot_attaque, rang_priorite')
      .eq('game_id', gameId)
      .eq('manche', manche)
      .order('position_finale', { ascending: true });

    if (positions) {
      setFinalPositions(positions);
    }

    setLoading(false);
  };

  // Show bet rankings after Phase 1 is locked or we're past it
  const showBetRankings = phaseLocked || phase !== 'PHASE1_MISES';
  
  // Show positions after Phase 2 is locked or we're past it
  const showPositions = (phase !== 'PHASE1_MISES' && phase !== 'PHASE2_POSITIONS') || 
                        (phase === 'PHASE2_POSITIONS' && phaseLocked);

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!showBetRankings && !showPositions) {
    return null;
  }

  return (
    <div className={`card-gradient rounded-lg border border-border ${className}`}>
      <div className="p-3 border-b border-border flex items-center gap-2">
        <Trophy className="h-4 w-4 text-amber-400" />
        <h3 className="font-display text-sm">Résultats</h3>
      </div>

      <ScrollArea className="max-h-[300px]">
        <div className="p-4 space-y-4">
          {/* Bet Rankings */}
          {showBetRankings && betRankings.length > 0 && (
            <div>
              <h4 className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <Trophy className="h-3 w-3" />
                Classement des mises
              </h4>
              <div className="space-y-1">
                {betRankings.map((bet, index) => (
                  <div
                    key={bet.num_joueur}
                    className={`flex items-center justify-between p-2 rounded text-sm ${
                      index === 0
                        ? 'bg-yellow-500/10 border border-yellow-500/20'
                        : index === 1
                        ? 'bg-slate-300/10 border border-slate-300/20'
                        : index === 2
                        ? 'bg-amber-700/10 border border-amber-700/20'
                        : 'bg-secondary/30'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold w-6">{index + 1}.</span>
                      <span>#{bet.num_joueur}</span>
                      <span className="text-muted-foreground">{bet.nom}</span>
                    </div>
                    <span className="font-medium text-yellow-500">{bet.mise}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Final Positions */}
          {showPositions && finalPositions.length > 0 && (
            <div>
              <h4 className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                Positions finales
              </h4>
              <div className="space-y-1">
                {finalPositions.map((pos) => (
                  <div
                    key={pos.num_joueur}
                    className="flex items-center justify-between p-2 rounded bg-secondary/30 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold w-6">#{pos.num_joueur}</span>
                      <span className="text-muted-foreground">{pos.nom || `Joueur ${pos.num_joueur}`}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Pos:</span>
                      <span className="font-medium">{pos.position_finale ?? '-'}</span>
                      {pos.slot_attaque && (
                        <>
                          <span className="text-xs text-muted-foreground">Slot:</span>
                          <span className="font-medium text-red-400">{pos.slot_attaque}</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!showBetRankings && !showPositions && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Les résultats apparaîtront après le verrouillage des phases
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}