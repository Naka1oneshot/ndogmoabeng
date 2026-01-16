import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { ForestButton } from '@/components/ui/ForestButton';
import { GameStatusBadge } from '@/components/game/GameStatusBadge';
import {
  TreePine,
  Loader2,
  ShieldAlert,
  ArrowLeft,
  Trash2,
  UserX,
  Clock,
  Crown,
} from 'lucide-react';
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
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface Game {
  id: string;
  name: string;
  join_code: string;
  status: string;
  created_at: string;
  x_nb_joueurs: number;
  manche_active: number;
}

interface Player {
  id: string;
  display_name: string;
  player_number: number | null;
  is_host: boolean;
  status: string;
  last_seen: string | null;
  clan: string | null;
  joined_at: string;
}

const PRESENCE_TTL_SECONDS = 25;

export default function AdminGameDetails() {
  const { gameId } = useParams<{ gameId: string }>();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();

  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingGame, setDeletingGame] = useState(false);
  const [kickingPlayer, setKickingPlayer] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!authLoading && !roleLoading && user && !isAdmin) {
      navigate('/login');
    }
  }, [user, authLoading, roleLoading, isAdmin, navigate]);

  const fetchData = useCallback(async () => {
    if (!gameId) return;

    try {
      // Fetch game
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

      if (gameError) throw gameError;
      setGame(gameData as Game);

      // Fetch players
      const { data: playersData, error: playersError } = await supabase
        .from('game_players')
        .select('id, display_name, player_number, is_host, status, last_seen, clan, joined_at')
        .eq('game_id', gameId)
        .order('player_number', { ascending: true, nullsFirst: false });

      if (playersError) throw playersError;
      setPlayers(playersData as Player[]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    if (user && isAdmin && gameId) {
      fetchData();

      // Subscribe to real-time updates
      const channel = supabase
        .channel(`admin-game-${gameId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
          (payload) => {
            if (payload.eventType === 'DELETE') {
              toast.info('La partie a été supprimée');
              navigate('/admin/games');
            } else {
              setGame(payload.new as Game);
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${gameId}` },
          () => fetchData()
        )
        .subscribe();

      // Polling for presence TTL
      const interval = setInterval(fetchData, 10000);

      return () => {
        supabase.removeChannel(channel);
        clearInterval(interval);
      };
    }
  }, [user, isAdmin, gameId, fetchData, navigate]);

  const isPlayerActive = (player: Player): boolean => {
    if (player.status !== 'ACTIVE') return false;
    if (!player.last_seen) return false;
    const lastSeen = new Date(player.last_seen).getTime();
    const now = Date.now();
    return now - lastSeen < PRESENCE_TTL_SECONDS * 1000;
  };

  const handleKickPlayer = async (playerId: string, playerName: string) => {
    setKickingPlayer(playerId);
    try {
      const { error } = await supabase
        .from('game_players')
        .update({
          status: 'REMOVED',
          removed_at: new Date().toISOString(),
          removed_by: user?.id,
        } as any)
        .eq('id', playerId);

      if (error) throw error;

      // Log the action
      await (supabase.from('admin_actions' as any).insert({
        admin_id: user?.id,
        action_type: 'KICK_PLAYER',
        game_id: gameId,
        player_id: playerId,
        details: `Joueur "${playerName}" retiré de la partie`,
      }));

      toast.success(`${playerName} a été retiré de la partie`);
      fetchData();
    } catch (error) {
      console.error('Error kicking player:', error);
      toast.error('Erreur lors de l\'expulsion');
    } finally {
      setKickingPlayer(null);
    }
  };

  const handleDeleteGame = async () => {
    if (!gameId) return;
    
    setDeletingGame(true);
    try {
      // Delete all related data
      const tablesToClear = [
        'pending_effects',
        'positions_finales',
        'round_bets',
        'actions',
        'inventory',
        'logs_joueurs',
        'logs_mj',
        'battlefield',
        'monsters',
        'combat_config',
        'shop_catalogue',
        'game_players',
      ];

      for (const table of tablesToClear) {
        await (supabase.from(table as any).delete().eq('game_id', gameId));
      }

      // Delete the game
      const { error } = await supabase.from('games').delete().eq('id', gameId);
      if (error) throw error;

      // Log action
      await (supabase.from('admin_actions' as any).insert({
        admin_id: user?.id,
        action_type: 'DELETE_SESSION',
        game_id: gameId,
        details: `Partie "${game?.name}" supprimée`,
      }));

      toast.success('Partie supprimée');
      navigate('/admin/games');
    } catch (error) {
      console.error('Error deleting game:', error);
      toast.error('Erreur lors de la suppression');
    } finally {
      setDeletingGame(false);
    }
  };

  if (authLoading || roleLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <ShieldAlert className="h-16 w-16 text-destructive" />
        <h1 className="font-display text-xl text-center">Accès refusé</h1>
        <ForestButton onClick={() => navigate('/login')}>
          Retour à la connexion
        </ForestButton>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-muted-foreground">Partie introuvable</p>
        <ForestButton onClick={() => navigate('/admin/games')}>
          Retour à la liste
        </ForestButton>
      </div>
    );
  }

  const activePlayers = players.filter(
    (p) => !p.is_host && p.status === 'ACTIVE'
  );
  const removedPlayers = players.filter((p) => p.status === 'REMOVED');

  return (
    <div className="min-h-screen px-4 py-6">
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          <ForestButton
            variant="ghost"
            size="sm"
            onClick={() => navigate('/admin/games')}
          >
            <ArrowLeft className="h-4 w-4" />
          </ForestButton>
          <TreePine className="h-6 w-6 text-primary" />
          <h1 className="font-display text-xl">{game.name}</h1>
          <GameStatusBadge status={game.status} />
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <ForestButton
              variant="outline"
              className="border-destructive/50 text-destructive hover:bg-destructive/10"
              disabled={deletingGame}
            >
              {deletingGame ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Supprimer la partie
            </ForestButton>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer la partie ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action est irréversible. Toutes les données seront
                définitivement supprimées et tous les joueurs connectés seront
                expulsés.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleDeleteGame}
              >
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </header>

      <main className="max-w-5xl mx-auto space-y-6">
        {/* Game Info */}
        <div className="card-gradient rounded-lg border border-border p-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center text-sm">
            <div className="p-3 rounded-md bg-secondary/50">
              <div className="text-muted-foreground">Code</div>
              <div className="text-lg font-mono text-primary">{game.join_code}</div>
            </div>
            <div className="p-3 rounded-md bg-secondary/50">
              <div className="text-muted-foreground">Joueurs max</div>
              <div className="text-lg font-bold">{game.x_nb_joueurs}</div>
            </div>
            <div className="p-3 rounded-md bg-secondary/50">
              <div className="text-muted-foreground">Manche</div>
              <div className="text-lg font-bold text-forest-gold">{game.manche_active}</div>
            </div>
            <div className="p-3 rounded-md bg-secondary/50">
              <div className="text-muted-foreground">Créée le</div>
              <div className="text-sm">
                {new Date(game.created_at).toLocaleDateString('fr-FR')}
              </div>
            </div>
          </div>
        </div>

        {/* Players Section */}
        <div className="card-gradient rounded-lg border border-border overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="font-display text-lg">
              Joueurs actifs ({activePlayers.length})
            </h2>
          </div>

          {activePlayers.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              Aucun joueur actif
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Clan</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Dernière activité</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activePlayers.map((player) => (
                  <TableRow key={player.id}>
                    <TableCell className="font-mono">
                      {player.is_host ? (
                        <Crown className="h-4 w-4 text-forest-gold" />
                      ) : (
                        player.player_number
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {player.display_name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {player.clan || '-'}
                    </TableCell>
                    <TableCell>
                      {isPlayerActive(player) ? (
                        <Badge variant="outline" className="border-green-500 text-green-500">
                          En ligne
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-muted-foreground">
                          <Clock className="h-3 w-3 mr-1" />
                          Inactif
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {player.last_seen
                        ? new Date(player.last_seen).toLocaleTimeString('fr-FR')
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {!player.is_host && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <ForestButton
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              disabled={kickingPlayer === player.id}
                            >
                              {kickingPlayer === player.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <UserX className="h-4 w-4" />
                              )}
                            </ForestButton>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Expulser {player.display_name} ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Le joueur sera immédiatement retiré de la partie et ne pourra pas
                                la rejoindre à nouveau.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => handleKickPlayer(player.id, player.display_name)}
                              >
                                Expulser
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Removed Players Section */}
        {removedPlayers.length > 0 && (
          <div className="card-gradient rounded-lg border border-border overflow-hidden opacity-75">
            <div className="p-4 border-b border-border">
              <h2 className="font-display text-lg text-muted-foreground">
                Joueurs expulsés ({removedPlayers.length})
              </h2>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Clan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {removedPlayers.map((player) => (
                  <TableRow key={player.id} className="text-muted-foreground">
                    <TableCell className="font-mono">{player.player_number}</TableCell>
                    <TableCell>{player.display_name}</TableCell>
                    <TableCell>{player.clan || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>
    </div>
  );
}
