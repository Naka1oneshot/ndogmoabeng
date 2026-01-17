import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ForestButton } from '@/components/ui/ForestButton';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Loader2, Lock, CheckCircle2, AlertCircle, 
  Coins, Clock, Users, Trophy, Info
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface Game {
  id: string;
  manche_active: number;
  phase: string;
  phase_locked: boolean;
  sens_depart_egalite: string;
}

interface MJBetsTabProps {
  game: Game;
  onGameUpdate: () => void;
}

interface Player {
  id: string;
  player_number: number;
  display_name: string;
  jetons: number;
  status: string;
  clan: string | null;
  last_seen: string | null;
}

interface Bet {
  id: string;
  manche: number;
  num_joueur: number;
  mise: number;
  mise_demandee: number | null;
  mise_effective: number | null;
  status: string;
  submitted_at: string | null;
  note: string | null;
}

interface Ranking {
  id: string;
  num_joueur: number;
  display_name: string;
  rank: number;
  mise_effective: number;
  tie_group_id: number | null;
}

interface BetWithPlayer extends Bet {
  playerName: string;
  playerClan: string | null;
}

const DISCONNECTED_THRESHOLD = 90 * 1000; // 90 seconds

export function MJBetsTab({ game, onGameUpdate }: MJBetsTabProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [allBets, setAllBets] = useState<Bet[]>([]);
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [selectedManche, setSelectedManche] = useState<string>('current');
  const [availableManches, setAvailableManches] = useState<number[]>([]);

  const fetchData = useCallback(async () => {
    const [playersResult, betsResult, rankingsResult] = await Promise.all([
      supabase
        .from('game_players')
        .select('id, player_number, display_name, jetons, status, clan, last_seen')
        .eq('game_id', game.id)
        .eq('is_host', false)
        .in('status', ['ACTIVE', 'IN_GAME'])
        .order('player_number', { ascending: true }),
      supabase
        .from('round_bets')
        .select('*')
        .eq('game_id', game.id)
        .order('manche', { ascending: true })
        .order('num_joueur', { ascending: true }),
      supabase
        .from('priority_rankings')
        .select('*')
        .eq('game_id', game.id)
        .eq('manche', game.manche_active)
        .order('rank', { ascending: true }),
    ]);

    if (playersResult.data) setPlayers(playersResult.data);
    if (betsResult.data) {
      setAllBets(betsResult.data);
      // Calculate available manches
      const mancheSet = new Set(betsResult.data.map(b => b.manche));
      // Add current manche even if no bets yet
      mancheSet.add(game.manche_active);
      setAvailableManches(Array.from(mancheSet).sort((a, b) => a - b));
    }
    if (rankingsResult.data) setRankings(rankingsResult.data);
    setLoading(false);
  }, [game.id, game.manche_active]);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel(`mj-bets-${game.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${game.id}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'round_bets', filter: `game_id=eq.${game.id}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'priority_rankings', filter: `game_id=eq.${game.id}` }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [game.id, fetchData]);

  const handleClosePhase1 = async () => {
    if (game.phase !== 'PHASE1_MISES') {
      toast.error('Cette action n\'est possible qu\'en Phase 1 - Mises');
      return;
    }

    setClosing(true);
    try {
      const { data, error } = await supabase.functions.invoke('close-phase1-bets', {
        body: { gameId: game.id },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || 'Erreur lors de la clôture');
      }

      toast.success(`Phase 1 clôturée ! ${data.playerCount} joueurs classés.`);
      onGameUpdate();
      fetchData();
    } catch (error: unknown) {
      console.error('Close phase1 error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      toast.error(`Erreur: ${errorMessage}`);
    } finally {
      setClosing(false);
    }
  };

  const getPlayerPresenceState = (player: Player): 'online' | 'offline' | 'disconnected' => {
    if (!player.last_seen) return 'disconnected';
    const lastSeen = new Date(player.last_seen).getTime();
    const now = Date.now();
    const diff = now - lastSeen;
    
    if (diff < 30000) return 'online';
    if (diff < DISCONNECTED_THRESHOLD) return 'offline';
    return 'disconnected';
  };

  const getPresenceBadge = (state: 'online' | 'offline' | 'disconnected') => {
    switch (state) {
      case 'online':
        return <Badge variant="default" className="bg-green-500 text-xs">En ligne</Badge>;
      case 'offline':
        return <Badge variant="secondary" className="text-xs">Inactif</Badge>;
      case 'disconnected':
        return <Badge variant="destructive" className="text-xs">Déconnecté</Badge>;
    }
  };

  // Player map for lookups
  const playerMap = new Map<number, Player>();
  for (const player of players) {
    playerMap.set(player.player_number, player);
  }

  // Filter bets by selected manche
  const displayManche = selectedManche === 'current' 
    ? game.manche_active 
    : parseInt(selectedManche);
  
  const filteredBets = allBets.filter(b => b.manche === displayManche);

  // Enrich bets with player info
  const betsWithPlayers: BetWithPlayer[] = filteredBets.map(bet => {
    const player = playerMap.get(bet.num_joueur);
    return {
      ...bet,
      playerName: player?.display_name || `Joueur ${bet.num_joueur}`,
      playerClan: player?.clan || null,
    };
  });

  // Stats for current manche
  const currentMancheBets = allBets.filter(b => b.manche === game.manche_active);
  const submittedCount = currentMancheBets.filter(b => 
    b.status === 'SUBMITTED' || b.status === 'LOCKED'
  ).length;
  
  const isPhase1 = game.phase === 'PHASE1_MISES';
  const hasRankings = rankings.length > 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUBMITTED':
        return <Badge variant="default" className="bg-blue-500">Soumis</Badge>;
      case 'LOCKED':
        return <Badge variant="default" className="bg-green-500">Validé</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive">Rejeté</Badge>;
      case 'DRAFT':
        return <Badge variant="secondary">Brouillon</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card-gradient rounded-lg border border-border p-4 text-center">
          <Users className="h-5 w-5 mx-auto mb-2 text-primary" />
          <div className="text-2xl font-bold">{players.length}</div>
          <div className="text-xs text-muted-foreground">Joueurs actifs</div>
        </div>
        <div className="card-gradient rounded-lg border border-border p-4 text-center">
          <Coins className="h-5 w-5 mx-auto mb-2 text-yellow-500" />
          <div className="text-2xl font-bold">{submittedCount}</div>
          <div className="text-xs text-muted-foreground">Mises soumises (manche {game.manche_active})</div>
        </div>
        <div className="card-gradient rounded-lg border border-border p-4 text-center">
          <Clock className="h-5 w-5 mx-auto mb-2 text-blue-500" />
          <div className="text-2xl font-bold">{players.length - submittedCount}</div>
          <div className="text-xs text-muted-foreground">En attente</div>
        </div>
        <div className="card-gradient rounded-lg border border-border p-4 text-center">
          <Trophy className="h-5 w-5 mx-auto mb-2 text-purple-500" />
          <div className="text-2xl font-bold">Manche {game.manche_active}</div>
          <div className="text-xs text-muted-foreground">{isPhase1 ? 'Phase 1 - Mises' : game.phase}</div>
        </div>
      </div>

      {/* Close Phase 1 button */}
      <div className="card-gradient rounded-lg border border-amber-500/30 p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="font-display flex items-center gap-2">
              <Lock className="h-5 w-5 text-amber-500" />
              Clôturer et calculer les priorités
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {submittedCount}/{players.length} joueurs ont soumis leur mise. 
              Les joueurs sans mise auront une mise de 0.
            </p>
          </div>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <ForestButton
                    onClick={handleClosePhase1}
                    disabled={closing || players.length === 0 || !isPhase1 || hasRankings}
                    className="bg-amber-600 hover:bg-amber-700 whitespace-nowrap"
                  >
                    {closing ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Lock className="h-4 w-4 mr-2" />
                    )}
                    Clôturer et calculer priorités
                  </ForestButton>
                </span>
              </TooltipTrigger>
              {!isPhase1 && (
                <TooltipContent>
                  <p>Disponible uniquement en Phase 1</p>
                </TooltipContent>
              )}
              {hasRankings && isPhase1 && (
                <TooltipContent>
                  <p>Priorités déjà calculées pour cette manche</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Rankings display (after Phase 1 is closed) */}
      {hasRankings && (
        <div className="card-gradient rounded-lg border border-green-500/30 p-4">
          <h3 className="font-display flex items-center gap-2 mb-4">
            <Trophy className="h-5 w-5 text-green-500" />
            Classement priorité - Manche {game.manche_active}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {rankings.map((r) => (
              <div 
                key={r.id} 
                className={`p-3 rounded-lg text-center ${
                  r.rank === 1 ? 'bg-yellow-500/20 border border-yellow-500/50' :
                  r.rank === 2 ? 'bg-gray-400/20 border border-gray-400/50' :
                  r.rank === 3 ? 'bg-amber-700/20 border border-amber-700/50' :
                  'bg-secondary/50'
                }`}
              >
                <div className="text-lg font-bold">#{r.rank}</div>
                <div className="text-sm truncate">{r.display_name}</div>
                <div className="text-xs text-muted-foreground">
                  Mise: {r.mise_effective}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bets history table */}
      <div className="card-gradient rounded-lg border border-border overflow-hidden">
        <div className="p-4 border-b border-border flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <h3 className="font-display flex items-center gap-2">
            <Coins className="h-5 w-5 text-yellow-500" />
            Historique des mises validées
          </h3>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Manche :</span>
            <Select value={selectedManche} onValueChange={setSelectedManche}>
              <SelectTrigger className="w-[140px]">
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
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Manche</TableHead>
                <TableHead className="w-16">#</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Clan</TableHead>
                <TableHead className="text-right">Mise demandée</TableHead>
                <TableHead className="text-right">Mise effective</TableHead>
                <TableHead className="text-center">Statut</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Soumission</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {betsWithPlayers.map((bet) => {
                const player = playerMap.get(bet.num_joueur);
                const presenceState = player ? getPlayerPresenceState(player) : 'disconnected';
                
                return (
                  <TableRow key={bet.id}>
                    <TableCell className="font-mono text-center">
                      {bet.manche}
                    </TableCell>
                    <TableCell className="font-mono font-bold">
                      P{bet.num_joueur}
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {bet.playerName}
                        {player && displayManche === game.manche_active && (
                          <span className="opacity-60">{getPresenceBadge(presenceState)}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {bet.playerClan || '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {bet.mise_demandee ?? bet.mise ?? 0}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <span className={bet.mise_effective === 0 && (bet.mise_demandee ?? bet.mise) > 0 ? 'text-amber-500' : ''}>
                        {bet.mise_effective ?? '-'}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(bet.status)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                      {bet.note || '-'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {bet.submitted_at ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              {formatDistanceToNow(new Date(bet.submitted_at), { 
                                addSuffix: true, 
                                locale: fr 
                              })}
                            </TooltipTrigger>
                            <TooltipContent>
                              {format(new Date(bet.submitted_at), 'dd/MM/yyyy HH:mm:ss', { locale: fr })}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {betsWithPlayers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Aucune mise pour cette manche
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Info note */}
      <div className="p-4 bg-muted/30 rounded-lg border border-border flex items-start gap-3">
        <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground">
          Cet onglet affiche l'historique complet des mises sur toutes les manches. 
          Utilisez le filtre pour consulter les mises passées. Le bouton de clôture 
          n'est actif qu'en Phase 1.
        </p>
      </div>
    </div>
  );
}
