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
  Loader2, Lock, CheckCircle2, AlertCircle, 
  Coins, Clock, Users, Trophy
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

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
  last_seen: string | null;
}

interface Bet {
  id: string;
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

interface PlayerWithBet {
  player: Player;
  bet: Bet | null;
  calculatedEffective: number;
  warning: string | null;
}

const DISCONNECTED_THRESHOLD = 90 * 1000; // 90 seconds

export function MJBetsTab({ game, onGameUpdate }: MJBetsTabProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [bets, setBets] = useState<Bet[]>([]);
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);

  const fetchData = useCallback(async () => {
    const [playersResult, betsResult, rankingsResult] = await Promise.all([
      supabase
        .from('game_players')
        .select('id, player_number, display_name, jetons, status, last_seen')
        .eq('game_id', game.id)
        .eq('is_host', false)
        .in('status', ['ACTIVE', 'IN_GAME'])
        .order('player_number', { ascending: true }),
      supabase
        .from('round_bets')
        .select('*')
        .eq('game_id', game.id)
        .eq('manche', game.manche_active),
      supabase
        .from('priority_rankings')
        .select('*')
        .eq('game_id', game.id)
        .eq('manche', game.manche_active)
        .order('rank', { ascending: true }),
    ]);

    if (playersResult.data) setPlayers(playersResult.data);
    if (betsResult.data) setBets(betsResult.data);
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

  // Map bets by player_number
  const betsByPlayer = new Map<number, Bet>();
  for (const bet of bets) {
    const existing = betsByPlayer.get(bet.num_joueur);
    if (!existing || (bet.submitted_at && (!existing.submitted_at || bet.submitted_at > existing.submitted_at))) {
      betsByPlayer.set(bet.num_joueur, bet);
    }
  }

  // Calculate player data with bets
  const playersWithBets: PlayerWithBet[] = players.map(player => {
    const bet = betsByPlayer.get(player.player_number) || null;
    let calculatedEffective = 0;
    let warning: string | null = null;

    if (bet) {
      const demandee = bet.mise_demandee ?? bet.mise ?? 0;
      if (demandee > (player.jetons || 0)) {
        calculatedEffective = 0;
        warning = `Mise (${demandee}) > solde (${player.jetons})`;
      } else {
        calculatedEffective = demandee;
      }
    } else {
      warning = 'Aucune mise soumise';
    }

    return { player, bet, calculatedEffective, warning };
  });

  const submittedCount = playersWithBets.filter(p => p.bet && p.bet.status !== 'LOCKED').length;
  const isPhase1 = game.phase === 'PHASE1_MISES';
  const hasRankings = rankings.length > 0;

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
          <div className="text-xs text-muted-foreground">Mises soumises</div>
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
      {isPhase1 && !hasRankings && (
        <div className="card-gradient rounded-lg border border-amber-500/30 p-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="font-display flex items-center gap-2">
                <Lock className="h-5 w-5 text-amber-500" />
                Clôturer la Phase 1
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {submittedCount}/{players.length} joueurs ont soumis leur mise. 
                Les joueurs sans mise auront une mise de 0.
              </p>
            </div>
            <ForestButton
              onClick={handleClosePhase1}
              disabled={closing || players.length === 0}
              className="bg-amber-600 hover:bg-amber-700 whitespace-nowrap"
            >
              {closing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Lock className="h-4 w-4 mr-2" />
              )}
              Clôturer et calculer priorités
            </ForestButton>
          </div>
        </div>
      )}

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

      {/* Bets table */}
      <div className="card-gradient rounded-lg border border-border overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-display flex items-center gap-2">
            <Coins className="h-5 w-5 text-yellow-500" />
            Tableau des mises
          </h3>
        </div>
        
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">#</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead className="text-center">Statut</TableHead>
                <TableHead className="text-right">Jetons</TableHead>
                <TableHead className="text-right">Mise demandée</TableHead>
                <TableHead className="text-right">Mise effective</TableHead>
                <TableHead className="text-center">Validée</TableHead>
                <TableHead>Dernière soumission</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {playersWithBets.map(({ player, bet, calculatedEffective, warning }) => {
                const presenceState = getPlayerPresenceState(player);
                const isSubmitted = bet && ['SUBMITTED', 'LOCKED'].includes(bet.status);
                const displayEffective = bet?.mise_effective ?? calculatedEffective;
                
                return (
                  <TableRow key={player.id}>
                    <TableCell className="font-mono font-bold">
                      P{player.player_number}
                    </TableCell>
                    <TableCell className="font-medium">
                      {player.display_name}
                    </TableCell>
                    <TableCell className="text-center">
                      {getPresenceBadge(presenceState)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {player.jetons}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {bet ? (bet.mise_demandee ?? bet.mise ?? 0) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <span className={warning && !bet?.status?.includes('LOCKED') ? 'text-amber-500' : ''}>
                        {displayEffective}
                      </span>
                      {warning && !bet?.status?.includes('LOCKED') && (
                        <AlertCircle className="h-3 w-3 inline ml-1 text-amber-500" />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {isSubmitted ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {bet?.submitted_at ? (
                        formatDistanceToNow(new Date(bet.submitted_at), { 
                          addSuffix: true, 
                          locale: fr 
                        })
                      ) : (
                        '-'
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {playersWithBets.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Aucun joueur actif
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
