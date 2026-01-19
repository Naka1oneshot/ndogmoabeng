import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { ForestButton } from '@/components/ui/ForestButton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AdventureSelector } from '@/components/mj/AdventureSelector';
import { GameStatusBadge } from '@/components/game/GameStatusBadge';
import { AdminBadge } from '@/components/game/AdminBadge';
import { MJDashboard } from '@/components/mj/MJDashboard';
import { 
  Plus, LogOut, Loader2, ShieldAlert, 
  ChevronLeft, Trash2, Eye, Users, Map, Gamepad2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
  starting_tokens: number;
  phase: string;
  phase_locked: boolean;
  created_at: string;
  active_players?: number;
  current_session_game_id: string | null;
  mode: string;
  adventure_id: string | null;
  current_step_index: number;
  selected_game_type_code: string | null;
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
  const [startingTokens, setStartingTokens] = useState(50);
  const [sensEgalite, setSensEgalite] = useState<'ASC' | 'DESC'>('ASC');
  const [gameMode, setGameMode] = useState<'SINGLE_GAME' | 'ADVENTURE'>('SINGLE_GAME');
  const [selectedAdventureId, setSelectedAdventureId] = useState<string | null>(null);
  const [selectedGameTypeCode, setSelectedGameTypeCode] = useState<string | null>('FORET');
  const [creating, setCreating] = useState(false);
  
  // Game actions
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

  // Check if current selection requires minimum 7 players (INFECTION)
  const requiresMinimum7Players = (): boolean => {
    if (gameMode === 'SINGLE_GAME') {
      return selectedGameTypeCode === 'INFECTION';
    }
    // For adventure mode, we don't know the steps here, so we'll check in handleCreateGame
    return false;
  };

  // Get minimum players based on game type
  const getMinimumPlayers = (): number => {
    return requiresMinimum7Players() ? 7 : 2;
  };

  // Auto-adjust player count when selecting INFECTION
  useEffect(() => {
    if (selectedGameTypeCode === 'INFECTION' && gameMode === 'SINGLE_GAME' && xNbJoueurs < 7) {
      setXNbJoueurs(7);
      toast.info('INFECTION nécessite minimum 7 joueurs');
    }
  }, [selectedGameTypeCode, gameMode]);

  const handleCreateGame = async () => {
    if (!user) return;
    if (!gameName.trim()) {
      toast.error('Veuillez entrer un nom de partie');
      return;
    }

    // Validate mode-specific requirements
    if (gameMode === 'ADVENTURE' && !selectedAdventureId) {
      toast.error('Veuillez sélectionner une aventure');
      return;
    }
    if (gameMode === 'SINGLE_GAME' && !selectedGameTypeCode) {
      toast.error('Veuillez sélectionner un type de jeu');
      return;
    }

    // Validate minimum players for INFECTION (single game mode)
    if (gameMode === 'SINGLE_GAME' && selectedGameTypeCode === 'INFECTION' && xNbJoueurs < 7) {
      toast.error('INFECTION nécessite minimum 7 joueurs');
      setXNbJoueurs(7);
      return;
    }

    // Validate minimum players for adventures containing INFECTION
    if (gameMode === 'ADVENTURE' && selectedAdventureId && xNbJoueurs < 7) {
      const { data: adventureSteps } = await supabase
        .from('adventure_steps')
        .select('game_type_code')
        .eq('adventure_id', selectedAdventureId);
      
      const hasInfection = adventureSteps?.some(step => step.game_type_code === 'INFECTION');
      if (hasInfection) {
        toast.error('Cette aventure contient INFECTION qui nécessite minimum 7 joueurs');
        setXNbJoueurs(7);
        return;
      }
    }

    setCreating(true);
    try {
      const joinCode = generateJoinCode();
      
      // Create the game
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
          starting_tokens: startingTokens,
          mode: gameMode,
          adventure_id: gameMode === 'ADVENTURE' ? selectedAdventureId : null,
          selected_game_type_code: gameMode === 'SINGLE_GAME' ? selectedGameTypeCode : null,
          current_step_index: 1,
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

      // For adventure mode, get the first step's game type and create initial session_game
      let sessionGameId: string | null = null;
      let actualGameTypeCode = selectedGameTypeCode;
      
      if (gameMode === 'ADVENTURE' && selectedAdventureId) {
        const { data: firstStep } = await supabase
          .from('adventure_steps')
          .select('game_type_code')
          .eq('adventure_id', selectedAdventureId)
          .eq('step_index', 1)
          .single();
        
        if (firstStep) {
          actualGameTypeCode = firstStep.game_type_code;
        }
      }

      // Create the initial session_game
      const { data: sessionGame, error: sessionError } = await supabase
        .from('session_games')
        .insert({
          session_id: data.id,
          step_index: 1,
          game_type_code: actualGameTypeCode || 'FORET',
          status: 'PENDING',
          manche_active: 1,
          phase: 'PHASE1_MISES',
        })
        .select()
        .single();

      if (!sessionError && sessionGame) {
        sessionGameId = sessionGame.id;
        
        // Update games with the session_game_id and game type
        await supabase
          .from('games')
          .update({ 
            current_session_game_id: sessionGameId,
            selected_game_type_code: actualGameTypeCode,
          })
          .eq('id', data.id);
      }

      // Initialize game monsters with defaults
      await supabase.rpc('initialize_game_monsters', { p_game_id: data.id });

      toast.success('Partie créée !');
      setGameName('');
      setXNbJoueurs(6);
      setStartingTokens(50);
      setSensEgalite('ASC');
      setGameMode('SINGLE_GAME');
      setSelectedAdventureId(null);
      setSelectedGameTypeCode('FORET');
      
      // Go to detail view of the new game
      setSelectedGame({ 
        ...data, 
        active_players: 0,
        current_session_game_id: sessionGameId,
        mode: gameMode,
        adventure_id: gameMode === 'ADVENTURE' ? selectedAdventureId : null,
        current_step_index: 1,
        selected_game_type_code: actualGameTypeCode,
      } as Game);
      setViewMode('detail');
    } catch (error) {
      console.error('Error creating game:', error);
      toast.error('Erreur lors de la création de la partie');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteGame = async (gameId: string) => {
    setDeleting(gameId);
    try {
      const tablesToClear = [
        'session_events',
        'session_bans',
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
        'game_state_monsters',
        'game_monsters',
        'priority_rankings',
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
          <img src={logoNdogmoabeng} alt="Ndogmoabeng" className="h-8 w-8 object-contain cursor-pointer" onClick={() => navigate('/')} />
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

      <main className="max-w-5xl mx-auto space-y-6">
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
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-medium truncate">{game.name}</h3>
                          {game.mode === 'ADVENTURE' ? (
                            <Badge className="bg-amber-600/20 text-amber-400 border-amber-600/30 hover:bg-amber-600/30">
                              <Map className="h-3 w-3 mr-1" />
                              Aventure
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-600/30 hover:bg-emerald-600/30">
                              <Gamepad2 className="h-3 w-3 mr-1" />
                              Partie unique
                            </Badge>
                          )}
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

            {/* Adventure/Mode Selector */}
            <AdventureSelector
              mode={gameMode}
              onModeChange={setGameMode}
              selectedAdventureId={selectedAdventureId}
              onAdventureSelect={setSelectedAdventureId}
              selectedGameTypeCode={selectedGameTypeCode}
              onGameTypeSelect={setSelectedGameTypeCode}
            />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="xNbJoueurs">
                  Nombre de joueurs (X)
                  {requiresMinimum7Players() && (
                    <span className="text-xs text-amber-500 ml-2">(min. 7 pour INFECTION)</span>
                  )}
                </Label>
                <Input
                  id="xNbJoueurs"
                  type="number"
                  min={getMinimumPlayers()}
                  max={20}
                  value={xNbJoueurs}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || getMinimumPlayers();
                    const minPlayers = getMinimumPlayers();
                    setXNbJoueurs(Math.max(minPlayers, value));
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="startingTokens">Jetons de départ</Label>
                <Input
                  id="startingTokens"
                  type="number"
                  min={0}
                  max={1000}
                  value={startingTokens}
                  onChange={(e) => setStartingTokens(Math.max(0, parseInt(e.target.value) || 50))}
                />
              </div>
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
          <MJDashboard 
            game={selectedGame} 
            onBack={goToList} 
          />
        )}
      </main>
    </div>
  );
}
