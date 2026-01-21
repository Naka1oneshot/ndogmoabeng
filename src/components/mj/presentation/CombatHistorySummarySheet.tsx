import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, ScrollText, Swords, Trophy, Skull, Target, Users } from 'lucide-react';

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

interface WeaponStats {
  name: string;
  usageCount: number;
  totalDamage: number;
  playerNames: string[];
}

interface PlayerStats {
  name: string;
  totalDamage: number;
  kills: number;
  totalRewards: number;
  weaponsUsed: string[];
}

interface CombatHistorySummarySheetProps {
  gameId: string;
  sessionGameId?: string | null;
}

export function CombatHistorySummarySheet({ gameId, sessionGameId }: CombatHistorySummarySheetProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [combatResults, setCombatResults] = useState<CombatResult[]>([]);

  useEffect(() => {
    if (open) {
      fetchCombatHistory();
    }
  }, [open, gameId, sessionGameId]);

  const fetchCombatHistory = async () => {
    setLoading(true);
    
    let query = supabase
      .from('combat_results')
      .select('id, manche, kills, public_summary, resolved_at')
      .eq('game_id', gameId)
      .order('manche', { ascending: true });
    
    if (sessionGameId) {
      query = query.eq('session_game_id', sessionGameId);
    }

    const { data, error } = await query;
    
    if (error) {
      console.error('[CombatHistorySummary] Error fetching:', error);
    } else {
      // Parse JSON fields properly
      const parsed = (data || []).map(r => ({
        ...r,
        kills: (r.kills as unknown as Kill[]) || [],
        public_summary: (r.public_summary as unknown as PublicSummaryEntry[]) || [],
      }));
      setCombatResults(parsed);
    }
    
    setLoading(false);
  };

  // Aggregate stats
  const allKills = combatResults.flatMap(r => r.kills);
  const allSummaries = combatResults.flatMap(r => r.public_summary);

  // Weapon stats: aggregate by weapon name
  const weaponStatsMap = new Map<string, WeaponStats>();
  allSummaries.forEach(entry => {
    if (entry.cancelled) return;
    entry.weapons?.forEach(weapon => {
      const existing = weaponStatsMap.get(weapon) || { 
        name: weapon, 
        usageCount: 0, 
        totalDamage: 0, 
        playerNames: [] 
      };
      existing.usageCount++;
      existing.totalDamage += entry.totalDamage;
      if (!existing.playerNames.includes(entry.nom)) {
        existing.playerNames.push(entry.nom);
      }
      weaponStatsMap.set(weapon, existing);
    });
  });
  const weaponStats = Array.from(weaponStatsMap.values())
    .sort((a, b) => b.usageCount - a.usageCount);

  // Player stats: aggregate by player name
  const playerStatsMap = new Map<string, PlayerStats>();
  allSummaries.forEach(entry => {
    if (entry.cancelled) return;
    const existing = playerStatsMap.get(entry.nom) || {
      name: entry.nom,
      totalDamage: 0,
      kills: 0,
      totalRewards: 0,
      weaponsUsed: [],
    };
    existing.totalDamage += entry.totalDamage;
    entry.weapons?.forEach(w => {
      if (!existing.weaponsUsed.includes(w)) {
        existing.weaponsUsed.push(w);
      }
    });
    playerStatsMap.set(entry.nom, existing);
  });

  // Add kills and rewards from kills data
  allKills.forEach(kill => {
    const existing = playerStatsMap.get(kill.killerName);
    if (existing) {
      existing.kills++;
      existing.totalRewards += kill.reward;
    }
  });

  const playerStats = Array.from(playerStatsMap.values())
    .sort((a, b) => b.totalRewards - a.totalRewards || b.kills - a.kills);

  // Kill details by manche
  const totalKills = allKills.length;
  const totalRewards = allKills.reduce((sum, k) => sum + k.reward, 0);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-1.5 bg-card/50 border-border hover:bg-card h-6 md:h-7 px-2"
        >
          <ScrollText className="h-3 md:h-3.5 w-3 md:w-3.5" />
          <span className="hidden sm:inline text-xs">Historique</span>
        </Button>
      </SheetTrigger>
      <SheetContent 
        side="right" 
        className="w-full sm:w-[540px] md:w-[600px] bg-background/95 backdrop-blur-md border-border"
      >
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <ScrollText className="h-5 w-5 text-primary" />
            Résumé Cumulé des Combats
          </SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : combatResults.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Swords className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Aucun combat résolu pour le moment</p>
          </div>
        ) : (
          <ScrollArea className="h-[calc(100vh-120px)] pr-4">
            <div className="space-y-6">
              {/* Global Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-destructive/10 rounded-lg border border-destructive/30 p-3 text-center">
                  <Skull className="h-5 w-5 mx-auto mb-1 text-destructive" />
                  <div className="text-xl font-bold text-destructive">{totalKills}</div>
                  <div className="text-xs text-muted-foreground">Coups de grâce</div>
                </div>
                <div className="bg-amber-500/10 rounded-lg border border-amber-500/30 p-3 text-center">
                  <Trophy className="h-5 w-5 mx-auto mb-1 text-amber-500" />
                  <div className="text-xl font-bold text-amber-500">{totalRewards}</div>
                  <div className="text-xs text-muted-foreground">Total Récompenses</div>
                </div>
                <div className="bg-blue-500/10 rounded-lg border border-blue-500/30 p-3 text-center">
                  <Target className="h-5 w-5 mx-auto mb-1 text-blue-500" />
                  <div className="text-xl font-bold text-blue-500">{combatResults.length}</div>
                  <div className="text-xs text-muted-foreground">Manches résolues</div>
                </div>
              </div>

              {/* Player Rankings */}
              <div className="bg-card/50 rounded-xl border border-border p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">Classement Joueurs</h3>
                </div>
                <div className="space-y-2">
                  {playerStats.map((player, index) => (
                    <div 
                      key={player.name}
                      className={`flex items-center justify-between p-2 rounded-lg ${
                        index === 0 ? 'bg-amber-500/20 border border-amber-500/50' :
                        'bg-secondary/50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold w-6">
                          {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                        </span>
                        <div>
                          <div className="font-medium text-sm">{player.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {player.totalDamage} dégâts • {player.weaponsUsed.length} armes
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-amber-500 font-bold">
                          <Trophy className="h-3.5 w-3.5" />
                          {player.totalRewards}
                        </div>
                        <div className="text-xs text-destructive">{player.kills} kills</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Weapon Stats */}
              <div className="bg-card/50 rounded-xl border border-border p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Swords className="h-4 w-4 text-destructive" />
                  <h3 className="font-semibold text-sm">Armes Utilisées</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {weaponStats.map(weapon => (
                    <Badge 
                      key={weapon.name} 
                      className="bg-destructive/20 text-foreground border-destructive/30 px-2 py-1"
                    >
                      <span className="font-medium">{weapon.name}</span>
                      <span className="ml-1.5 text-muted-foreground">×{weapon.usageCount}</span>
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Kill Details by Manche */}
              <div className="bg-card/50 rounded-xl border border-border p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Skull className="h-4 w-4 text-destructive" />
                  <h3 className="font-semibold text-sm">Détail des Coups de Grâce</h3>
                </div>
                <div className="space-y-3">
                  {combatResults.map(result => (
                    <div key={result.id} className="space-y-1">
                      <div className="text-xs font-medium text-muted-foreground">
                        Manche {result.manche}
                      </div>
                      {result.kills.length === 0 ? (
                        <div className="text-xs text-muted-foreground/50 italic">
                          Aucun coup de grâce
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {result.kills.map((kill, idx) => (
                            <div 
                              key={idx}
                              className="flex items-center justify-between text-xs bg-secondary/50 rounded-lg px-3 py-2"
                            >
                              <div>
                                <span className="font-medium text-foreground">{kill.killerName}</span>
                                <span className="text-muted-foreground"> a éliminé </span>
                                <span className="font-medium text-destructive">{kill.monsterName}</span>
                                <span className="text-muted-foreground"> (Slot {kill.slot})</span>
                                {kill.fromDot && (
                                  <Badge className="ml-2 text-[10px] bg-purple-500/20 text-purple-400 border-purple-500/30">
                                    DoT
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-1 text-amber-500 font-bold">
                                <Trophy className="h-3 w-3" />
                                {kill.reward}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Public Summary - anonymized (no slots) */}
              <div className="bg-card/50 rounded-xl border border-border p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="h-4 w-4 text-blue-500" />
                  <h3 className="font-semibold text-sm">Résumé des Actions (toutes manches)</h3>
                </div>
                <div className="text-xs text-muted-foreground mb-3">
                  Dégâts infligés par joueur, sans révéler les cibles tactiques.
                </div>
                <div className="space-y-3">
                  {combatResults.map(result => (
                    <div key={result.id} className="space-y-1">
                      <div className="text-xs font-medium text-muted-foreground">
                        Manche {result.manche}
                      </div>
                      <div className="space-y-1">
                        {result.public_summary
                          .filter(e => !e.cancelled)
                          .sort((a, b) => a.position - b.position)
                          .map((entry, idx) => (
                            <div 
                              key={idx}
                              className="flex items-center justify-between text-xs bg-blue-500/10 rounded-lg px-3 py-2"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-blue-400 font-mono">#{entry.position}</span>
                                <span className="font-medium">{entry.nom}</span>
                                <span className="text-muted-foreground">–</span>
                                <span className="text-muted-foreground">
                                  {entry.weapons?.join(', ') || 'Aucune arme'}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 text-destructive font-bold">
                                <Swords className="h-3 w-3" />
                                {entry.totalDamage}
                              </div>
                            </div>
                          ))}
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
