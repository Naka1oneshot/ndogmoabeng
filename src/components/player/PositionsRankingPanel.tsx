import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Target, Lock } from 'lucide-react';

interface Game {
  id: string;
  manche_active: number;
  phase: string;
  phase_locked: boolean;
}

interface PublicPosition {
  position_finale: number;
  nom: string;
  num_joueur: number;
}

interface PositionsRankingPanelProps {
  game: Game;
  currentPlayerNumber?: number;
  className?: string;
}

export function PositionsRankingPanel({ game, currentPlayerNumber, className }: PositionsRankingPanelProps) {
  const [positions, setPositions] = useState<PublicPosition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPositions();

    const channel = supabase
      .channel(`positions-ranking-${game.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'positions_finales', filter: `game_id=eq.${game.id}` }, fetchPositions)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [game.id, game.manche_active]);

  const fetchPositions = async () => {
    // Only fetch public fields: position_finale, nom, num_joueur
    // Do NOT fetch: slot_attaque, attaque1, attaque2, protection, slot_protection
    const { data } = await supabase
      .from('positions_finales')
      .select('position_finale, nom, num_joueur')
      .eq('game_id', game.id)
      .eq('manche', game.manche_active)
      .order('position_finale', { ascending: true });

    setPositions(data || []);
    setLoading(false);
  };

  if (loading || positions.length === 0) {
    return null;
  }

  return (
    <div className={`card-gradient rounded-lg border border-border ${className}`}>
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-blue-500" />
          <h3 className="font-display text-sm">Classement d'attaque</h3>
        </div>
        {game.phase_locked && (
          <span className="flex items-center gap-1 text-xs text-amber-500">
            <Lock className="h-3 w-3" />
            Verrouillé
          </span>
        )}
      </div>

      <div className="p-4">
        <div className="flex flex-wrap gap-2">
          {positions.map((pos) => {
            const isCurrentPlayer = pos.num_joueur === currentPlayerNumber;
            return (
              <Badge 
                key={pos.num_joueur}
                variant={isCurrentPlayer ? 'default' : 'secondary'}
                className={`text-sm py-1 px-3 ${isCurrentPlayer ? 'ring-2 ring-primary' : ''}`}
              >
                <span className="font-bold mr-1">#{pos.position_finale}</span>
                {pos.nom}
              </Badge>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          L'ordre d'attaque détermine qui frappe en premier. Les protections activées bloquent les attaques suivantes.
        </p>
      </div>
    </div>
  );
}
