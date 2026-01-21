import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Shield, Heart, Skull, Swords, Trophy, Users } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { getMonsterImage } from '@/lib/monsterImages';
import emptySlotRip from '@/assets/monsters/empty-slot-rip.png';

interface MonsterState {
  id: string;
  monster_id: number;
  pv_current: number;
  status: 'EN_BATAILLE' | 'EN_FILE' | 'MORT';
  battlefield_slot: number | null;
  catalog?: {
    name: string;
    type: string | null;
    pv_max_default: number;
    reward_default: number;
  };
  config?: {
    pv_max_override: number | null;
    reward_override: number | null;
  };
}

interface BattlefieldViewProps {
  gameId: string;
  sessionGameId?: string | null;
  className?: string;
  showDetails?: boolean; // For MJ to see extra info
}

const statusColors: Record<string, string> = {
  EN_BATAILLE: 'text-red-400 bg-red-500/10',
  EN_FILE: 'text-amber-400 bg-amber-500/10',
  MORT: 'text-muted-foreground bg-muted/50',
};

const statusLabels: Record<string, string> = {
  EN_BATAILLE: 'En combat',
  EN_FILE: 'En file',
  MORT: 'Vaincu',
};

export function BattlefieldView({ gameId, sessionGameId, className, showDetails = false }: BattlefieldViewProps) {
  const [monsters, setMonsters] = useState<MonsterState[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel(`battlefield-${gameId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_state_monsters',
          filter: `game_id=eq.${gameId}`,
        },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, sessionGameId]);

  const fetchData = async () => {
    // Build query - include monsters with matching session_game_id OR null session_game_id
    // This handles the case where monsters are initialized without a session_game_id
    let stateQuery = supabase
      .from('game_state_monsters')
      .select(`
        id,
        monster_id,
        pv_current,
        status,
        battlefield_slot
      `)
      .eq('game_id', gameId);
    
    // If sessionGameId is provided, filter to include monsters with that session_game_id OR null
    if (sessionGameId) {
      stateQuery = stateQuery.or(`session_game_id.eq.${sessionGameId},session_game_id.is.null`);
    }

    const { data: stateData, error: stateError } = await stateQuery.order('battlefield_slot', { ascending: true, nullsFirst: false });

    if (stateError) {
      console.error('Error fetching monster state:', stateError);
      setLoading(false);
      return;
    }

    if (!stateData || stateData.length === 0) {
      setMonsters([]);
      setLoading(false);
      return;
    }

    // Fetch catalog info for these monsters
    const monsterIds = stateData.map(m => m.monster_id);
    const [catalogRes, configRes] = await Promise.all([
      supabase
        .from('monster_catalog')
        .select('id, name, type, pv_max_default, reward_default')
        .in('id', monsterIds),
      supabase
        .from('game_monsters')
        .select('monster_id, pv_max_override, reward_override')
        .eq('game_id', gameId)
        .in('monster_id', monsterIds),
    ]);

    const catalogMap = new Map(
      (catalogRes.data || []).map(c => [c.id, c])
    );
    const configMap = new Map(
      (configRes.data || []).map(c => [c.monster_id, c])
    );

    const enrichedMonsters: MonsterState[] = stateData.map(m => ({
      ...m,
      status: m.status as 'EN_BATAILLE' | 'EN_FILE' | 'MORT',
      catalog: catalogMap.get(m.monster_id),
      config: configMap.get(m.monster_id),
    }));

    setMonsters(enrichedMonsters);
    setLoading(false);
  };

  const getMonsterPvMax = (monster: MonsterState): number => {
    return monster.config?.pv_max_override ?? monster.catalog?.pv_max_default ?? 10;
  };

  const getMonsterReward = (monster: MonsterState): number => {
    return monster.config?.reward_override ?? monster.catalog?.reward_default ?? 10;
  };

  const getMonsterName = (monster: MonsterState): string => {
    return monster.catalog?.name ?? `Monstre #${monster.monster_id}`;
  };

  const getMonsterType = (monster: MonsterState): string | null => {
    return monster.catalog?.type ?? null;
  };

  const battlefieldMonsters = monsters.filter(m => m.status === 'EN_BATAILLE' && m.battlefield_slot);
  const queueMonsters = monsters.filter(m => m.status === 'EN_FILE');
  const deadMonsters = monsters.filter(m => m.status === 'MORT');

  const slots = [1, 2, 3];

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (monsters.length === 0) {
    return (
      <div className={`card-gradient rounded-lg border border-border ${className}`}>
        <div className="p-3 border-b border-border flex items-center gap-2">
          <Swords className="h-4 w-4 text-red-400" />
          <h3 className="font-display text-sm">Champ de Bataille</h3>
        </div>
        <div className="p-8 text-center text-muted-foreground text-sm">
          Aucun monstre initialisé
        </div>
      </div>
    );
  }

  // Calculate global PV for all monsters (not just battlefield)
  const totalPvCurrent = monsters.reduce((sum, m) => sum + m.pv_current, 0);
  const totalPvMax = monsters.reduce((sum, m) => sum + getMonsterPvMax(m), 0);
  const globalProgress = totalPvMax > 0 ? (totalPvCurrent / totalPvMax) * 100 : 0;

  return (
    <div className={`card-gradient rounded-lg border border-border ${className}`}>
      <div className="p-3 border-b border-border flex items-center gap-2">
        <Swords className="h-4 w-4 text-red-400" />
        <h3 className="font-display text-sm">Champ de Bataille</h3>
        {showDetails && (
          <span className="text-xs text-muted-foreground ml-auto">
            {battlefieldMonsters.length}/3 actifs • {queueMonsters.length} en file
          </span>
        )}
      </div>

      {/* Global progress bar for players */}
      {!showDetails && (
        <div className="px-4 pt-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span className="flex items-center gap-1">
              <Heart className="h-3 w-3 text-red-400" />
              PV Globaux des Monstres
            </span>
            <span className="font-mono">{Math.round(globalProgress)}%</span>
          </div>
          <Progress value={globalProgress} className="h-2" />
        </div>
      )}

      {/* Battlefield slots */}
      <div className="p-4 grid grid-cols-3 gap-3">
        {slots.map((slotNum) => {
          const monster = battlefieldMonsters.find(m => m.battlefield_slot === slotNum);

          return (
            <div
              key={slotNum}
              className="flex flex-col items-center p-3 rounded-lg bg-secondary/30 border border-border min-h-[140px]"
            >
              <div className="text-xs text-muted-foreground mb-2">Slot {slotNum}</div>

              {monster ? (
                <>
                  <div className="w-16 h-16 rounded-lg overflow-hidden mb-1 bg-secondary/50">
                    {monster.status === 'MORT' ? (
                      <div className="w-full h-full flex items-center justify-center">
                        <Skull className="h-8 w-8 text-muted-foreground" />
                      </div>
                    ) : getMonsterImage(monster.monster_id) ? (
                      <img 
                        src={getMonsterImage(monster.monster_id)} 
                        alt={getMonsterName(monster)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl">🐉</div>
                    )}
                  </div>
                  {getMonsterType(monster) && (
                    <div className="text-[10px] text-muted-foreground text-center">
                      {getMonsterType(monster)}
                    </div>
                  )}
                  <div className="text-sm font-medium text-center truncate w-full">
                    {getMonsterName(monster)}
                  </div>

                  {showDetails && (
                    <div className="text-xs text-muted-foreground">
                      ID: {monster.monster_id}
                    </div>
                  )}

                  <div className="w-full mt-2 space-y-1">
                    <div className="flex items-center justify-between gap-1 text-xs">
                      <div className="flex items-center gap-1">
                        <Heart className="h-3 w-3 text-red-400" />
                        {showDetails ? (
                          <span>{monster.pv_current}/{getMonsterPvMax(monster)}</span>
                        ) : (
                          <span>PV: {getMonsterPvMax(monster)}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-amber-400">
                        <Trophy className="h-3 w-3" />
                        <span>{getMonsterReward(monster)}</span>
                      </div>
                    </div>
                    {showDetails && (
                      <Progress
                        value={(monster.pv_current / getMonsterPvMax(monster)) * 100}
                        className="h-1.5"
                      />
                    )}
                  </div>

                  <div className={`text-xs mt-2 px-2 py-0.5 rounded ${statusColors[monster.status] || ''}`}>
                    {statusLabels[monster.status]}
                  </div>
                </>
              ) : queueMonsters.length === 0 && deadMonsters.length > 0 ? (
                // No monster and no queue - show RIP image
                <div className="flex-1 flex flex-col items-center justify-center">
                  <div className="w-16 h-20 rounded-lg overflow-hidden shadow-lg">
                    <img 
                      src={emptySlotRip} 
                      alt="Slot vide - RIP"
                      className="w-full h-full object-cover opacity-70"
                    />
                  </div>
                  <span className="text-muted-foreground text-[10px] mt-1">Vide</span>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <span className="text-muted-foreground text-xs">Vide</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Monsters in queue */}
      {queueMonsters.length > 0 && (
        <div className="px-4 pb-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Users className="h-3 w-3" />
            <span>File d'attente ({queueMonsters.length})</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {queueMonsters.map((monster) => (
              <div
                key={monster.id}
                className="flex items-center gap-2 text-xs bg-amber-500/10 text-amber-400 px-3 py-1.5 rounded-lg border border-amber-500/20"
              >
                <div className="w-8 h-8 rounded overflow-hidden bg-secondary/50 flex-shrink-0">
                  {getMonsterImage(monster.monster_id) ? (
                    <img 
                      src={getMonsterImage(monster.monster_id)} 
                      alt={getMonsterName(monster)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="flex items-center justify-center w-full h-full">🐉</span>
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="font-medium">{getMonsterName(monster)}</span>
                  <span className="text-amber-300/70 text-[10px]">
                    PV: {getMonsterPvMax(monster)} • 💰{getMonsterReward(monster)}
                  </span>
                </div>
                {showDetails && (
                  <span className="text-amber-300/50 text-[10px]">#{monster.monster_id}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dead monsters (collapsed by default, shown if showDetails) */}
      {showDetails && deadMonsters.length > 0 && (
        <div className="px-4 pb-4 border-t border-border pt-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Skull className="h-3 w-3" />
            <span>Vaincus ({deadMonsters.length})</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {deadMonsters.map((monster) => (
              <div
                key={monster.id}
                className="flex items-center gap-1 text-xs bg-muted/30 text-muted-foreground px-2 py-1 rounded"
              >
                <span>💀</span>
                <span>{getMonsterName(monster)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
