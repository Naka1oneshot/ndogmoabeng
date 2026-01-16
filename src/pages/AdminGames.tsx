import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { ForestButton } from '@/components/ui/ForestButton';
import { GameStatusBadge } from '@/components/game/GameStatusBadge';
import { Loader2, ShieldAlert, Eye, Trash2, LogOut, Users } from 'lucide-react';
import { toast } from 'sonner';
import logoNdogmoabeng from '@/assets/logo-ndogmoabeng.png';
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

interface GameRow {
  id: string;
  name: string;
  join_code: string;
  status: string;
  created_at: string;
  active_players: number;
}

export default function AdminGames() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const [games, setGames] = useState<GameRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

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

  useEffect(() => {
    if (user && isAdmin) {
      fetchGames();
      subscribeToGames();
    }
  }, [user, isAdmin]);

  const fetchGames = async () => {
    try {
      // Fetch all games
      const { data: gamesData, error: gamesError } = await supabase
        .from('games')
        .select('id, name, join_code, status, created_at')
        .order('created_at', { ascending: false });

      if (gamesError) throw gamesError;

      // For each game, count active players
      const gamesWithCounts = await Promise.all(
        (gamesData || []).map(async (game) => {
          const { count } = await supabase
            .from('game_players')
            .select('*', { count: 'exact', head: true })
            .eq('game_id', game.id)
            .eq('status', 'ACTIVE')
            .eq('is_host', false);

          return {
            ...game,
            active_players: count || 0,
          };
        })
      );

      setGames(gamesWithCounts);
    } catch (error) {
      console.error('Error fetching games:', error);
      toast.error('Erreur lors du chargement des parties');
    } finally {
      setLoading(false);
    }
  };

  const subscribeToGames = () => {
    const channel = supabase
      .channel('admin-games-list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'games' },
        () => fetchGames()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_players' },
        () => fetchGames()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleDeleteGame = async (gameId: string) => {
    setDeleting(gameId);
    try {
      // Delete all related data (cascade manually)
      // Order matters: delete children before parent
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
        const { error } = await (supabase
          .from(table as any)
          .delete()
          .eq('game_id', gameId));
        
        if (error) {
          console.error(`Error deleting from ${table}:`, error);
        }
      }

      // Finally delete the game itself
      const { error: gameError } = await supabase
        .from('games')
        .delete()
        .eq('id', gameId);

      if (gameError) throw gameError;

      // Log the action
      await (supabase.from('admin_actions' as any).insert({
        admin_id: user?.id,
        action_type: 'DELETE_SESSION',
        game_id: gameId,
        details: 'Session supprimée avec toutes les données liées',
      }));

      setGames((prev) => prev.filter((g) => g.id !== gameId));
      toast.success('Partie supprimée avec succès');
    } catch (error) {
      console.error('Error deleting game:', error);
      toast.error('Erreur lors de la suppression');
    } finally {
      setDeleting(null);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (authLoading || roleLoading) {
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
        <p className="text-muted-foreground text-center">
          Seuls les administrateurs peuvent accéder à cette page.
        </p>
        <ForestButton onClick={() => navigate('/login')}>
          Retour à la connexion
        </ForestButton>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-6">
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          <img src={logoNdogmoabeng} alt="Ndogmoabeng" className="h-8 w-8 object-contain" />
          <h1 className="font-display text-xl">Gestion des Parties</h1>
        </div>
        <div className="flex items-center gap-3">
          <ForestButton variant="outline" size="sm" onClick={() => navigate('/mj')}>
            Retour MJ
          </ForestButton>
          <ForestButton variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
          </ForestButton>
        </div>
      </header>

      <main className="max-w-5xl mx-auto">
        <div className="card-gradient rounded-lg border border-border overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : games.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              Aucune partie trouvée
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-center">
                    <Users className="h-4 w-4 inline" />
                  </TableHead>
                  <TableHead>Créée le</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {games.map((game) => (
                  <TableRow key={game.id}>
                    <TableCell className="font-medium">{game.name}</TableCell>
                    <TableCell className="font-mono text-primary">
                      {game.join_code}
                    </TableCell>
                    <TableCell>
                      <GameStatusBadge status={game.status} />
                    </TableCell>
                    <TableCell className="text-center">
                      {game.active_players}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(game.created_at).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <ForestButton
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/admin/games/${game.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </ForestButton>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <ForestButton
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              disabled={deleting === game.id}
                            >
                              {deleting === game.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </ForestButton>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Supprimer la partie ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Cette action est irréversible. Toutes les données de la partie
                                "{game.name}" seront définitivement supprimées (joueurs, logs,
                                inventaires, etc.).
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => handleDeleteGame(game.id)}
                              >
                                Supprimer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </main>
    </div>
  );
}
