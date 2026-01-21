import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Trophy, Skull, Swords, Target, Loader2 } from 'lucide-react';

interface Kill {
  killerName: string;
  killerNum: number;
  monsterId: number;
  monsterName: string;
  reward: number;
  slot: number;
  fromDot?: boolean;
}

interface PublicSummaryEntry {
  nom: string;
  position: number;
  totalDamage: number;
  weapons: string[];
  cancelled?: boolean;
}

interface CombatResult {
  id: string;
  manche: number;
  kills: Kill[];
  public_summary: PublicSummaryEntry[];
  resolved_at: string;
}

interface PlayerStats {
  name: string;
  totalDamage: number;
  kills: number;
  totalRewards: number;
  weapons: string[];
}

interface Phase3CombatSummaryProps {
  gameId: string;
  sessionGameId?: string | null;
  currentManche: number;
}

export function Phase3CombatSummary({ gameId, sessionGameId, currentManche }: Phase3CombatSummaryProps) {
  const [loading, setLoading] = useState(true);
  const [combatResults, setCombatResults] = useState<CombatResult[]>([]);

  const fetchCombatHistory = useCallback(async () => {
    setLoading(true);
    
    try {
      let query = supabase
        .from('combat_results')
        .select('id, manche, kills, public_summary, resolved_at')
        .eq('game_id', gameId)
        .order('manche', { ascending: true });
      
      if (sessionGameId) {
        query = query.eq('session_game_id', sessionGameId);
      }

      const { data, error: fetchError } = await query;
      
      if (fetchError) {
        console.error('[Phase3CombatSummary] Error fetching:', fetchError);
        setCombatResults([]);
      } else {
        const parsed = (data || []).map(r => ({
          ...r,
          kills: Array.isArray(r.kills) ? (r.kills as unknown as Kill[]) : [],
          public_summary: Array.isArray(r.public_summary) ? (r.public_summary as unknown as PublicSummaryEntry[]) : [],
        }));
        setCombatResults(parsed);
      }
    } catch (err) {
      console.error('[Phase3CombatSummary] Unexpected error:', err);
      setCombatResults([]);
    }
    
    setLoading(false);
  }, [gameId, sessionGameId]);

  useEffect(() => {
    fetchCombatHistory();

    // Subscribe to updates
    const channel = supabase
      .channel(`phase3-combat-summary-${gameId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'combat_results', filter: `game_id=eq.${gameId}` }, fetchCombatHistory)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchCombatHistory, gameId]);

  // Aggregate stats
  const allKills = combatResults.flatMap(r => r.kills || []);
  const allSummaries = combatResults.flatMap(r => r.public_summary || []);

  // Player stats: aggregate by player name
  const playerStatsMap = new Map<string, PlayerStats>();
  allSummaries.forEach(entry => {
    if (entry.cancelled) return;
    const existing = playerStatsMap.get(entry.nom) || {
      name: entry.nom,
      totalDamage: 0,
      kills: 0,
      totalRewards: 0,
      weapons: [],
    };
    existing.totalDamage += entry.totalDamage || 0;
    // Collect unique weapons
    if (entry.weapons && Array.isArray(entry.weapons)) {
      entry.weapons.forEach(w => {
        if (!existing.weapons.includes(w)) {
          existing.weapons.push(w);
        }
      });
    }
    playerStatsMap.set(entry.nom, existing);
  });

  // Add kills and rewards from kills data
  allKills.forEach(kill => {
    const existing = playerStatsMap.get(kill.killerName);
    if (existing) {
      existing.kills++;
      existing.totalRewards += kill.reward || 0;
    }
  });

  const playerStats = Array.from(playerStatsMap.values())
    .sort((a, b) => b.totalRewards - a.totalRewards || b.kills - a.kills);

  // Total stats
  const totalKills = allKills.length;
  const totalRewards = allKills.reduce((sum, k) => sum + (k.reward || 0), 0);
  const totalDamage = allSummaries.filter(e => !e.cancelled).reduce((sum, e) => sum + (e.totalDamage || 0), 0);
  const resolvedManches = combatResults.length;

  // Last manche kills
  const lastMancheResult = combatResults.length > 0 ? combatResults[combatResults.length - 1] : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-destructive" />
      </div>
    );
  }

  if (combatResults.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        <Target className="h-6 w-6 mx-auto mb-1 opacity-50" />
        <p className="text-[9px] md:text-[10px]">Aucun combat résolu</p>
        <p className="text-[8px] text-muted-foreground/70">Manche {currentManche}</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-2">
      {/* Global Stats - compact */}
      <div className="grid grid-cols-3 gap-1 flex-shrink-0">
        <div className="bg-destructive/20 rounded p-1 text-center">
          <Skull className="h-2.5 md:h-3 w-2.5 md:w-3 mx-auto mb-0.5 text-destructive" />
          <div className="text-[10px] md:text-xs font-bold text-destructive">{totalKills}</div>
          <div className="text-[7px] md:text-[8px] text-muted-foreground">Kills</div>
        </div>
        <div className="bg-amber-500/20 rounded p-1 text-center">
          <Trophy className="h-2.5 md:h-3 w-2.5 md:w-3 mx-auto mb-0.5 text-amber-500" />
          <div className="text-[10px] md:text-xs font-bold text-amber-500">{totalRewards}</div>
          <div className="text-[7px] md:text-[8px] text-muted-foreground">Récomp.</div>
        </div>
        <div className="bg-blue-500/20 rounded p-1 text-center">
          <Swords className="h-2.5 md:h-3 w-2.5 md:w-3 mx-auto mb-0.5 text-blue-500" />
          <div className="text-[10px] md:text-xs font-bold text-blue-500">{totalDamage}</div>
          <div className="text-[7px] md:text-[8px] text-muted-foreground">Dégâts</div>
        </div>
      </div>

      {/* Players with weapons and damage */}
      {playerStats.length > 0 && (
        <div className="space-y-0.5 flex-shrink-0">
          <div className="text-[8px] md:text-[9px] font-semibold text-muted-foreground mb-0.5">Joueurs & Armes</div>
          {playerStats.slice(0, 6).map((player, index) => (
            <div 
              key={player.name}
              className={`p-0.5 md:p-1 rounded text-[8px] md:text-[9px] ${
                index === 0 ? 'bg-amber-500/30' : 'bg-secondary/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-0.5 min-w-0 flex-1">
                  <span className="text-[9px] flex-shrink-0">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                  </span>
                  <span className="truncate max-w-[50px] font-medium">{player.name}</span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Swords className="h-2 w-2 text-blue-500" />
                  <span className="text-blue-500">{player.totalDamage}</span>
                  {player.kills > 0 && (
                    <span className="text-destructive text-[7px] md:text-[8px]">({player.kills}K)</span>
                  )}
                </div>
              </div>
              {player.weapons.length > 0 && (
                <div className="flex flex-wrap gap-0.5 mt-0.5 pl-3">
                  {player.weapons.map((weapon, wIdx) => (
                    <Badge 
                      key={wIdx} 
                      variant="outline" 
                      className="text-[6px] md:text-[7px] px-1 py-0 h-3 bg-secondary/50"
                    >
                      {weapon}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Last Manche Actions Summary + Kills - flexible height to fill remaining space */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Last Manche Actions Summary */}
        {lastMancheResult && lastMancheResult.public_summary.length > 0 && (
          <div className="flex-1 flex flex-col min-h-0 border-t border-border pt-1">
            <div className="text-[8px] md:text-[9px] font-semibold text-muted-foreground flex-shrink-0">
              Résumé Actions - Manche {lastMancheResult.manche}
            </div>
            <div className="flex-1 overflow-y-auto space-y-0.5 mt-0.5">
              {lastMancheResult.public_summary
                .filter(entry => !entry.cancelled)
                .map((entry, idx) => (
                  <div 
                    key={idx}
                    className="text-[7px] md:text-[8px] bg-secondary/30 rounded p-0.5 md:p-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate max-w-[60px]">{entry.nom}</span>
                      <span className="text-blue-500 font-bold">{entry.totalDamage} dégâts</span>
                    </div>
                    {entry.weapons && entry.weapons.length > 0 && (
                      <div className="text-muted-foreground mt-0.5">
                        {entry.weapons.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
            </div>
            {lastMancheResult.public_summary.filter(e => e.cancelled).length > 0 && (
              <div className="text-[6px] md:text-[7px] text-muted-foreground/70 italic flex-shrink-0">
                {lastMancheResult.public_summary.filter(e => e.cancelled).length} action(s) annulée(s)
              </div>
            )}
          </div>
        )}

        {/* Last Manche Kills */}
        {lastMancheResult && lastMancheResult.kills.length > 0 && (
          <div className="space-y-0.5 flex-shrink-0 mt-1">
            <div className="text-[8px] md:text-[9px] font-semibold text-muted-foreground">
              Kills - Manche {lastMancheResult.manche}
            </div>
            {lastMancheResult.kills.slice(0, 3).map((kill, idx) => (
              <div 
                key={idx}
                className="flex items-center justify-between text-[7px] md:text-[8px] bg-destructive/10 rounded p-0.5 md:p-1"
              >
                <div className="flex items-center gap-0.5 min-w-0 flex-1">
                  <Skull className="h-2 w-2 text-destructive flex-shrink-0" />
                  <span className="truncate">
                    <span className="font-medium">{kill.killerName}</span>
                    <span className="text-muted-foreground"> → </span>
                    <span className="text-destructive">{kill.monsterName}</span>
                  </span>
                </div>
                <Badge className="bg-amber-500/30 text-amber-400 text-[6px] md:text-[7px] px-0.5 py-0 flex-shrink-0">
                  +{kill.reward}
                </Badge>
              </div>
            ))}
            {lastMancheResult.kills.length > 3 && (
              <div className="text-center text-[7px] text-muted-foreground">
                +{lastMancheResult.kills.length - 3} autres
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
