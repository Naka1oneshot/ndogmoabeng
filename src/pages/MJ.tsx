import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';
import { ForestButton } from '@/components/ui/ForestButton';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { AdventureSelector } from '@/components/mj/AdventureSelector';
import { GameStatusBadge } from '@/components/game/GameStatusBadge';
import { AdminBadge } from '@/components/game/AdminBadge';
import { MJDashboard } from '@/components/mj/MJDashboard';
import { 
  Plus, Loader2, 
  ChevronLeft, ChevronRight, Trash2, Eye, Users, Map, Gamepad2, Globe, Lock, Crown, Search, X
} from 'lucide-react';
import { UserAvatarButton } from '@/components/ui/UserAvatarButton';
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
  is_public?: boolean;
  host_user_id?: string;
  host_email?: string;
}

// Game type display names
const GAME_TYPE_LABELS: Record<string, { label: string; emoji: string; colorClass: string }> = {
  FORET: { label: 'Forêt', emoji: '🌲', colorClass: 'text-emerald-400' },
  RIVIERES: { label: 'Rivières', emoji: '🌊', colorClass: 'text-blue-400' },
  INFECTION: { label: 'Infection', emoji: '🧟', colorClass: 'text-purple-400' },
};

// GameListItem component for rendering a single game in the list
function GameListItem({
  game,
  isAdmin,
  userId,
  deleting,
  onOpenDetail,
  onDelete,
}: {
  game: Game;
  isAdmin: boolean;
  userId?: string;
  deleting: string | null;
  onOpenDetail: (game: Game) => void;
  onDelete: (gameId: string) => void;
}) {
  const gameTypeInfo = game.selected_game_type_code 
    ? GAME_TYPE_LABELS[game.selected_game_type_code] 
    : null;

  return (
    <div
      className="card-gradient rounded-lg border border-border p-4 hover:border-primary/50 transition-colors"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="font-medium truncate">{game.name}</h3>
            {/* Game Type Badge */}
            {gameTypeInfo && (
              <Badge className={`${gameTypeInfo.colorClass} bg-muted/50 border-current/30`}>
                <span className="mr-1">{gameTypeInfo.emoji}</span>
                {gameTypeInfo.label}
              </Badge>
            )}
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
            {game.is_public ? (
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">
                <Globe className="h-3 w-3 mr-1" />
                Publique
              </Badge>
            ) : (
              <Badge className="bg-slate-500/10 text-slate-400 border-slate-500/30 hover:bg-slate-500/20">
                <Lock className="h-3 w-3 mr-1" />
                Privée
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
            <span className="font-mono text-primary">{game.join_code}</span>
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {game.active_players}
            </span>
            <span>
              {new Date(game.created_at).toLocaleDateString('fr-FR')}
            </span>
            {/* Show host email for admins */}
            {isAdmin && game.host_email && game.host_user_id !== userId && (
              <span className="flex items-center gap-1 text-amber-400">
                <Crown className="h-3 w-3" />
                {game.host_email}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ForestButton
            variant="outline"
            size="sm"
            onClick={() => onOpenDetail(game)}
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
                  onClick={() => onDelete(game.id)}
                >
                  Supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}

// Generate cryptographically secure join code
function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excludes confusing characters like 0, O, 1, I
  const randomBytes = new Uint8Array(6);
  crypto.getRandomValues(randomBytes);
  
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(randomBytes[i] % chars.length);
  }
  return code;
}

export default function MJ() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const { gameId: urlGameId } = useParams<{ gameId?: string }>();
  
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
  const [isPublic, setIsPublic] = useState(false);
  const [creating, setCreating] = useState(false);
  
  // Game actions
  const [deleting, setDeleting] = useState<string | null>(null);
  
  // Search and filters
  const [searchQuery, setSearchQuery] = useState('');
  const [gameTypeFilter, setGameTypeFilter] = useState<string | null>(null);
  
  // Pagination for finished games
  const ITEMS_PER_PAGE = 10;
  const [finishedPage, setFinishedPage] = useState(1);

  // Check if user can create a new game based on subscription limits
  const { canCreateGame, limits, max_limits } = useSubscription();
  
  const canCreateNewGame = (): boolean => {
    if (isAdmin) return true;
    // Check subscription limits for games creatable
    return canCreateGame();
  };

  const getActiveGameCount = (): number => {
    return games.filter(g => g.status !== 'FINISHED').length;
  };
  
  const getRemainingCreatable = (): number => {
    return limits.games_creatable;
  };
  
  const getMaxCreatable = (): number => {
    return max_limits?.games_creatable ?? limits.games_creatable;
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    // All authenticated users can access MJ now
    if (user && !authLoading) {
      fetchGames();
      const cleanup = subscribeToGames();
      return cleanup;
    }
  }, [user, authLoading, isAdmin]);

  // Handle URL gameId parameter - load the game directly
  useEffect(() => {
    if (urlGameId && games.length > 0 && !loadingGames) {
      const game = games.find(g => g.id === urlGameId);
      if (game) {
        setSelectedGame(game);
        setViewMode('detail');
      } else {
        // Game not found in user's games, check if it exists and user is the host
        const checkGame = async () => {
          const { data } = await supabase
            .from('games')
            .select('*')
            .eq('id', urlGameId)
            .eq('host_user_id', user?.id)
            .maybeSingle();
          
          if (data) {
            // Fetch player count
            const { count } = await supabase
              .from('game_players')
              .select('*', { count: 'exact', head: true })
              .eq('game_id', data.id)
              .eq('status', 'ACTIVE')
              .eq('is_host', false);
            
            const gameWithCount = { ...data, active_players: count || 0 } as Game;
            setSelectedGame(gameWithCount);
            setViewMode('detail');
          } else {
            toast.error('Partie non trouvée ou accès non autorisé');
            navigate('/mj');
          }
        };
        checkGame();
      }
    }
  }, [urlGameId, games, loadingGames, user]);

  const fetchGames = async () => {
    if (!user) return;
    
    try {
      let query = supabase.from('games').select('*').order('created_at', { ascending: false });
      
      // Non-admins only see their own games
      if (!isAdmin) {
        query = query.eq('host_user_id', user.id);
      }

      const { data: gamesData, error } = await query;

      if (error) throw error;

      // Count active players and get host email for each game
      const gamesWithCounts = await Promise.all(
        (gamesData || []).map(async (game) => {
          const { count } = await supabase
            .from('game_players')
            .select('*', { count: 'exact', head: true })
            .eq('game_id', game.id)
            .eq('status', 'ACTIVE')
            .eq('is_host', false);

          // For admins, get the host's email
          let hostEmail: string | null = null;
          if (isAdmin && game.host_user_id) {
            const { data: emailData } = await supabase
              .rpc('get_user_email', { user_id: game.host_user_id });
            hostEmail = emailData || null;
          }

          return {
            ...game,
            active_players: count || 0,
            host_email: hostEmail,
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

  // Get minimum players based on game type
  const getMinimumPlayers = (): number => {
    if (gameMode === 'SINGLE_GAME') {
      if (selectedGameTypeCode === 'INFECTION') return 7;
      if (selectedGameTypeCode === 'FORET' || selectedGameTypeCode === 'RIVIERES') return 2;
    }
    return 2;
  };

  // Get label for minimum players hint
  const getMinPlayersLabel = (): string | null => {
    if (gameMode === 'SINGLE_GAME' && selectedGameTypeCode) {
      if (selectedGameTypeCode === 'INFECTION') return 'min. 7 pour INFECTION';
      if (selectedGameTypeCode === 'FORET') return 'min. 2 pour FORÊT';
      if (selectedGameTypeCode === 'RIVIERES') return 'min. 2 pour RIVIÈRES';
    }
    return null;
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

    // Check if user can create a new game
    if (!canCreateNewGame()) {
      toast.error('Vous avez atteint votre limite d\'initialisations de parties ce mois-ci. Passez à un abonnement supérieur ou achetez des tokens.');
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
          is_public: isPublic,
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

  if (!user) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen px-4 py-6">
      {/* Header - hidden when in detail view (MJDashboard has its own) */}
      {viewMode !== 'detail' && (
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <img src={logoNdogmoabeng} alt="Ndogmoabeng" className="h-8 w-8 object-contain cursor-pointer" onClick={() => navigate('/')} />
            <h1 className="font-display text-xl">Tableau MJ</h1>
            {isAdmin && (
              <Badge className="bg-amber-600/20 text-amber-400 border-amber-600/30">
                <Crown className="h-3 w-3 mr-1" />
                Admin
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            {isAdmin && <AdminBadge email={user?.email} />}
            <ThemeToggle />
            <UserAvatarButton size="sm" />
          </div>
        </header>
      )}

      <main className="max-w-5xl mx-auto space-y-6">
        {viewMode === 'list' && (
          <>
            {/* Header avec bouton créer */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-lg">
                  {isAdmin ? 'Toutes les Parties' : 'Mes Parties'}
                </h2>
                {!isAdmin && (
                  <p className="text-sm text-muted-foreground">
                    {getRemainingCreatable() > 0 
                      ? `${getRemainingCreatable()}/${getMaxCreatable()} initialisations restantes`
                      : 'Limite atteinte ce mois-ci'}
                  </p>
                )}
              </div>
              <ForestButton 
                onClick={() => setViewMode('create')}
                disabled={!canCreateNewGame()}
              >
                <Plus className="h-5 w-5" />
                Nouvelle partie
              </ForestButton>
            </div>

            {/* Barre de recherche et filtres */}
            {games.length > 0 && (
              <div className="space-y-3">
                {/* Recherche textuelle */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher par nom ou code..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setFinishedPage(1); // Reset pagination on search
                    }}
                    className="pl-10 pr-10"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                
                {/* Filtres par type de jeu */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setGameTypeFilter(null);
                      setFinishedPage(1);
                    }}
                    className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                      gameTypeFilter === null 
                        ? 'bg-primary text-primary-foreground border-primary' 
                        : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    Tous
                  </button>
                  <button
                    onClick={() => {
                      setGameTypeFilter(gameTypeFilter === 'FORET' ? null : 'FORET');
                      setFinishedPage(1);
                    }}
                    className={`px-3 py-1.5 text-sm rounded-full border transition-colors flex items-center gap-1.5 ${
                      gameTypeFilter === 'FORET' 
                        ? 'bg-emerald-600 text-white border-emerald-600' 
                        : 'bg-muted/50 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10'
                    }`}
                  >
                    🌲 Forêt
                  </button>
                  <button
                    onClick={() => {
                      setGameTypeFilter(gameTypeFilter === 'RIVIERES' ? null : 'RIVIERES');
                      setFinishedPage(1);
                    }}
                    className={`px-3 py-1.5 text-sm rounded-full border transition-colors flex items-center gap-1.5 ${
                      gameTypeFilter === 'RIVIERES' 
                        ? 'bg-blue-600 text-white border-blue-600' 
                        : 'bg-muted/50 text-blue-400 border-blue-500/30 hover:bg-blue-500/10'
                    }`}
                  >
                    🌊 Rivières
                  </button>
                  <button
                    onClick={() => {
                      setGameTypeFilter(gameTypeFilter === 'INFECTION' ? null : 'INFECTION');
                      setFinishedPage(1);
                    }}
                    className={`px-3 py-1.5 text-sm rounded-full border transition-colors flex items-center gap-1.5 ${
                      gameTypeFilter === 'INFECTION' 
                        ? 'bg-purple-600 text-white border-purple-600' 
                        : 'bg-muted/50 text-purple-400 border-purple-500/30 hover:bg-purple-500/10'
                    }`}
                  >
                    🧟 Infection
                  </button>
                </div>
              </div>
            )}

            {/* Info message for non-admins who can't create */}
            {!isAdmin && !canCreateNewGame() && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 text-destructive text-sm">
                <p>Vous avez atteint votre limite d'initialisations de parties ce mois-ci. Passez à un abonnement supérieur ou achetez des tokens.</p>
              </div>
            )}

            {/* Liste des parties par catégories */}
            <div className="space-y-6">
              {loadingGames ? (
                <div className="card-gradient rounded-lg border border-border p-8 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : games.length === 0 ? (
                <div className="card-gradient rounded-lg border border-border p-8 text-center text-muted-foreground">
                  <p>Aucune partie créée</p>
                  <p className="text-sm mt-2">Cliquez sur "Nouvelle partie" pour commencer</p>
                </div>
              ) : (() => {
                // Filter games by search query and game type
                const query = searchQuery.toLowerCase().trim();
                let filteredGames = games;
                
                // Apply text search filter
                if (query) {
                  filteredGames = filteredGames.filter(g => 
                    g.name.toLowerCase().includes(query) || 
                    g.join_code.toLowerCase().includes(query)
                  );
                }
                
                // Apply game type filter
                if (gameTypeFilter) {
                  filteredGames = filteredGames.filter(g => 
                    g.selected_game_type_code === gameTypeFilter
                  );
                }

                const inProgress = filteredGames.filter(g => g.status === 'IN_GAME' || g.status === 'RUNNING');
                const waiting = filteredGames.filter(g => g.status === 'LOBBY');
                const finished = filteredGames.filter(g => g.status === 'FINISHED' || g.status === 'ENDED');

                if (filteredGames.length === 0) {
                  const hasFilters = query || gameTypeFilter;
                  return (
                    <div className="card-gradient rounded-lg border border-border p-8 text-center text-muted-foreground">
                      <p>Aucune partie trouvée{hasFilters ? ' avec ces critères' : ''}</p>
                      {hasFilters && (
                        <button 
                          onClick={() => {
                            setSearchQuery('');
                            setGameTypeFilter(null);
                          }}
                          className="text-sm mt-2 text-primary hover:underline"
                        >
                          Effacer les filtres
                        </button>
                      )}
                    </div>
                  );
                }

                return (
                  <>
                    {/* Parties en cours */}
                    {inProgress.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="font-display text-base flex items-center gap-2 text-emerald-400">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          En cours
                          <Badge variant="outline" className="ml-2 text-emerald-400 border-emerald-500/30">
                            {inProgress.length}
                          </Badge>
                        </h3>
                        {inProgress.map((game) => (
                          <GameListItem
                            key={game.id}
                            game={game}
                            isAdmin={isAdmin}
                            userId={user?.id}
                            deleting={deleting}
                            onOpenDetail={openGameDetail}
                            onDelete={handleDeleteGame}
                          />
                        ))}
                      </div>
                    )}

                    {/* Parties en attente (LOBBY) */}
                    {waiting.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="font-display text-base flex items-center gap-2 text-amber-400">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          En attente
                          <Badge variant="outline" className="ml-2 text-amber-400 border-amber-500/30">
                            {waiting.length}
                          </Badge>
                        </h3>
                        {waiting.map((game) => (
                          <GameListItem
                            key={game.id}
                            game={game}
                            isAdmin={isAdmin}
                            userId={user?.id}
                            deleting={deleting}
                            onOpenDetail={openGameDetail}
                            onDelete={handleDeleteGame}
                          />
                        ))}
                      </div>
                    )}

                    {/* Parties terminées avec pagination */}
                    {finished.length > 0 && (() => {
                      const totalPages = Math.ceil(finished.length / ITEMS_PER_PAGE);
                      const currentPage = Math.min(finishedPage, totalPages);
                      const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
                      const paginatedFinished = finished.slice(startIndex, startIndex + ITEMS_PER_PAGE);
                      
                      return (
                        <div className="space-y-3">
                          <h3 className="font-display text-base flex items-center gap-2 text-muted-foreground">
                            <span className="w-2 h-2 rounded-full bg-muted-foreground" />
                            Terminées
                            <Badge variant="outline" className="ml-2 text-muted-foreground border-muted-foreground/30">
                              {finished.length}
                            </Badge>
                          </h3>
                          {paginatedFinished.map((game) => (
                            <GameListItem
                              key={game.id}
                              game={game}
                              isAdmin={isAdmin}
                              userId={user?.id}
                              deleting={deleting}
                              onOpenDetail={openGameDetail}
                              onDelete={handleDeleteGame}
                            />
                          ))}
                          
                          {/* Pagination controls */}
                          {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-2 pt-4">
                              <button
                                onClick={() => setFinishedPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-2 rounded-lg border border-border bg-muted/50 hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                <ChevronLeft className="h-4 w-4" />
                              </button>
                              
                              <div className="flex items-center gap-1">
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                                  // Show first, last, current, and adjacent pages
                                  const showPage = page === 1 || 
                                    page === totalPages || 
                                    Math.abs(page - currentPage) <= 1;
                                  const showEllipsis = page === 2 && currentPage > 3 ||
                                    page === totalPages - 1 && currentPage < totalPages - 2;
                                  
                                  if (!showPage && !showEllipsis) return null;
                                  if (showEllipsis && !showPage) {
                                    return <span key={page} className="px-2 text-muted-foreground">...</span>;
                                  }
                                  
                                  return (
                                    <button
                                      key={page}
                                      onClick={() => setFinishedPage(page)}
                                      className={`min-w-[36px] h-9 px-3 rounded-lg border transition-colors ${
                                        page === currentPage
                                          ? 'bg-primary text-primary-foreground border-primary'
                                          : 'border-border bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground'
                                      }`}
                                    >
                                      {page}
                                    </button>
                                  );
                                })}
                              </div>
                              
                              <button
                                onClick={() => setFinishedPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="p-2 rounded-lg border border-border bg-muted/50 hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                <ChevronRight className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </>
                );
              })()}
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
                  {getMinPlayersLabel() && (
                    <span className="text-xs text-amber-500 ml-2">({getMinPlayersLabel()})</span>
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

            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border border-border">
              <div className="space-y-0.5">
                <Label htmlFor="isPublic" className="text-base font-medium cursor-pointer">
                  Partie publique
                </Label>
                <p className="text-sm text-muted-foreground">
                  {isPublic 
                    ? "Visible par tous, les joueurs peuvent rejoindre sans code" 
                    : "Privée, nécessite le code pour rejoindre"}
                </p>
              </div>
              <Switch
                id="isPublic"
                checked={isPublic}
                onCheckedChange={setIsPublic}
              />
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
