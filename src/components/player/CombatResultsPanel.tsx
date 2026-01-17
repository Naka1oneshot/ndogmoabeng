import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Swords, Skull, TreePine, Ban, Check } from 'lucide-react';

interface Game {
  id: string;
  manche_active: number;
  phase: string;
}

interface PublicAction {
  position: number;
  nom: string;
  weapons: string[];
  totalDamage: number;
  cancelled: boolean;
  cancelReason?: string;
}

interface Kill {
  killerName: string;
  monsterName: string;
  slot: number;
  reward: number;
}

interface ForestState {
  totalPvRemaining: number;
  monstersKilled: number;
}

interface CombatResult {
  public_summary: PublicAction[];
  kills: Kill[];
  forest_state: ForestState;
}

interface CombatResultsPanelProps {
  game: Game;
  selectedManche?: number;
  className?: string;
}

export function CombatResultsPanel({ game, selectedManche, className }: CombatResultsPanelProps) {
  const manche = selectedManche ?? game.manche_active;
  const [combatResult, setCombatResult] = useState<CombatResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCombatResult();

    const channel = supabase
      .channel(`combat-results-${game.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'combat_results', filter: `game_id=eq.${game.id}` }, fetchCombatResult)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [game.id, manche]);

  const fetchCombatResult = async () => {
    const { data } = await supabase
      .from('combat_results')
      .select('public_summary, kills, forest_state')
      .eq('game_id', game.id)
      .eq('manche', manche)
      .maybeSingle();

    if (data) {
      setCombatResult({
        public_summary: data.public_summary as unknown as PublicAction[],
        kills: data.kills as unknown as Kill[],
        forest_state: data.forest_state as unknown as ForestState,
      });
    } else {
      setCombatResult(null);
    }
    setLoading(false);
  };

  if (loading || !combatResult) {
    return null;
  }

  const { public_summary, kills, forest_state } = combatResult;

  return (
    <div className={`card-gradient rounded-lg border border-border ${className}`}>
      <div className="p-3 border-b border-border flex items-center gap-2">
        <Swords className="h-4 w-4 text-red-500" />
        <h3 className="font-display text-sm">Résumé du combat</h3>
      </div>

      <div className="p-4 space-y-4">
        {/* Résumé des attaques (SANS CIBLES) */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Attaques
          </h4>
          <div className="space-y-1">
            {public_summary.map((action, idx) => (
              <div 
                key={idx} 
                className={`p-2 rounded text-sm flex items-center justify-between ${
                  action.cancelled 
                    ? 'bg-red-500/10 border border-red-500/20' 
                    : 'bg-secondary/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">#{action.position}</Badge>
                  <span className="font-medium">{action.nom}</span>
                  {action.weapons.length > 0 && (
                    <span className="text-muted-foreground text-xs">
                      ({action.weapons.join(' + ')})
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {action.cancelled ? (
                    <span className="text-red-400 text-xs flex items-center gap-1">
                      <Ban className="h-3 w-3" />
                      {action.cancelReason || 'Annulée'}
                    </span>
                  ) : (
                    <span className="text-green-400 text-xs flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      {action.totalDamage} dégâts
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Coups de grâce (AVEC CIBLES - seul endroit où on révèle) */}
        {kills.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wide flex items-center gap-1">
              <Skull className="h-3 w-3" />
              Coups de grâce
            </h4>
            <div className="space-y-1">
              {kills.map((kill, idx) => (
                <div 
                  key={idx} 
                  className="p-2 rounded bg-amber-500/10 border border-amber-500/30 text-sm"
                >
                  <span className="font-bold text-amber-400">{kill.killerName}</span>
                  {' a éliminé '}
                  <span className="font-bold text-red-400">{kill.monsterName}</span>
                  {' dans '}
                  <span className="font-medium text-muted-foreground">Slot {kill.slot}</span>
                  {' !'}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* État de la forêt */}
        {forest_state && (
          <div className="p-3 rounded bg-green-500/10 border border-green-500/20">
            <div className="flex items-center gap-2 text-sm">
              <TreePine className="h-4 w-4 text-green-500" />
              <span className="text-green-400">
                État de la forêt : {forest_state.totalPvRemaining} PV restants
              </span>
              {forest_state.monstersKilled > 0 && (
                <Badge variant="outline" className="text-xs text-amber-400 border-amber-400/50">
                  {forest_state.monstersKilled} monstre(s) éliminé(s)
                </Badge>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
