import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, BarChart3, Bot, User, Trophy, Coins, Swords, Target, TrendingUp, TrendingDown } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface PlayerStats {
  id: string;
  display_name: string;
  is_bot: boolean;
  jetons: number;
  recompenses: number;
  starting_tokens: number;
}

interface AggregatedStats {
  count: number;
  totalJetons: number;
  totalRecompenses: number;
  avgJetons: number;
  avgRecompenses: number;
  totalStarting: number;
  avgStarting: number;
  netGain: number;
  avgNetGain: number;
}

interface CombatStats {
  kills: number;
  totalDamage: number;
}

interface BotVsHumanStatsSheetProps {
  gameId: string;
  sessionGameId?: string | null;
  startingTokens: number;
}

export function BotVsHumanStatsSheet({ gameId, sessionGameId, startingTokens }: BotVsHumanStatsSheetProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [players, setPlayers] = useState<PlayerStats[]>([]);
  const [combatData, setCombatData] = useState<{ bots: CombatStats; humans: CombatStats }>({
    bots: { kills: 0, totalDamage: 0 },
    humans: { kills: 0, totalDamage: 0 }
  });

  const fetchStats = useCallback(async () => {
    setLoading(true);
    
    try {
      // Fetch players
      const { data: playersData, error: playersError } = await supabase
        .from('game_players')
        .select('id, display_name, is_bot, jetons, recompenses')
        .eq('game_id', gameId)
        .eq('status', 'ACTIVE')
        .eq('is_host', false);
      
      if (playersError) throw playersError;
      
      const mappedPlayers = (playersData || []).map(p => ({
        ...p,
        starting_tokens: startingTokens
      }));
      setPlayers(mappedPlayers);

      // Fetch combat results for kills and damage
      let combatQuery = supabase
        .from('combat_results')
        .select('kills, public_summary')
        .eq('game_id', gameId);
      
      if (sessionGameId) {
        combatQuery = combatQuery.eq('session_game_id', sessionGameId);
      }

      const { data: combatResults, error: combatError } = await combatQuery;
      
      if (combatError) throw combatError;

      // Build a map of player names to is_bot
      const playerBotMap = new Map<string, boolean>();
      mappedPlayers.forEach(p => {
        playerBotMap.set(p.display_name, p.is_bot);
      });

      // Aggregate combat stats
      const botCombat: CombatStats = { kills: 0, totalDamage: 0 };
      const humanCombat: CombatStats = { kills: 0, totalDamage: 0 };

      (combatResults || []).forEach(result => {
        // Process kills
        const kills = Array.isArray(result.kills) ? result.kills : [];
        kills.forEach((kill: { killerName?: string }) => {
          if (kill.killerName) {
            const isBot = playerBotMap.get(kill.killerName);
            if (isBot === true) {
              botCombat.kills++;
            } else if (isBot === false) {
              humanCombat.kills++;
            }
          }
        });

        // Process damage from public_summary
        const summary = Array.isArray(result.public_summary) ? result.public_summary : [];
        summary.forEach((entry: { nom?: string; totalDamage?: number; cancelled?: boolean }) => {
          if (entry.cancelled) return;
          if (entry.nom) {
            const isBot = playerBotMap.get(entry.nom);
            const dmg = entry.totalDamage || 0;
            if (isBot === true) {
              botCombat.totalDamage += dmg;
            } else if (isBot === false) {
              humanCombat.totalDamage += dmg;
            }
          }
        });
      });

      setCombatData({ bots: botCombat, humans: humanCombat });
    } catch (err) {
      console.error('[BotVsHumanStats] Error:', err);
    }
    
    setLoading(false);
  }, [gameId, sessionGameId, startingTokens]);

  useEffect(() => {
    if (open) {
      fetchStats();
    }
  }, [open, fetchStats]);

  // Aggregate stats
  const bots = players.filter(p => p.is_bot);
  const humans = players.filter(p => !p.is_bot);

  const aggregateStats = (list: PlayerStats[]): AggregatedStats => {
    const count = list.length;
    if (count === 0) {
      return {
        count: 0,
        totalJetons: 0,
        totalRecompenses: 0,
        avgJetons: 0,
        avgRecompenses: 0,
        totalStarting: 0,
        avgStarting: 0,
        netGain: 0,
        avgNetGain: 0
      };
    }
    const totalJetons = list.reduce((sum, p) => sum + (p.jetons || 0), 0);
    const totalRecompenses = list.reduce((sum, p) => sum + (p.recompenses || 0), 0);
    const totalStarting = list.reduce((sum, p) => sum + p.starting_tokens, 0);
    const netGain = totalJetons - totalStarting;
    
    return {
      count,
      totalJetons,
      totalRecompenses,
      avgJetons: Math.round(totalJetons / count),
      avgRecompenses: Math.round(totalRecompenses / count),
      totalStarting,
      avgStarting: Math.round(totalStarting / count),
      netGain,
      avgNetGain: Math.round(netGain / count)
    };
  };

  const botStats = aggregateStats(bots);
  const humanStats = aggregateStats(humans);

  const totalPlayers = botStats.count + humanStats.count;
  const botPercentage = totalPlayers > 0 ? (botStats.count / totalPlayers) * 100 : 0;

  // Compare metrics
  const compareMetric = (botVal: number, humanVal: number) => {
    if (botVal > humanVal) return 'bot';
    if (humanVal > botVal) return 'human';
    return 'tie';
  };

  const StatCard = ({ 
    label, 
    botValue, 
    humanValue, 
    icon: Icon,
    format = (v: number) => v.toString()
  }: { 
    label: string; 
    botValue: number; 
    humanValue: number; 
    icon: React.ElementType;
    format?: (v: number) => string;
  }) => {
    const winner = compareMetric(botValue, humanValue);
    
    return (
      <div className="bg-card/50 rounded-lg border border-border p-3">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className={`text-center p-2 rounded ${winner === 'bot' ? 'bg-blue-500/20 border border-blue-500/50' : 'bg-secondary/50'}`}>
            <div className="flex items-center justify-center gap-1 mb-1">
              <Bot className="h-3 w-3 text-blue-400" />
              <span className="text-[10px] text-muted-foreground">Bots</span>
            </div>
            <div className={`text-sm font-bold ${winner === 'bot' ? 'text-blue-400' : 'text-foreground'}`}>
              {format(botValue)}
            </div>
          </div>
          <div className={`text-center p-2 rounded ${winner === 'human' ? 'bg-green-500/20 border border-green-500/50' : 'bg-secondary/50'}`}>
            <div className="flex items-center justify-center gap-1 mb-1">
              <User className="h-3 w-3 text-green-400" />
              <span className="text-[10px] text-muted-foreground">Humains</span>
            </div>
            <div className={`text-sm font-bold ${winner === 'human' ? 'text-green-400' : 'text-foreground'}`}>
              {format(humanValue)}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-1.5 bg-card/50 border-border hover:bg-card"
        >
          <BarChart3 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline text-xs">Stats Bots vs Humains</span>
          <span className="sm:hidden text-xs">Stats</span>
        </Button>
      </SheetTrigger>
      <SheetContent 
        side="right" 
        className="w-full sm:w-[480px] bg-background/95 backdrop-blur-md border-border overflow-y-auto"
      >
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5 text-primary" />
            Statistiques Bots vs Humains
          </SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Chargement des statistiques...</p>
          </div>
        ) : players.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg font-medium">Aucun joueur</p>
            <p className="text-sm mt-2">Les statistiques apparaîtront une fois les joueurs ajoutés.</p>
          </div>
        ) : (
          <ScrollArea className="h-[calc(100vh-120px)] pr-4">
            <div className="space-y-4">
              {/* Population Overview */}
              <div className="bg-card/50 rounded-xl border border-border p-4">
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  Répartition des Joueurs
                </h3>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-blue-400" />
                    <span className="text-sm">{botStats.count} Bots</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{humanStats.count} Humains</span>
                    <User className="h-4 w-4 text-green-400" />
                  </div>
                </div>
                <Progress value={botPercentage} className="h-2" />
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-blue-400">{botPercentage.toFixed(0)}%</span>
                  <span className="text-[10px] text-green-400">{(100 - botPercentage).toFixed(0)}%</span>
                </div>
              </div>

              {/* Economic Stats */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Coins className="h-4 w-4 text-amber-500" />
                  Performance Économique
                </h3>
                
                <StatCard 
                  label="Jetons Moyens Actuels" 
                  botValue={botStats.avgJetons} 
                  humanValue={humanStats.avgJetons}
                  icon={Coins}
                />
                
                <StatCard 
                  label="Récompenses Moyennes" 
                  botValue={botStats.avgRecompenses} 
                  humanValue={humanStats.avgRecompenses}
                  icon={Trophy}
                />
                
                <StatCard 
                  label="Gain Net Moyen" 
                  botValue={botStats.avgNetGain} 
                  humanValue={humanStats.avgNetGain}
                  icon={botStats.avgNetGain >= 0 ? TrendingUp : TrendingDown}
                  format={(v) => (v >= 0 ? '+' : '') + v}
                />
              </div>

              {/* Combat Stats */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Swords className="h-4 w-4 text-destructive" />
                  Performance Combat
                </h3>
                
                <StatCard 
                  label="Coups de Grâce (Total)" 
                  botValue={combatData.bots.kills} 
                  humanValue={combatData.humans.kills}
                  icon={Swords}
                />
                
                <StatCard 
                  label="Dégâts Totaux Infligés" 
                  botValue={combatData.bots.totalDamage} 
                  humanValue={combatData.humans.totalDamage}
                  icon={Target}
                />

                {/* Per-player averages for combat */}
                {(botStats.count > 0 || humanStats.count > 0) && (
                  <>
                    <StatCard 
                      label="Kills par Joueur (Moy.)" 
                      botValue={botStats.count > 0 ? Math.round((combatData.bots.kills / botStats.count) * 10) / 10 : 0} 
                      humanValue={humanStats.count > 0 ? Math.round((combatData.humans.kills / humanStats.count) * 10) / 10 : 0}
                      icon={Swords}
                      format={(v) => v.toFixed(1)}
                    />
                    
                    <StatCard 
                      label="Dégâts par Joueur (Moy.)" 
                      botValue={botStats.count > 0 ? Math.round(combatData.bots.totalDamage / botStats.count) : 0} 
                      humanValue={humanStats.count > 0 ? Math.round(combatData.humans.totalDamage / humanStats.count) : 0}
                      icon={Target}
                    />
                  </>
                )}
              </div>

              {/* Top Performers */}
              <div className="bg-card/50 rounded-xl border border-border p-4">
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  Top 5 Joueurs (Récompenses)
                </h3>
                <div className="space-y-2">
                  {[...players]
                    .sort((a, b) => (b.recompenses || 0) - (a.recompenses || 0))
                    .slice(0, 5)
                    .map((player, index) => (
                      <div 
                        key={player.id}
                        className={`flex items-center justify-between p-2 rounded-lg ${
                          index === 0 ? 'bg-amber-500/20 border border-amber-500/50' : 'bg-secondary/50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold w-6">
                            {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                          </span>
                          {player.is_bot ? (
                            <Bot className="h-3.5 w-3.5 text-blue-400" />
                          ) : (
                            <User className="h-3.5 w-3.5 text-green-400" />
                          )}
                          <span className="font-medium text-sm">{player.display_name}</span>
                          <Badge 
                            variant="outline" 
                            className={`text-[10px] ${player.is_bot ? 'border-blue-500/50 text-blue-400' : 'border-green-500/50 text-green-400'}`}
                          >
                            {player.is_bot ? 'Bot' : 'Humain'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1 text-amber-500 font-bold text-sm">
                          <Trophy className="h-3.5 w-3.5" />
                          {player.recompenses || 0}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  );
}
