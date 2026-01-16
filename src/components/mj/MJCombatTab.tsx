import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ForestButton } from '@/components/ui/ForestButton';
import { Badge } from '@/components/ui/badge';
import { Loader2, Swords, Heart, Skull, Shield, Target } from 'lucide-react';

interface Game {
  id: string;
  manche_active: number;
}

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
  slot: number;
  monstre_id_en_place: number | null;
  pv_miroir: number;
}

interface MJCombatTabProps {
  game: Game;
}

export function MJCombatTab({ game }: MJCombatTabProps) {
  const [monsters, setMonsters] = useState<Monster[]>([]);
  const [battlefield, setBattlefield] = useState<BattlefieldSlot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel(`mj-combat-${game.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'monsters', filter: `game_id=eq.${game.id}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battlefield', filter: `game_id=eq.${game.id}` }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [game.id]);

  const fetchData = async () => {
    const [monstersRes, battlefieldRes] = await Promise.all([
      supabase.from('monsters').select('*').eq('game_id', game.id).order('monstre_id'),
      supabase.from('battlefield').select('*').eq('game_id', game.id).order('slot'),
    ]);

    if (monstersRes.data) setMonsters(monstersRes.data);
    if (battlefieldRes.data) setBattlefield(battlefieldRes.data);
    setLoading(false);
  };

  const getMonsterForSlot = (slot: BattlefieldSlot): Monster | undefined => {
    if (!slot.monstre_id_en_place) return undefined;
    return monsters.find(m => m.monstre_id === slot.monstre_id_en_place);
  };

  const getStatusBadge = (statut: string) => {
    switch (statut) {
      case 'EN_BATAILLE':
        return <Badge className="bg-red-500">En bataille</Badge>;
      case 'EN_FILE':
        return <Badge variant="secondary">En file</Badge>;
      case 'MORT':
        return <Badge variant="outline" className="text-muted-foreground">Mort</Badge>;
      default:
        return <Badge variant="outline">{statut}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const slots = [1, 2, 3].map(slotNum => {
    const slot = battlefield.find(b => b.slot === slotNum);
    return slot || { slot: slotNum, monstre_id_en_place: null, pv_miroir: 0 };
  });

  const queueMonsters = monsters.filter(m => m.statut === 'EN_FILE');
  const deadMonsters = monsters.filter(m => m.statut === 'MORT');

  return (
    <div className="space-y-6">
      {/* Champ de bataille */}
      <div className="card-gradient rounded-lg border border-border p-6">
        <h3 className="font-display text-lg mb-4 flex items-center gap-2">
          <Swords className="h-5 w-5 text-primary" />
          Champ de bataille
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {slots.map((slot) => {
            const monster = getMonsterForSlot(slot);
            return (
              <div
                key={slot.slot}
                className={`p-4 rounded-lg border-2 ${
                  monster ? 'border-red-500/50 bg-red-500/10' : 'border-dashed border-muted'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-muted-foreground">
                    Slot {slot.slot}
                  </span>
                  {slot.pv_miroir > 0 && (
                    <Badge variant="outline" className="text-blue-400">
                      <Shield className="h-3 w-3 mr-1" />
                      Miroir: {slot.pv_miroir}
                    </Badge>
                  )}
                </div>

                {monster ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-red-500" />
                      <span className="font-medium">{monster.type}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Heart className="h-4 w-4 text-red-400" />
                      <div className="flex-1 bg-secondary rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full bg-red-500 transition-all"
                          style={{ width: `${(monster.pv_actuels / monster.pv_max) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-mono">
                        {monster.pv_actuels}/{monster.pv_max}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Récompense: {monster.recompense} jetons
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    <Skull className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <span className="text-sm">Slot vide</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* File d'attente des monstres */}
      <div className="card-gradient rounded-lg border border-border p-6">
        <h3 className="font-display text-lg mb-4">
          Monstres en file ({queueMonsters.length})
        </h3>

        {queueMonsters.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-4">
            Aucun monstre en attente
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {queueMonsters.map((monster) => (
              <div key={monster.id} className="p-3 bg-secondary/50 rounded-lg">
                <div className="font-medium text-sm">{monster.type}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Heart className="h-3 w-3" />
                  {monster.pv_actuels}/{monster.pv_max}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Monstres morts */}
      {deadMonsters.length > 0 && (
        <div className="card-gradient rounded-lg border border-border/50 p-6 opacity-75">
          <h3 className="font-display text-sm mb-4 text-muted-foreground">
            Monstres vaincus ({deadMonsters.length})
          </h3>

          <div className="flex flex-wrap gap-2">
            {deadMonsters.map((monster) => (
              <Badge key={monster.id} variant="outline" className="text-muted-foreground">
                <Skull className="h-3 w-3 mr-1" />
                {monster.type}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Note */}
      <div className="p-4 bg-muted/30 rounded-lg border border-border">
        <p className="text-sm text-muted-foreground">
          💡 La résolution du combat est gérée manuellement. Utilisez les outils de gestion 
          de la base de données pour mettre à jour les PV des monstres et les positions des joueurs.
        </p>
      </div>
    </div>
  );
}
