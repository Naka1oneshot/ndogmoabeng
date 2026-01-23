import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Loader2, Swords, Heart, Skull, Target, Trophy, Flag, FastForward } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { ForestButton } from '@/components/ui/ForestButton';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CombatLogsDetailedPanel } from './CombatLogsDetailedPanel';

interface GamePlayer {
  id: string;
  display_name: string;
  player_number: number;
  jetons: number;
  recompenses: number;
}

interface Game {
  id: string;
  manche_active: number;
  mode?: string;
  adventure_id?: string | null;
  current_session_game_id?: string | null;
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
  isAdventure?: boolean;
  onNextGame?: () => void;
}

// Combat-related action types to filter
const COMBAT_ACTIONS = [
  'DEGATS', 'SOIN', 'PROTECTION', 'GAZ', 'BOUCLIER', 'VOILE', 
  'KILL', 'REMPLACEMENT', 'SCHEDULE', 'PENDING', 'CONSO', 
  'ATK_USED', 'FALLBACK', 'COMBAT_FIN', 'INVENTAIRE_CONSO',
  'ATTAQUE', 'EFFECT', 'COMBAT_RESOLUTION', 'COMBAT_RESOLU', 'COMBAT_DATA'
];

export function MJCombatTab({ game, isAdventure, onNextGame }: MJCombatTabProps) {
  const [monsters, setMonsters] = useState<MonsterState[]>([]);
  const [combatLogs, setCombatLogs] = useState<CombatLog[]>([]);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [availableManches, setAvailableManches] = useState<number[]>([]);
  const [showFinalRanking, setShowFinalRanking] = useState(false);
  const [endingGame, setEndingGame] = useState(false);

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

    // Fetch players
    const { data: playersData } = await supabase
      .from('game_players')
      .select('id, display_name, player_number, jetons, recompenses')
      .eq('game_id', game.id)
      .is('removed_at', null)
      .order('player_number', { ascending: true });
    
    if (playersData) {
      setPlayers(playersData.map(p => ({
        ...p,
        jetons: p.jetons ?? 0,
        recompenses: p.recompenses ?? 0,
      })));
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${game.id}` }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [game.id, fetchData]);

  // Check if all monsters are dead
  const allMonstersDead = monsters.length > 0 && monsters.every(m => m.status === 'MORT');

  // Calculate player scores and ranking
  const playerRanking = players
    .map(p => ({
      ...p,
      score: p.jetons + p.recompenses,
    }))
    .sort((a, b) => b.score - a.score);

  const handleEndGame = async () => {
    setEndingGame(true);
    try {
      // Find winner (player with highest score)
      const winnerUserId = playerRanking[0]?.id ? 
        players.find(p => p.id === playerRanking[0].id)?.id : null;
      
      // We need to get the user_id from game_players
      const { data: winnerData } = await supabase
        .from('game_players')
        .select('user_id')
        .eq('game_id', game.id)
        .eq('status', 'ACTIVE')
        .order('jetons', { ascending: false })
        .limit(1)
        .single();
      
      // Update game status to ENDED
      const { error } = await supabase
        .from('games')
        .update({ status: 'ENDED', phase: 'FINISHED', winner_declared: true })
        .eq('id', game.id);

      if (error) throw error;

      // Update player profile statistics
      const { error: statsError } = await supabase.rpc('update_player_stats_on_game_end', {
        p_game_id: game.id,
        p_winner_user_id: winnerData?.user_id || null
      });
      
      if (statsError) {
        console.error('Stats update error:', statsError);
      }

      // Log the end
      await supabase.from('logs_mj').insert({
        game_id: game.id,
        manche: game.manche_active,
        action: 'FIN_PARTIE',
        details: 'La partie est terminée - tous les monstres ont été vaincus',
      });

      await supabase.from('session_events').insert({
        game_id: game.id,
        type: 'GAME_END',
        audience: 'ALL',
        message: 'La partie est terminée ! Tous les monstres ont été vaincus.',
      });

      toast.success('Partie terminée ! Statistiques mises à jour.');
      setShowFinalRanking(true);
    } catch (error) {
      console.error('Error ending game:', error);
      toast.error('Erreur lors de la fin de partie');
    } finally {
      setEndingGame(false);
    }
  };

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

      {/* End game button when all monsters are dead */}
      {allMonstersDead && !showFinalRanking && (
        <div className="card-gradient rounded-lg border-2 border-amber-500/50 bg-amber-500/10 p-6 text-center">
          <Trophy className="h-12 w-12 mx-auto mb-4 text-amber-500" />
          <h3 className="font-display text-xl mb-2">Tous les monstres sont vaincus !</h3>
          <p className="text-muted-foreground mb-4">
            La forêt est sécurisée. Vous pouvez maintenant terminer la partie et afficher le classement final.
          </p>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <ForestButton
                size="lg"
                className="bg-amber-600 hover:bg-amber-700"
                disabled={endingGame}
              >
                {endingGame ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : (
                  <Flag className="h-5 w-5 mr-2" />
                )}
                Terminer la partie
              </ForestButton>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Terminer la partie ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action terminera définitivement la partie et affichera le classement final.
                  Les joueurs verront leurs scores finaux.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-amber-600 text-white hover:bg-amber-700"
                  onClick={handleEndGame}
                >
                  Terminer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {/* Final ranking display */}
      {showFinalRanking && (
        <div className="card-gradient rounded-lg border-2 border-primary/50 p-6">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Trophy className="h-8 w-8 text-amber-500" />
            <h3 className="font-display text-2xl">
              {isAdventure ? 'Classement Intermédiaire' : 'Classement Final'}
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3">Rang</th>
                  <th className="text-left py-2 px-3">Joueur</th>
                  <th className="text-right py-2 px-3">Jetons</th>
                  <th className="text-right py-2 px-3">Récompenses</th>
                  <th className="text-right py-2 px-3">Score Total</th>
                </tr>
              </thead>
              <tbody>
                {playerRanking.map((player, index) => (
                  <tr key={player.id} className={`border-b border-border/50 ${index < 3 ? 'bg-primary/10' : ''}`}>
                    <td className="py-3 px-3">
                      <span className={`font-bold ${index === 0 ? 'text-amber-500' : index === 1 ? 'text-gray-400' : index === 2 ? 'text-amber-700' : ''}`}>
                        #{index + 1}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-medium">{player.display_name}</td>
                    <td className="py-3 px-3 text-right">{player.jetons}</td>
                    <td className="py-3 px-3 text-right text-amber-500">+{player.recompenses}</td>
                    <td className="py-3 px-3 text-right font-bold text-lg">{player.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-center gap-3 mt-6">
            {isAdventure && onNextGame ? (
              <ForestButton
                size="lg"
                onClick={onNextGame}
                className="bg-primary hover:bg-primary/90"
              >
                <FastForward className="h-5 w-5 mr-2" />
                Jeu suivant
              </ForestButton>
            ) : (
              <ForestButton
                size="lg"
                variant="outline"
                onClick={() => setShowFinalRanking(false)}
              >
                Fermer
              </ForestButton>
            )}
          </div>
        </div>
      )}

      {/* Logs combat détaillés (MJ) */}
      <CombatLogsDetailedPanel
        logs={combatLogs}
        currentManche={game.manche_active}
        availableManches={availableManches}
      />
    </div>
  );
}
