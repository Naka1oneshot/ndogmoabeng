import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Swords, Skull, TreePine, Ban, Check, Timer, Bomb, Shield, Zap } from 'lucide-react';
import { useGameSounds } from '@/hooks/useGameSounds';

interface Game {
  id: string;
  manche_active: number;
  phase: string;
  current_session_game_id?: string | null;
}

interface PublicAction {
  position: number;
  nom: string;
  weapons: string[];
  totalDamage: number;
  cancelled: boolean;
  cancelReason?: string;
  minePlaced?: { slot: number; weapon: string };
  mineExplosion?: boolean;
  protectionUsed?: { item: string; slot: number };
  delayedExplosion?: { damage: number; slot: number; weapon: string };
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
  sessionGameId?: string | null;
  className?: string;
}

export function CombatResultsPanel({ game, selectedManche, sessionGameId, className }: CombatResultsPanelProps) {
  const manche = selectedManche ?? game.manche_active;
  const effectiveSessionGameId = sessionGameId ?? game.current_session_game_id;
  const [combatResult, setCombatResult] = useState<CombatResult | null>(null);
  const [loading, setLoading] = useState(true);
  const { playCombatSequence } = useGameSounds();
  const hasPlayedSound = useRef(false);
  const previousResultId = useRef<string | null>(null);

  useEffect(() => {
    // Reset sound flag when manche changes
    hasPlayedSound.current = false;
    previousResultId.current = null;
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
    let query = supabase
      .from('combat_results')
      .select('id, public_summary, kills, forest_state')
      .eq('game_id', game.id)
      .eq('manche', manche);
    
    if (effectiveSessionGameId) {
      query = query.eq('session_game_id', effectiveSessionGameId);
    }

    const { data } = await query.maybeSingle();

    if (data) {
      const resultId = data.id;
      const isNewResult = resultId !== previousResultId.current;
      
      const result = {
        public_summary: data.public_summary as unknown as PublicAction[],
        kills: data.kills as unknown as Kill[],
        forest_state: data.forest_state as unknown as ForestState,
      };
      
      setCombatResult(result);
      
      // Play sound only for new results (not on initial load of old data)
      if (isNewResult && !hasPlayedSound.current && previousResultId.current !== null) {
        const totalHits = result.public_summary.filter(a => !a.cancelled && a.totalDamage > 0).length;
        const totalKills = result.kills.length;
        playCombatSequence(totalKills, totalHits);
        hasPlayedSound.current = true;
      }
      
      previousResultId.current = resultId;
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
            {public_summary.map((action, idx) => {
              const isMineExplosion = action.mineExplosion;
              const hasMinePlaced = action.minePlaced;
              const hasProtection = action.protectionUsed;
              const hasDelayedExplosion = action.delayedExplosion;
              
              return (
                <div 
                  key={idx} 
                  className={`p-2 rounded text-sm flex flex-col gap-1 ${
                    isMineExplosion
                      ? 'bg-orange-500/10 border border-orange-500/30'
                      : hasDelayedExplosion
                        ? 'bg-amber-500/10 border border-amber-500/30'
                        : action.cancelled 
                          ? 'bg-destructive/10 border border-destructive/20' 
                          : 'bg-secondary/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${isMineExplosion ? 'border-orange-500/50 text-orange-400' : hasDelayedExplosion ? 'border-amber-500/50 text-amber-400' : ''}`}
                      >
                        #{action.position}
                      </Badge>
                      <span className="font-medium">{action.nom}</span>
                      {action.weapons.length > 0 && (
                        <span className="text-muted-foreground text-xs">
                          ({action.weapons.join(' + ')})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {isMineExplosion ? (
                        <span className="text-orange-400 text-xs flex items-center gap-1">
                          <Bomb className="h-3 w-3" />
                          {action.totalDamage} dégâts
                        </span>
                      ) : hasMinePlaced ? (
                        <span className="text-amber-400 text-xs flex items-center gap-1">
                          <Timer className="h-3 w-3" />
                          Posée
                        </span>
                      ) : action.cancelled ? (
                        <span className="text-destructive text-xs flex items-center gap-1">
                          <Ban className="h-3 w-3" />
                          {action.cancelReason || 'Annulée'}
                        </span>
                      ) : (
                        <span className="text-green-500 text-xs flex items-center gap-1">
                          <Check className="h-3 w-3" />
                          {action.totalDamage} dégâts
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Delayed explosion info */}
                  {hasDelayedExplosion && (
                    <div className="flex items-center gap-1 text-xs text-amber-400 pl-6">
                      <Zap className="h-3 w-3" />
                      <span>💥 {hasDelayedExplosion.weapon} explose : +{hasDelayedExplosion.damage} dégâts</span>
                    </div>
                  )}
                  {/* Protection used */}
                  {hasProtection && (
                    <div className="flex items-center gap-1 text-xs text-blue-400 pl-6">
                      <Shield className="h-3 w-3" />
                      <span>{hasProtection.item}</span>
                    </div>
                  )}
                </div>
              );
            })}
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
