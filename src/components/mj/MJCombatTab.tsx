import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Swords, Heart, Skull, Target, Trophy, FileText, Clock, Copy, Check } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ForestButton } from '@/components/ui/ForestButton';
import { toast } from 'sonner';

interface Game {
  id: string;
  manche_active: number;
}

interface MonsterState {
  id: string;
  monster_id: number;
  pv_current: number;
  status: 'EN_BATAILLE' | 'EN_FILE' | 'MORT';
  battlefield_slot: number | null;
  catalog?: {
    name: string;
    pv_max_default: number;
    reward_default: number;
  };
  config?: {
    pv_max_override: number | null;
    reward_override: number | null;
  };
}

interface CombatLog {
  id: string;
  manche: number | null;
  num_joueur: number | null;
  action: string;
  details: string | null;
  timestamp: string | null;
}

interface MJCombatTabProps {
  game: Game;
}

// Combat-related action types to filter
const COMBAT_ACTIONS = [
  'DEGATS', 'SOIN', 'PROTECTION', 'GAZ', 'BOUCLIER', 'VOILE', 
  'KILL', 'REMPLACEMENT', 'SCHEDULE', 'PENDING', 'CONSO', 
  'ATK_USED', 'FALLBACK', 'COMBAT_FIN', 'INVENTAIRE_CONSO',
  'ATTAQUE', 'EFFECT', 'COMBAT_RESOLUTION'
];

export function MJCombatTab({ game }: MJCombatTabProps) {
  const [monsters, setMonsters] = useState<MonsterState[]>([]);
  const [combatLogs, setCombatLogs] = useState<CombatLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedManche, setSelectedManche] = useState<string>('current');
  const [availableManches, setAvailableManches] = useState<number[]>([]);
  const [copied, setCopied] = useState(false);

  const fetchData = useCallback(async () => {
    // Fetch monsters
    const { data: stateData } = await supabase
      .from('game_state_monsters')
      .select('id, monster_id, pv_current, status, battlefield_slot')
      .eq('game_id', game.id)
      .order('battlefield_slot', { ascending: true, nullsFirst: false });

    if (stateData && stateData.length > 0) {
      const monsterIds = stateData.map(m => m.monster_id);
      const [catalogRes, configRes] = await Promise.all([
        supabase.from('monster_catalog').select('id, name, pv_max_default, reward_default').in('id', monsterIds),
        supabase.from('game_monsters').select('monster_id, pv_max_override, reward_override').eq('game_id', game.id).in('monster_id', monsterIds),
      ]);

      const catalogMap = new Map((catalogRes.data || []).map(c => [c.id, c]));
      const configMap = new Map((configRes.data || []).map(c => [c.monster_id, c]));

      const enriched: MonsterState[] = stateData.map(m => ({
        ...m,
        status: m.status as 'EN_BATAILLE' | 'EN_FILE' | 'MORT',
        catalog: catalogMap.get(m.monster_id),
        config: configMap.get(m.monster_id),
      }));

      setMonsters(enriched);
    } else {
      setMonsters([]);
    }

    // Fetch combat logs
    const { data: logsData } = await supabase
      .from('logs_mj')
      .select('*')
      .eq('game_id', game.id)
      .order('manche', { ascending: true })
      .order('timestamp', { ascending: true });

    if (logsData) {
      // Filter to combat-related actions
      const combatLogs = logsData.filter(log => 
        COMBAT_ACTIONS.some(action => log.action?.toUpperCase().includes(action))
      );
      setCombatLogs(combatLogs);
      
      // Calculate available manches
      const mancheSet = new Set(logsData.map(l => l.manche).filter(Boolean) as number[]);
      mancheSet.add(game.manche_active);
      setAvailableManches(Array.from(mancheSet).sort((a, b) => a - b));
    }

    setLoading(false);
  }, [game.id, game.manche_active]);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel(`mj-combat-${game.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_state_monsters', filter: `game_id=eq.${game.id}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'logs_mj', filter: `game_id=eq.${game.id}` }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [game.id, fetchData]);

  const getMonsterPvMax = (m: MonsterState): number => m.config?.pv_max_override ?? m.catalog?.pv_max_default ?? 10;
  const getMonsterReward = (m: MonsterState): number => m.config?.reward_override ?? m.catalog?.reward_default ?? 10;
  const getMonsterName = (m: MonsterState): string => m.catalog?.name ?? `Monstre #${m.monster_id}`;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'EN_BATAILLE':
        return <Badge className="bg-red-500">En bataille</Badge>;
      case 'EN_FILE':
        return <Badge variant="secondary">En file</Badge>;
      case 'MORT':
        return <Badge variant="outline" className="text-muted-foreground">Mort</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getActionBadge = (action: string) => {
    const upperAction = action.toUpperCase();
    if (upperAction.includes('DEGATS') || upperAction.includes('ATTAQUE')) {
      return <Badge variant="destructive" className="text-xs">{action}</Badge>;
    }
    if (upperAction.includes('SOIN')) {
      return <Badge className="bg-green-500 text-xs">{action}</Badge>;
    }
    if (upperAction.includes('KILL')) {
      return <Badge variant="destructive" className="text-xs font-bold">{action}</Badge>;
    }
    if (upperAction.includes('PROTECTION') || upperAction.includes('BOUCLIER') || upperAction.includes('GAZ') || upperAction.includes('VOILE')) {
      return <Badge className="bg-blue-500 text-xs">{action}</Badge>;
    }
    if (upperAction.includes('CONSO') || upperAction.includes('INVENTAIRE')) {
      return <Badge className="bg-amber-500 text-xs">{action}</Badge>;
    }
    return <Badge variant="outline" className="text-xs">{action}</Badge>;
  };

  // Filter logs by selected manche
  const displayManche = selectedManche === 'current' 
    ? game.manche_active 
    : parseInt(selectedManche);
  
  const filteredLogs = combatLogs.filter(log => log.manche === displayManche);

  const handleCopyLogs = async () => {
    const logsText = filteredLogs.map(log => 
      `[${log.timestamp ? format(new Date(log.timestamp), 'HH:mm:ss') : '??:??:??'}] ${log.num_joueur ? `P${log.num_joueur}` : ''} ${log.action}: ${log.details || ''}`
    ).join('\n');
    
    try {
      await navigator.clipboard.writeText(logsText);
      setCopied(true);
      toast.success('Logs copiés !');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Erreur lors de la copie');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const battlefieldMonsters = monsters.filter(m => m.status === 'EN_BATAILLE' && m.battlefield_slot);
  const queueMonsters = monsters.filter(m => m.status === 'EN_FILE');
  const deadMonsters = monsters.filter(m => m.status === 'MORT');

  const slots = [1, 2, 3];

  return (
    <div className="space-y-6">
      {/* Champ de bataille */}
      <div className="card-gradient rounded-lg border border-border p-6">
        <h3 className="font-display text-lg mb-4 flex items-center gap-2">
          <Swords className="h-5 w-5 text-primary" />
          Champ de bataille
          <span className="text-sm text-muted-foreground ml-auto">
            {battlefieldMonsters.length}/3 actifs • {queueMonsters.length} en file
          </span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {slots.map((slotNum) => {
            const monster = battlefieldMonsters.find(m => m.battlefield_slot === slotNum);
            return (
              <div
                key={slotNum}
                className={`p-4 rounded-lg border-2 ${
                  monster ? 'border-red-500/50 bg-red-500/10' : 'border-dashed border-muted'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-muted-foreground">
                    Slot {slotNum}
                  </span>
                  {monster && (
                    <span className="text-xs text-muted-foreground">ID: {monster.monster_id}</span>
                  )}
                </div>

                {monster ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-red-500" />
                      <span className="font-medium">{getMonsterName(monster)}</span>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-1">
                          <Heart className="h-4 w-4 text-red-400" />
                          <span className="font-mono">{monster.pv_current}/{getMonsterPvMax(monster)}</span>
                        </div>
                        <div className="flex items-center gap-1 text-amber-400">
                          <Trophy className="h-4 w-4" />
                          <span>{getMonsterReward(monster)}</span>
                        </div>
                      </div>
                      <Progress 
                        value={(monster.pv_current / getMonsterPvMax(monster)) * 100} 
                        className="h-2"
                      />
                    </div>
                    
                    {getStatusBadge(monster.status)}
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
                <div className="font-medium text-sm">{getMonsterName(monster)}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Heart className="h-3 w-3" />
                  {monster.pv_current}/{getMonsterPvMax(monster)}
                </div>
                <div className="text-xs text-amber-400 flex items-center gap-1">
                  <Trophy className="h-3 w-3" />
                  {getMonsterReward(monster)} jetons
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
                {getMonsterName(monster)}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Logs combat détaillés (MJ) */}
      <div className="card-gradient rounded-lg border border-border p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <h3 className="font-display text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Logs combat détaillés (MJ)
          </h3>
          
          <div className="flex items-center gap-3">
            <Select value={selectedManche} onValueChange={setSelectedManche}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">
                  Manche {game.manche_active} (actuelle)
                </SelectItem>
                {availableManches
                  .filter(m => m !== game.manche_active)
                  .map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      Manche {m}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            
            <ForestButton variant="outline" size="sm" onClick={handleCopyLogs} disabled={filteredLogs.length === 0}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </ForestButton>
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">
            Aucun log de combat pour cette manche
          </p>
        ) : (
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-2">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getActionBadge(log.action)}
                      {log.num_joueur && (
                        <Badge variant="outline" className="text-xs">
                          P{log.num_joueur}
                        </Badge>
                      )}
                      <span className="text-sm">{log.details || '-'}</span>
                    </div>
                    <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                      <Clock className="h-3 w-3" />
                      {log.timestamp ? format(new Date(log.timestamp), 'HH:mm:ss', { locale: fr }) : '??:??:??'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
          {filteredLogs.length} log(s) de combat trouvé(s) pour la manche {displayManche}
        </div>
      </div>
    </div>
  );
}
