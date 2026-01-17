import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Trophy, MapPin } from 'lucide-react';

interface PriorityRanking {
  num_joueur: number;
  display_name: string | null;
  rank: number;
  mise_effective: number | null;
}

interface FinalPosition {
  num_joueur: number;
  nom: string | null;
  position_finale: number | null;
  rang_priorite: number | null;
}

interface ResultsPanelProps {
  gameId: string;
  manche: number;
  selectedManche?: number;
  phase: string;
  phaseLocked: boolean;
  className?: string;
}

export function ResultsPanel({ gameId, manche, selectedManche, phase, phaseLocked, className }: ResultsPanelProps) {
  const displayManche = selectedManche ?? manche;
  const [priorityRankings, setPriorityRankings] = useState<PriorityRanking[]>([]);
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
          table: 'priority_rankings',
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
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`,
        },
        () => fetchResults()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, displayManche]);

  const fetchResults = async () => {
    // Fetch priority rankings from priority_rankings table (computed at Phase 1 close)
    const { data: rankings } = await supabase
      .from('priority_rankings')
      .select('num_joueur, display_name, rank, mise_effective')
      .eq('game_id', gameId)
      .eq('manche', displayManche)
      .order('rank', { ascending: true });

    if (rankings) {
      setPriorityRankings(rankings);
    }

    // Fetch final positions (without slot_attaque - should not be revealed to players)
    const { data: positions } = await supabase
      .from('positions_finales')
      .select('num_joueur, nom, position_finale, rang_priorite')
      .eq('game_id', gameId)
      .eq('manche', displayManche)
      .order('position_finale', { ascending: true });

    if (positions) {
      setFinalPositions(positions);
    }

    setLoading(false);
  };

  // For historical views, always show available data
  const isHistorical = selectedManche !== undefined && selectedManche !== manche;

  // Show bet rankings after Phase 1 is closed (priority_rankings exists or we're past PHASE1)
  const showBetRankings = priorityRankings.length > 0;
  
  // Show positions after Phase 2 is locked or we're past it (or if viewing history)
  const showPositions = isHistorical || (phase !== 'PHASE1_MISES' && phase !== 'PHASE2_POSITIONS') || 
                        (phase === 'PHASE2_POSITIONS' && phaseLocked);

  // Always show the panel (don't return null)
  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className={`card-gradient rounded-lg border border-border ${className}`}>
      <div className="p-3 border-b border-border flex items-center gap-2">
        <Trophy className="h-4 w-4 text-amber-400" />
        <h3 className="font-display text-sm">Résultats</h3>
      </div>

      <ScrollArea className="max-h-[300px]">
        <div className="p-4 space-y-4">
          {/* Priority Rankings (Phase 1 classement) */}
          {showBetRankings && priorityRankings.length > 0 && (
            <div>
              <h4 className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <Trophy className="h-3 w-3" />
                Classement mise — Phase 1 (Manche {displayManche})
              </h4>
              
              {/* Compact text format: "Daryl #1, Maeva #2, ..." */}
              <div className="p-3 rounded bg-secondary/30 border border-border mb-2">
                <p className="text-sm">
                  {priorityRankings.map((r) => (
                    <span key={r.num_joueur}>
                      <span className="font-medium">{r.display_name || `Joueur ${r.num_joueur}`}</span>
                      <span className="text-muted-foreground"> #{r.rank}</span>
                      {r.rank < priorityRankings.length ? ', ' : ''}
                    </span>
                  ))}
                </p>
              </div>

              {/* Detailed cards */}
              <div className="space-y-1">
                {priorityRankings.map((ranking) => (
                  <div
                    key={ranking.num_joueur}
                    className={`flex items-center justify-between p-2 rounded text-sm ${
                      ranking.rank === 1
                        ? 'bg-yellow-500/10 border border-yellow-500/20'
                        : ranking.rank === 2
                        ? 'bg-slate-300/10 border border-slate-300/20'
                        : ranking.rank === 3
                        ? 'bg-amber-700/10 border border-amber-700/20'
                        : 'bg-secondary/30'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold w-6">#{ranking.rank}</span>
                      <span className="text-muted-foreground">
                        {ranking.display_name || `Joueur ${ranking.num_joueur}`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Waiting message when Phase 1 not yet closed */}
          {phase === 'PHASE1_MISES' && priorityRankings.length === 0 && (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">
                Classement indisponible (en attente validation MJ)
              </p>
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
                      <span className="font-bold w-6">#{pos.position_finale ?? '-'}</span>
                      <span className="text-muted-foreground">{pos.nom || `Joueur ${pos.num_joueur}`}</span>
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