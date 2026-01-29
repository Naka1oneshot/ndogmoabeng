import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ForestButton } from '@/components/ui/ForestButton';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { AdventureProgressDisplay, GAME_TYPE_INFO } from '@/components/game/AdventureProgressDisplay';
import { User, AlertCircle, Loader2, Smartphone, Users, Ban, Coins, Lock, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { getDeviceId } from '@/hooks/useDeviceId';
import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useSubscription } from '@/hooks/useSubscription';
import logoNdogmoabeng from '@/assets/logo-ndogmoabeng.png';

interface Game {
  id: string;
  name: string;
  status: string;
  x_nb_joueurs: number;
  mode: string;
  current_step_index: number;
  selected_game_type_code: string | null;
}

const PLAYER_TOKEN_PREFIX = 'ndogmoabeng_player_';

export default function JoinAnonymous() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useUserProfile();
  const { token_bonus, hasClanBenefits, loading: subscriptionLoading } = useSubscription();

  const [displayName, setDisplayName] = useState('');
  const [clan, setClan] = useState<string>('none');
  const [useTokenForClan, setUseTokenForClan] = useState(false);
  const [lockClan, setLockClan] = useState(false);
  const [game, setGame] = useState<Game | null>(null);
  const [error, setError] = useState('');
  const [banReason, setBanReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);

  // Determine if user is logged in with a profile
  const isLoggedIn = !!user && !!profile;

  // Set display name from profile when loaded
  useEffect(() => {
    if (profile?.display_name && !displayName) {
      setDisplayName(profile.display_name);
    }
  }, [profile]);

  // Determine if user can select clan
  const userHasClanBenefits = hasClanBenefits();
  const userTokenBalance = token_bonus?.token_balance || 0;
  const canSelectClan = userHasClanBenefits || useTokenForClan;
  
  // Reset clan selection if no access
  useEffect(() => {
    if (!canSelectClan && clan !== 'none') {
      setClan('none');
      setLockClan(false);
    }
  }, [canSelectClan, clan]);

  useEffect(() => {
    if (code) {
      checkGame(code);
    } else {
      setError('Code de partie manquant');
      setLoading(false);
    }
  }, [code]);

  // Real-time subscription for player count updates
  useEffect(() => {
    if (!game?.id) return;

    const channel = supabase
      .channel(`join-players-${game.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_players',
          filter: `game_id=eq.${game.id}`,
        },
        async () => {
          // Refetch player count when any change occurs
          const { count } = await supabase
            .from('game_players')
            .select('*', { count: 'exact', head: true })
            .eq('game_id', game.id)
            .eq('status', 'ACTIVE')
            .not('player_number', 'is', null);

          setPlayerCount(count || 0);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [game?.id]);

  const checkGame = async (joinCode: string) => {
    setLoading(true);
    setError('');
    setBanReason(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('games')
        .select('id, name, status, x_nb_joueurs, mode, current_step_index, selected_game_type_code')
        .eq('join_code', joinCode.toUpperCase())
        .maybeSingle();

      if (fetchError) {
        console.error('Fetch error:', fetchError);
        setError('Erreur lors de la recherche');
        setLoading(false);
        return;
      }

      if (!data) {
        setError('Partie introuvable');
        setLoading(false);
        return;
      }

      // Check if we already have a token for this game BEFORE status check
      // This allows reconnection even if game is IN_GAME
      const existingToken = localStorage.getItem(`${PLAYER_TOKEN_PREFIX}${data.id}`);
      if (existingToken) {
        const { data: validation } = await supabase.functions.invoke('validate-player', {
          body: { gameId: data.id, playerToken: existingToken },
        });

        if (validation?.valid) {
          navigate(`/player/${data.id}`);
          return;
        } else {
          // Token invalid, remove it
          localStorage.removeItem(`${PLAYER_TOKEN_PREFIX}${data.id}`);
        }
      }

      // Now check game status for NEW players (after token check)
      // Allow LOBBY, IN_ROUND, and IN_GAME status
      if (data.status !== 'LOBBY' && data.status !== 'IN_ROUND' && data.status !== 'IN_GAME') {
        setError('Cette partie n\'accepte plus de nouveaux joueurs');
        setLoading(false);
        return;
      }

      setGame(data as Game);

      // Check if device is banned
      const deviceId = getDeviceId();
      const { data: ban } = await supabase
        .from('session_bans')
        .select('reason')
        .eq('game_id', data.id)
        .eq('device_id', deviceId)
        .maybeSingle();

      if (ban) {
        setBanReason(ban.reason || 'Vous avez été banni de cette partie');
        setLoading(false);
        return;
      }

      // Get current player count (only ACTIVE players)
      const { count } = await supabase
        .from('game_players')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', data.id)
        .eq('status', 'ACTIVE')
        .not('player_number', 'is', null);

      setPlayerCount(count || 0);
    } catch (err) {
      console.error('Check game error:', err);
      setError('Erreur lors de la recherche');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!game || !displayName.trim()) {
      toast.error('Veuillez entrer un pseudo');
      return;
    }

    setJoining(true);
    try {
      const deviceId = getDeviceId();
      
      // Check if we have an existing token (for reconnection)
      const existingToken = localStorage.getItem(`${PLAYER_TOKEN_PREFIX}${game.id}`);
      
      const { data, error: joinError } = await supabase.functions.invoke('join-game', {
        body: { 
          joinCode: code, 
          displayName: displayName.trim(),
          clan: canSelectClan && clan !== 'none' ? clan : null,
          deviceId,
          reconnectKey: existingToken || undefined,
          useTokenForClan: useTokenForClan && !userHasClanBenefits,
          lockClan: lockClan && canSelectClan && clan !== 'none',
        },
      });

      if (joinError) {
        console.error('Join error:', joinError);
        toast.error('Erreur lors de la connexion');
        return;
      }

      if (!data?.success) {
        // Check if banned
        if (data?.banned || data?.error === 'BANNED') {
          setBanReason(data?.reason || 'Vous avez été banni de cette partie');
          toast.error('Accès refusé', {
            description: data?.reason || 'Vous avez été banni de cette partie',
          });
          return;
        }
        // Check if kicked
        if (data?.kicked) {
          setBanReason(data?.reason || 'Ce pseudo a été expulsé de cette partie');
          toast.error('Accès refusé', {
            description: data?.reason || 'Ce pseudo a été expulsé',
          });
          return;
        }
        toast.error(data?.error || 'Erreur lors de la connexion');
        return;
      }

      // Store the player token
      localStorage.setItem(`${PLAYER_TOKEN_PREFIX}${data.gameId}`, data.playerToken);

      const message = data.reconnected || data.reactivated 
        ? `Re-bienvenue ${data.displayName || displayName}! Vous êtes le joueur #${data.playerNumber}`
        : `Bienvenue ${displayName}! Vous êtes le joueur #${data.playerNumber}`;
      
      toast.success(message);
      navigate(`/player/${data.gameId}`);
    } catch (error) {
      console.error('Error joining game:', error);
      toast.error('Erreur lors de la connexion');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isFull = game && game.x_nb_joueurs > 0 && playerCount >= game.x_nb_joueurs;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative">
      {/* Theme toggle in top-right corner */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center justify-center w-24 h-24 mb-4 animate-float">
            <img src={logoNdogmoabeng} alt="Ndogmoabeng" className="w-full h-full object-contain" />
          </Link>
          <h1 className="font-display text-2xl text-glow mb-2">
            {game?.selected_game_type_code 
              ? (GAME_TYPE_INFO[game.selected_game_type_code]?.fullName || 'Ndogmoabeng')
              : 'La Forêt de Ndogmoabeng'}
          </h1>
          <p className="text-muted-foreground">
            Rejoindre une partie
          </p>
        </div>

        <div className="card-gradient rounded-lg border border-border p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive border border-destructive/20">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {banReason && (
            <div className="flex flex-col items-center gap-3 p-4 rounded-md bg-destructive/10 text-destructive border border-destructive/20">
              <Ban className="h-8 w-8" />
              <div className="text-center">
                <p className="font-medium">Accès refusé</p>
                <p className="text-sm mt-1">{banReason}</p>
              </div>
            </div>
          )}

          {game && !banReason && (
            <>
              <div className="text-center p-4 bg-secondary/50 rounded-md space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Partie</p>
                  <p className="font-display text-lg">{game.name}</p>
                </div>
                
                {/* Adventure Progress Display */}
                <div className="flex justify-center">
                  <AdventureProgressDisplay
                    mode={game.mode}
                    currentStepIndex={game.current_step_index}
                    currentGameTypeCode={game.selected_game_type_code}
                  />
                </div>
                
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>
                    {playerCount} / {game.x_nb_joueurs || '∞'} joueurs
                  </span>
                </div>
              </div>

              {isFull ? (
                <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive border border-destructive/20">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm">Cette partie est complète</span>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Votre pseudo</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="displayName"
                        placeholder="Ex: Explorateur"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="pl-10"
                        onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                        disabled={isLoggedIn}
                        readOnly={isLoggedIn}
                      />
                    </div>
                    {isLoggedIn && (
                      <p className="text-xs text-muted-foreground">
                        Pseudo lié à votre compte
                      </p>
                    )}
                  </div>

                  {/* Token usage for clan (only if user is logged in and has tokens but no subscription benefits) */}
                  {user && !userHasClanBenefits && userTokenBalance > 0 && !subscriptionLoading && (
                    <div className="p-3 rounded-md bg-forest-gold/10 border border-forest-gold/30 space-y-2">
                      <div className="flex items-center gap-2">
                        <Coins className="h-4 w-4 text-forest-gold" />
                        <span className="text-sm font-medium text-forest-gold">
                          Vous avez {userTokenBalance} Token{userTokenBalance > 1 ? 's' : ''} Ndogmoabeng
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="useToken"
                          checked={useTokenForClan}
                          onCheckedChange={(checked) => setUseTokenForClan(checked === true)}
                        />
                        <label
                          htmlFor="useToken"
                          className="text-sm text-muted-foreground cursor-pointer"
                        >
                          Utiliser 1 Token pour activer les avantages de Clan
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Clan selection - disabled if no benefits and no token used */}
                  <div className="space-y-2">
                    <Label htmlFor="clan" className="flex items-center gap-2">
                      Clan
                      {!canSelectClan && (
                        <span className="text-xs text-muted-foreground">(abonnement ou Token requis)</span>
                      )}
                    </Label>
                    <Select 
                      value={canSelectClan ? clan : 'none'} 
                      onValueChange={setClan}
                      disabled={!canSelectClan}
                    >
                      <SelectTrigger id="clan" className={!canSelectClan ? 'opacity-50' : ''}>
                        <SelectValue placeholder="Choisir un clan" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucun clan</SelectItem>
                        <SelectItem value="Royaux">👑 Maison Royale</SelectItem>
                        <SelectItem value="Zoulous">💰 Fraternité Zoulous</SelectItem>
                        <SelectItem value="Keryndes">🧭 Maison des Keryndes</SelectItem>
                        <SelectItem value="Akandé">⚔️ Akandé</SelectItem>
                        <SelectItem value="Aseyra">📜 Cercle d'Aséyra</SelectItem>
                        <SelectItem value="Akila">🔬 Les Sources d'Akila</SelectItem>
                        <SelectItem value="Ezkar">💥 Ezkar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Lock clan option - only if clan is selected */}
                  {canSelectClan && clan !== 'none' && (
                    <div className="flex items-center space-x-2 p-2 rounded-md bg-secondary/30">
                      <Checkbox
                        id="lockClan"
                        checked={lockClan}
                        onCheckedChange={(checked) => setLockClan(checked === true)}
                      />
                      <label
                        htmlFor="lockClan"
                        className="text-sm text-muted-foreground cursor-pointer flex items-center gap-1"
                      >
                        <Lock className="h-3 w-3" />
                        Verrouiller mon clan (empêche le MJ de le changer)
                      </label>
                    </div>
                  )}

                  {/* Info about clan benefits */}
                  {canSelectClan && clan !== 'none' && (
                    <div className="p-2 rounded-md bg-primary/10 border border-primary/30">
                      <div className="flex items-center gap-2 text-xs text-primary">
                        <ShieldCheck className="h-4 w-4" />
                        <span>Avantages de clan actifs pour cette partie</span>
                      </div>
                    </div>
                  )}

                  <ForestButton 
                    className="w-full" 
                    onClick={handleJoin}
                    disabled={joining || !displayName.trim()}
                  >
                    {joining ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      'Rejoindre la partie'
                    )}
                  </ForestButton>
                </>
              )}

              <div className="pt-4 border-t border-border">
                <button
                  type="button"
                  className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors p-2"
                  onClick={() => {
                    toast.info('Demandez au MJ de réinitialiser votre accès');
                  }}
                >
                  <Smartphone className="h-4 w-4" />
                  J'ai changé de téléphone / perdu l'accès
                </button>
              </div>
            </>
          )}

          {!game && !error && !banReason && (
            <p className="text-center text-muted-foreground">
              Recherche de la partie...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}