import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { ForestButton } from '@/components/ui/ForestButton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { QRCodeDisplay } from '@/components/game/QRCodeDisplay';
import { PlayerManagementList } from '@/components/game/PlayerManagementList';
import { GameStatusBadge } from '@/components/game/GameStatusBadge';
import { AdminBadge } from '@/components/game/AdminBadge';
import { 
  Plus, Play, LogOut, Loader2, ShieldAlert, StopCircle, 
  Settings, RotateCcw, Lock, ChevronLeft, Trash2, Eye, Edit2, X, Check, Users
} from 'lucide-react';
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

interface Game {
  id: string;
  name: string;
  join_code: string;
  status: string;
  manche_active: number;
  sens_depart_egalite: string;
  x_nb_joueurs: number;
  created_at: string;
  active_players?: number;
}

function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export default function MJ() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  
  // View mode: 'list' | 'create' | 'detail'
  const [viewMode, setViewMode] = useState<'list' | 'create' | 'detail'>('list');
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  
  // Games list
  const [games, setGames] = useState<Game[]>([]);
  const [loadingGames, setLoadingGames] = useState(true);
  
  // Create form
  const [gameName, setGameName] = useState('');
  const [xNbJoueurs, setXNbJoueurs] = useState(6);
  const [sensEgalite, setSensEgalite] = useState<'ASC' | 'DESC'>('ASC');
  const [creating, setCreating] = useState(false);
  
  // Game actions
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [resettingManche, setResettingManche] = useState(false);
  const [lockingJoins, setLockingJoins] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  
  // Edit mode for game name
  const [editingName, setEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');

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
      const cleanup = subscribeToGames();
      return cleanup;
    }
  }, [user, isAdmin]);

  const fetchGames = async () => {
    if (!user) return;
    
    try {
      const { data: gamesData, error } = await supabase
        .from('games')
        .select('*')
        .eq('host_user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Count active players for each game
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
          } as Game;
        })
      );

      setGames(gamesWithCounts);
      
      // Update selected game if viewing detail
      if (selectedGame) {
        const updated = gamesWithCounts.find(g => g.id === selectedGame.id);
        if (updated) {
          setSelectedGame(updated);
        }
      }
    } catch (error) {
      console.error('Error fetching games:', error);
    } finally {
      setLoadingGames(false);
    }
  };

  const subscribeToGames = () => {
    const channel = supabase
      .channel('mj-games')
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

  const handleCreateGame = async () => {
    if (!user) return;
    if (!gameName.trim()) {
      toast.error('Veuillez entrer un nom de partie');
      return;
    }

    setCreating(true);
    try {
      const joinCode = generateJoinCode();
      
      const { data, error } = await supabase
        .from('games')
        .insert({
          host_user_id: user.id,
          name: gameName.trim(),
          join_code: joinCode,
          status: 'LOBBY',
          manche_active: 1,
          sens_depart_egalite: sensEgalite,
          x_nb_joueurs: xNbJoueurs,
        })
        .select()
        .single();

      if (error) throw error;

      // Add host as player
      await supabase.from('game_players').insert({
        game_id: data.id,
        user_id: user.id,
        display_name: 'Maître du Jeu',
        is_host: true,
      });

      toast.success('Partie créée !');
      setGameName('');
      setXNbJoueurs(6);
      setSensEgalite('ASC');
      
      // Go to detail view of the new game
      setSelectedGame({ ...data, active_players: 0 } as Game);
      setViewMode('detail');
    } catch (error) {
      console.error('Error creating game:', error);
      toast.error('Erreur lors de la création de la partie');
    } finally {
      setCreating(false);
    }
  };

  const handleStartGame = async () => {
    if (!selectedGame) return;
    
    setStarting(true);
    try {
      const { error } = await supabase
        .from('games')
        .update({ status: 'IN_ROUND' })
        .eq('id', selectedGame.id);

      if (error) throw error;

      setSelectedGame({ ...selectedGame, status: 'IN_ROUND' });
      toast.success('La partie commence !');
    } catch (error) {
      console.error('Error starting game:', error);
      toast.error('Erreur lors du démarrage');
    } finally {
      setStarting(false);
    }
  };

  const handleEndGame = async () => {
    if (!selectedGame) return;
    
    setEnding(true);
    try {
      const { error } = await supabase
        .from('games')
        .update({ status: 'FINISHED' })
        .eq('id', selectedGame.id);

      if (error) throw error;

      setSelectedGame({ ...selectedGame, status: 'FINISHED' });
      toast.success('Partie terminée');
    } catch (error) {
      console.error('Error ending game:', error);
      toast.error('Erreur lors de la fin de partie');
    } finally {
      setEnding(false);
    }
  };

  const handleResetManche = async () => {
    if (!selectedGame) return;
    
    setResettingManche(true);
    try {
      const { error } = await supabase
        .from('games')
        .update({ manche_active: 1 })
        .eq('id', selectedGame.id);

      if (error) throw error;

      setSelectedGame({ ...selectedGame, manche_active: 1 });
      toast.success('Manche réinitialisée à 1');
    } catch (error) {
      console.error('Error resetting manche:', error);
      toast.error('Erreur lors de la réinitialisation');
    } finally {
      setResettingManche(false);
    }
  };

  const handleLockJoins = async () => {
    if (!selectedGame) return;
    
    setLockingJoins(true);
    try {
      const { error } = await supabase
        .from('games')
        .update({ status: 'IN_ROUND' })
        .eq('id', selectedGame.id);

      if (error) throw error;

      setSelectedGame({ ...selectedGame, status: 'IN_ROUND' });
      toast.success('Liste des joueurs verrouillée');
    } catch (error) {
      console.error('Error locking joins:', error);
      toast.error('Erreur lors du verrouillage');
    } finally {
      setLockingJoins(false);
    }
  };

  const handleDeleteGame = async (gameId: string) => {
    setDeleting(gameId);
    try {
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

      const { error } = await supabase
        .from('games')
        .delete()
        .eq('id', gameId);

      if (error) throw error;

      toast.success('Partie supprimée');
      
      if (selectedGame?.id === gameId) {
        setSelectedGame(null);
        setViewMode('list');
      }
      
      setGames(prev => prev.filter(g => g.id !== gameId));
    } catch (error) {
      console.error('Error deleting game:', error);
      toast.error('Erreur lors de la suppression');
    } finally {
      setDeleting(null);
    }
  };

  const handleUpdateName = async () => {
    if (!selectedGame || !editedName.trim()) return;
    
    try {
      const { error } = await supabase
        .from('games')
        .update({ name: editedName.trim() })
        .eq('id', selectedGame.id);

      if (error) throw error;

      setSelectedGame({ ...selectedGame, name: editedName.trim() });
      setEditingName(false);
      toast.success('Nom modifié');
    } catch (error) {
      console.error('Error updating name:', error);
      toast.error('Erreur lors de la modification');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const openGameDetail = (game: Game) => {
    setSelectedGame(game);
    setViewMode('detail');
  };

  const goToList = () => {
    setSelectedGame(null);
    setViewMode('list');
    setEditingName(false);
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

  const isLobby = selectedGame?.status === 'LOBBY';
  const isInGame = selectedGame?.status === 'IN_ROUND' || selectedGame?.status === 'RESOLVING_COMBAT' || selectedGame?.status === 'RESOLVING_SHOP';
  const isFinished = selectedGame?.status === 'FINISHED';

  return (
    <div className="min-h-screen px-4 py-6">
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 max-w-3xl mx-auto">
        <div className="flex items-center gap-3">
          <img src={logoNdogmoabeng} alt="Ndogmoabeng" className="h-8 w-8 object-contain" />
          <h1 className="font-display text-xl">Tableau MJ</h1>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <AdminBadge email={user?.email} />
          <ForestButton variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Déconnexion</span>
          </ForestButton>
        </div>
      </header>

      <main className="max-w-3xl mx-auto space-y-6">
        {viewMode === 'list' && (
          <>
            {/* Header avec bouton créer */}
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg">Mes Parties</h2>
              <ForestButton onClick={() => setViewMode('create')}>
                <Plus className="h-5 w-5" />
                Nouvelle partie
              </ForestButton>
            </div>

            {/* Liste des parties */}
            <div className="space-y-3">
              {loadingGames ? (
                <div className="card-gradient rounded-lg border border-border p-8 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : games.length === 0 ? (
                <div className="card-gradient rounded-lg border border-border p-8 text-center text-muted-foreground">
                  <p>Aucune partie créée</p>
                  <p className="text-sm mt-2">Cliquez sur "Nouvelle partie" pour commencer</p>
                </div>
              ) : (
                games.map((game) => (
                  <div
                    key={game.id}
                    className="card-gradient rounded-lg border border-border p-4 hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium truncate">{game.name}</h3>
                          <GameStatusBadge status={game.status} />
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="font-mono text-primary">{game.join_code}</span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {game.active_players}
                          </span>
                          <span>
                            {new Date(game.created_at).toLocaleDateString('fr-FR')}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <ForestButton
                          variant="outline"
                          size="sm"
                          onClick={() => openGameDetail(game)}
                        >
                          <Eye className="h-4 w-4" />
                          <span className="hidden sm:inline ml-1">Gérer</span>
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
                                "{game.name}" seront définitivement supprimées.
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
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {viewMode === 'create' && (
          <div className="card-gradient rounded-lg border border-border p-6 space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <ForestButton variant="ghost" size="sm" onClick={goToList}>
                <ChevronLeft className="h-4 w-4" />
              </ForestButton>
              <h2 className="font-display text-xl">🌲 Créer une nouvelle partie</h2>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="gameName">Nom de la partie</Label>
              <Input
                id="gameName"
                placeholder="Ex: La Quête du Cristal"
                value={gameName}
                onChange={(e) => setGameName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="xNbJoueurs">Nombre de joueurs (X)</Label>
                <Input
                  id="xNbJoueurs"
                  type="number"
                  min={2}
                  max={20}
                  value={xNbJoueurs}
                  onChange={(e) => setXNbJoueurs(parseInt(e.target.value) || 6)}
                />
              </div>

              <div className="space-y-2">
                <Label>Sens départ égalité</Label>
                <Select value={sensEgalite} onValueChange={(val) => setSensEgalite(val as 'ASC' | 'DESC')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ASC">Ascendant (ASC)</SelectItem>
                    <SelectItem value="DESC">Descendant (DESC)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <ForestButton 
              className="w-full" 
              onClick={handleCreateGame}
              disabled={creating}
            >
              {creating ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <Plus className="h-5 w-5" />
                  Créer la partie
                </>
              )}
            </ForestButton>
          </div>
        )}

        {viewMode === 'detail' && selectedGame && (
          <>
            {/* Header avec retour */}
            <div className="flex items-center gap-3">
              <ForestButton variant="ghost" size="sm" onClick={goToList}>
                <ChevronLeft className="h-4 w-4" />
              </ForestButton>
              <span className="text-muted-foreground">Retour à la liste</span>
            </div>

            {/* BLOC: Info partie + QR */}
            <div className="card-gradient rounded-lg border border-border p-6">
              <div className="flex items-center justify-between mb-4">
                {editingName ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      className="max-w-xs"
                      autoFocus
                    />
                    <ForestButton variant="ghost" size="sm" onClick={handleUpdateName}>
                      <Check className="h-4 w-4 text-primary" />
                    </ForestButton>
                    <ForestButton variant="ghost" size="sm" onClick={() => setEditingName(false)}>
                      <X className="h-4 w-4" />
                    </ForestButton>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-xl">{selectedGame.name}</h2>
                    <ForestButton 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        setEditedName(selectedGame.name);
                        setEditingName(true);
                      }}
                    >
                      <Edit2 className="h-4 w-4" />
                    </ForestButton>
                  </div>
                )}
                <GameStatusBadge status={selectedGame.status} />
              </div>

              <div className="grid grid-cols-3 gap-4 text-center mb-4 text-sm">
                <div className="p-3 rounded-md bg-secondary/50">
                  <div className="text-muted-foreground">Joueurs</div>
                  <div className="text-lg font-bold text-primary">X = {selectedGame.x_nb_joueurs}</div>
                </div>
                <div className="p-3 rounded-md bg-secondary/50">
                  <div className="text-muted-foreground">Égalité</div>
                  <div className="text-lg font-bold">{selectedGame.sens_depart_egalite}</div>
                </div>
                <div className="p-3 rounded-md bg-secondary/50">
                  <div className="text-muted-foreground">Manche</div>
                  <div className="text-lg font-bold text-forest-gold">{selectedGame.manche_active}</div>
                </div>
              </div>
              
              {isLobby && (
                <div className="flex gap-3">
                  <ForestButton 
                    className="flex-1" 
                    onClick={handleStartGame}
                    disabled={starting}
                  >
                    {starting ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <Play className="h-5 w-5" />
                        Démarrer la partie
                      </>
                    )}
                  </ForestButton>
                  <ForestButton 
                    variant="outline" 
                    onClick={handleLockJoins}
                    disabled={lockingJoins}
                    title="Verrouiller la liste des joueurs"
                  >
                    {lockingJoins ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Lock className="h-5 w-5" />
                    )}
                  </ForestButton>
                </div>
              )}

              {isInGame && (
                <div className="space-y-3">
                  <p className="text-center text-forest-gold font-medium">
                    🎮 Partie en cours - Manche {selectedGame.manche_active}
                  </p>
                  <ForestButton 
                    variant="outline"
                    className="w-full border-destructive/50 text-destructive hover:bg-destructive/10" 
                    onClick={handleEndGame}
                    disabled={ending}
                  >
                    {ending ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <StopCircle className="h-5 w-5" />
                        Terminer la partie
                      </>
                    )}
                  </ForestButton>
                </div>
              )}

              {isFinished && (
                <div className="space-y-3">
                  <p className="text-center text-muted-foreground font-medium">
                    🏁 Partie terminée
                  </p>
                  <ForestButton 
                    className="w-full" 
                    onClick={() => setViewMode('create')}
                  >
                    <Plus className="h-5 w-5" />
                    Nouvelle partie
                  </ForestButton>
                </div>
              )}
            </div>

            {/* BLOC: QR Code (visible en lobby) */}
            {isLobby && (
              <QRCodeDisplay joinCode={selectedGame.join_code} />
            )}

            {/* BLOC: Joueurs */}
            <PlayerManagementList gameId={selectedGame.id} isLobby={isLobby} />

            {/* BLOC: Paramètres MJ */}
            <div className="card-gradient rounded-lg border border-border p-6">
              <h3 className="font-display text-lg mb-4 flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                Paramètres
              </h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-md bg-secondary/50">
                  <div>
                    <div className="font-medium">Manche active</div>
                    <div className="text-sm text-muted-foreground">Actuellement : {selectedGame.manche_active}</div>
                  </div>
                  <ForestButton 
                    variant="outline" 
                    size="sm"
                    onClick={handleResetManche}
                    disabled={resettingManche}
                  >
                    {resettingManche ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <RotateCcw className="h-4 w-4" />
                        Reset à 1
                      </>
                    )}
                  </ForestButton>
                </div>

                <div className="flex items-center justify-between p-3 rounded-md bg-secondary/50">
                  <div>
                    <div className="font-medium">Code de session</div>
                    <div className="text-sm font-mono text-primary">{selectedGame.join_code}</div>
                  </div>
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <ForestButton
                      variant="outline"
                      className="w-full border-destructive/50 text-destructive hover:bg-destructive/10"
                      disabled={deleting === selectedGame.id}
                    >
                      {deleting === selectedGame.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4" />
                          Supprimer cette partie
                        </>
                      )}
                    </ForestButton>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Supprimer la partie ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Cette action est irréversible. Toutes les données seront définitivement supprimées.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => handleDeleteGame(selectedGame.id)}
                      >
                        Supprimer
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
