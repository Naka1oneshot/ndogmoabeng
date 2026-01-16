import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Shield, Heart, Skull, Swords } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface Monster {
  id: string;
  monstre_id: number;
  type: string;
  pv_actuels: number;
  pv_max: number;
  statut: string;
  recompense: number;
}

interface BattlefieldSlot {
  id: string;
  slot: number;
  monstre_id_en_place: number | null;
  pv_miroir: number;
}

interface BattlefieldViewProps {
  gameId: string;
  className?: string;
}

const statusColors: Record<string, string> = {
  EN_BATAILLE: 'text-red-400 bg-red-500/10',
  EN_FILE: 'text-amber-400 bg-amber-500/10',
  MORT: 'text-muted-foreground bg-muted/50',
  VAINCU: 'text-green-400 bg-green-500/10',
};

export function BattlefieldView({ gameId, className }: BattlefieldViewProps) {
  const [battlefield, setBattlefield] = useState<BattlefieldSlot[]>([]);
  const [monsters, setMonsters] = useState<Monster[]>([]);
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
          table: 'battlefield',
          filter: `game_id=eq.${gameId}`,
        },
        () => fetchData()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'monsters',
          filter: `game_id=eq.${gameId}`,
        },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  const fetchData = async () => {
    const [battlefieldRes, monstersRes] = await Promise.all([
      supabase
        .from('battlefield')
        .select('*')
        .eq('game_id', gameId)
        .order('slot', { ascending: true }),
      supabase
        .from('monsters')
        .select('*')
        .eq('game_id', gameId),
    ]);

    if (battlefieldRes.data) {
      setBattlefield(battlefieldRes.data);
    }
    if (monstersRes.data) {
      setMonsters(monstersRes.data);
    }
    setLoading(false);
  };

  const getMonsterForSlot = (slotNum: number): Monster | null => {
    const slot = battlefield.find((s) => s.slot === slotNum);
    if (!slot || !slot.monstre_id_en_place) return null;
    return monsters.find((m) => m.monstre_id === slot.monstre_id_en_place) || null;
  };

  const slots = [1, 2, 3];

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
        <Swords className="h-4 w-4 text-red-400" />
        <h3 className="font-display text-sm">Champ de Bataille</h3>
      </div>

      <div className="p-4 grid grid-cols-3 gap-3">
        {slots.map((slotNum) => {
          const monster = getMonsterForSlot(slotNum);
          const slotData = battlefield.find((s) => s.slot === slotNum);
          
          return (
            <div
              key={slotNum}
              className="flex flex-col items-center p-3 rounded-lg bg-secondary/30 border border-border min-h-[140px]"
            >
              <div className="text-xs text-muted-foreground mb-2">Slot {slotNum}</div>
              
              {monster ? (
                <>
                  <div className="text-2xl mb-1">
                    {monster.statut === 'MORT' || monster.statut === 'VAINCU' ? (
                      <Skull className="h-8 w-8 text-muted-foreground" />
                    ) : (
                      '🐉'
                    )}
                  </div>
                  <div className="text-sm font-medium text-center truncate w-full">
                    {monster.type}
                  </div>
                  
                  <div className="w-full mt-2 space-y-1">
                    <div className="flex items-center gap-1 text-xs">
                      <Heart className="h-3 w-3 text-red-400" />
                      <span>{monster.pv_actuels}/{monster.pv_max}</span>
                    </div>
                    <Progress 
                      value={(monster.pv_actuels / monster.pv_max) * 100} 
                      className="h-1.5"
                    />
                  </div>

                  {slotData?.pv_miroir && slotData.pv_miroir > 0 && (
                    <div className="flex items-center gap-1 text-xs mt-1 text-cyan-400">
                      <Shield className="h-3 w-3" />
                      <span>Miroir: {slotData.pv_miroir}</span>
                    </div>
                  )}

                  <div className={`text-xs mt-2 px-2 py-0.5 rounded ${statusColors[monster.statut] || ''}`}>
                    {monster.statut}
                  </div>
                </>
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
      {monsters.filter(m => m.statut === 'EN_FILE').length > 0 && (
        <div className="px-4 pb-4">
          <div className="text-xs text-muted-foreground mb-2">File d'attente</div>
          <div className="flex flex-wrap gap-2">
            {monsters
              .filter((m) => m.statut === 'EN_FILE')
              .map((monster) => (
                <div
                  key={monster.id}
                  className="flex items-center gap-1 text-xs bg-amber-500/10 text-amber-400 px-2 py-1 rounded"
                >
                  <span>🐉</span>
                  <span>{monster.type}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}