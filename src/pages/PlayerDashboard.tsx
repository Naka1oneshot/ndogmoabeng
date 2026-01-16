import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { PlayerList } from '@/components/game/PlayerList';
import { GameStatusBadge } from '@/components/game/GameStatusBadge';
import { usePlayerPresence } from '@/hooks/usePlayerPresence';
import { Loader2, Clock, User, LogOut, Coins, Trophy, Users, Swords, Check, History } from 'lucide-react';
import { ForestButton } from '@/components/ui/ForestButton';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import logoNdogmoabeng from '@/assets/logo-ndogmoabeng.png';

interface Game {
  id: string;
  name: string;
  status: 'LOBBY' | 'IN_GAME' | 'ENDED';
  join_code: string;
  manche_active: number;
}

interface Player {
  id: string;
  displayName: string;
  playerNumber: number;
  jetons: number;
  recompenses: number;
  clan: string | null;
  mateNum: number | null;
}

interface RoundBet {
  id: string;
  manche: number;
  mise: number;
  created_at: string;
}

const PLAYER_TOKEN_PREFIX = 'ndogmoabeng_player_';

export default function PlayerDashboard() {
  const navigate = useNavigate();
  const { gameId } = useParams<{ gameId: string }>();

  const [game, setGame] = useState<Game | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Betting state
  const [mise, setMise] = useState<string>('0');
  const [submittingBet, setSubmittingBet] = useState(false);
  const [betHistory, setBetHistory] = useState<RoundBet[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const { handleLeave: presenceLeave } = usePlayerPresence({
    gameId,
    enabled: !!player && !!game,
    onInvalidToken: () => {
      if (gameId) {
        localStorage.removeItem(`${PLAYER_TOKEN_PREFIX}${gameId}`);
        redirectToJoin();
      }
    },
  });

  const redirectToJoin = async () => {
    if (!gameId) return;
    
    try {
      const { data: gameData } = await supabase
        .from('games')
        .select('join_code')
        .eq('id', gameId)
        .single();

      if (gameData) {
        navigate(`/join/${gameData.join_code}`);
      } else {
        setError('Partie introuvable');
        setLoading(false);
      }
    } catch {
      setError('Erreur lors de la recherche');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!gameId) {
      setError('ID de partie manquant');
      setLoading(false);
      return;
    }

    const playerToken = localStorage.getItem(`${PLAYER_TOKEN_PREFIX}${gameId}`);
    
    if (!playerToken) {
      redirectToJoin();
      return;
    }

    validateAndFetch(playerToken);
  }, [gameId]);

  const validateAndFetch = async (playerToken: string) => {
    try {
      const { data, error: validateError } = await supabase.functions.invoke('validate-player', {
        body: { gameId, playerToken },
      });

      if (validateError || !data?.valid) {
        localStorage.removeItem(`${PLAYER_TOKEN_PREFIX}${gameId}`);
        
        // Check if player was removed
        if (data?.removed) {
          toast.error(data.error || 'Vous avez été expulsé de cette partie');
          navigate('/');
          return;
        }
        
        redirectToJoin();
        return;
      }

      setPlayer({
        id: data.player.id,
        displayName: data.player.displayName,
        playerNumber: data.player.playerNumber,
        jetons: data.player.jetons ?? 0,
        recompenses: data.player.recompenses ?? 0,
        clan: data.player.clan,
        mateNum: data.player.mateNum,
      });

      setGame(data.game as Game);
      setLoading(false);

      // Fetch bet history
      fetchBetHistory(data.game.id, data.player.playerNumber);

      subscribeToGame();
    } catch (err) {
      console.error('Validation error:', err);
      setError('Erreur de validation');
      setLoading(false);
    }
  };

  const subscribeToGame = () => {
    if (!gameId) return;

    const playerToken = localStorage.getItem(`${PLAYER_TOKEN_PREFIX}${gameId}`);

    const channel = supabase
      .channel(`player-game-${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          setGame((prev) => prev ? { ...prev, ...payload.new } as Game : null);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`,
        },
        () => {
          // Game was deleted
          localStorage.removeItem(`${PLAYER_TOKEN_PREFIX}${gameId}`);
          toast.error('La partie a été supprimée par le MJ');
          navigate('/');
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'game_players',
          filter: `game_id=eq.${gameId}`,
        },
        async (payload) => {
          // Check if current player was removed
          const updatedPlayer = payload.new as { player_token?: string; status?: string; removed_reason?: string };
          if (playerToken && updatedPlayer.status === 'REMOVED') {
            // Verify it's us by checking token via validate-player
            const { data } = await supabase.functions.invoke('validate-player', {
              body: { gameId, playerToken },
            });
            
            if (!data?.valid) {
              localStorage.removeItem(`${PLAYER_TOKEN_PREFIX}${gameId}`);
              toast.error(data?.error || 'Vous avez été retiré de la partie par le MJ');
              navigate('/');
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const fetchBetHistory = async (gId: string, playerNum: number) => {
    const { data } = await supabase
      .from('round_bets')
      .select('id, manche, mise, created_at')
      .eq('game_id', gId)
      .eq('num_joueur', playerNum)
      .order('manche', { ascending: false });
    
    if (data) {
      setBetHistory(data);
    }
  };

  const handleSubmitBet = async () => {
    if (!game || !player) return;
    
    const miseValue = parseInt(mise, 10);
    if (isNaN(miseValue) || miseValue < 0) {
      toast.error('La mise doit être un nombre positif ou nul');
      return;
    }

    setSubmittingBet(true);
    try {
      // Upsert: dernière soumission fait foi
      const { error: upsertError } = await supabase
        .from('round_bets')
        .upsert(
          {
            game_id: game.id,
            manche: game.manche_active,
            num_joueur: player.playerNumber,
            mise: miseValue,
          },
          { onConflict: 'game_id,manche,num_joueur' }
        );

      if (upsertError) {
        // If upsert fails, try insert (in case no unique constraint exists)
        const { error: insertError } = await supabase
          .from('round_bets')
          .insert({
            game_id: game.id,
            manche: game.manche_active,
            num_joueur: player.playerNumber,
            mise: miseValue,
          });
        
        if (insertError) throw insertError;
      }

      toast.success('Mise enregistrée !');
      fetchBetHistory(game.id, player.playerNumber);
    } catch (err) {
      console.error('Bet error:', err);
      toast.error('Erreur lors de l\'enregistrement de la mise');
    } finally {
      setSubmittingBet(false);
    }
  };

  const handleLeave = async () => {
    if (!gameId) return;
    
    // Send leave presence update
    await presenceLeave();
    
    // Remove token and navigate
    localStorage.removeItem(`${PLAYER_TOKEN_PREFIX}${gameId}`);
    toast.info('Vous avez quitté la partie');
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-destructive">{error}</p>
        <ForestButton onClick={() => navigate('/')}>
          Retour à l'accueil
        </ForestButton>
      </div>
    );
  }

  if (!game || !player) {
    return null;
  }

  return (
    <div className="min-h-screen px-4 py-6">
      <header className="text-center mb-8">
        <Link to="/" className="inline-flex items-center justify-center w-16 h-16 mb-4 animate-float">
          <img src={logoNdogmoabeng} alt="Ndogmoabeng" className="w-full h-full object-contain" />
        </Link>
        <h1 className="font-display text-xl text-glow mb-2">{game.name}</h1>
        <GameStatusBadge status={game.status} />
      </header>

      <main className="max-w-md mx-auto space-y-6">
        {/* Player card */}
        <div className="card-gradient rounded-lg border border-primary/30 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-display text-lg">{player.displayName}</p>
              <p className="text-sm text-muted-foreground">
                Joueur #{player.playerNumber}
              </p>
            </div>
          </div>
        </div>

        {game.status === 'LOBBY' && (
          <div className="card-gradient rounded-lg border border-border p-6 text-center">
            <Clock className="h-8 w-8 text-primary mx-auto mb-3 animate-pulse" />
            <h2 className="font-display text-lg mb-2">Salle d'attente</h2>
            <p className="text-muted-foreground text-sm">
              En attente du Maître du Jeu pour démarrer la partie...
            </p>
          </div>
        )}

        {game.status === 'IN_GAME' && (
          <>
            {/* Section Manche Active */}
            <div className="card-gradient rounded-lg border border-forest-gold/30 p-6">
              <h2 className="font-display text-lg text-forest-gold mb-4 flex items-center gap-2">
                <Swords className="h-5 w-5" />
                Manche {game.manche_active}
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Coins className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm">Jetons: <strong>{player.jetons}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  <span className="text-sm">Récompenses: <strong>{player.recompenses}</strong></span>
                </div>
                {player.clan && (
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span className="text-sm">Clan: <strong>{player.clan}</strong></span>
                  </div>
                )}
                {player.mateNum && (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    <span className="text-sm">Partenaire: <strong>#{player.mateNum}</strong></span>
                  </div>
                )}
              </div>
            </div>

            {/* Section Phase 1 — Mise */}
            <div className="card-gradient rounded-lg border border-primary/30 p-6">
              <h2 className="font-display text-lg mb-4 flex items-center gap-2">
                <Coins className="h-5 w-5 text-primary" />
                Phase 1 — Mise
              </h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="mise" className="text-sm text-muted-foreground mb-2 block">
                    Votre mise pour la manche {game.manche_active}
                  </label>
                  <Input
                    id="mise"
                    type="number"
                    min="0"
                    value={mise}
                    onChange={(e) => setMise(e.target.value)}
                    className="bg-background/50"
                    placeholder="0"
                  />
                </div>
                <ForestButton 
                  onClick={handleSubmitBet} 
                  disabled={submittingBet}
                  className="w-full"
                >
                  {submittingBet ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Valider ma mise
                    </>
                  )}
                </ForestButton>
              </div>

              {/* Historique des mises */}
              <div className="mt-4 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowHistory(!showHistory)}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <History className="h-4 w-4" />
                  Historique de mes mises
                </button>
                {showHistory && betHistory.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {betHistory.map((bet) => (
                      <div 
                        key={bet.id} 
                        className="flex justify-between items-center text-sm p-2 rounded bg-background/30"
                      >
                        <span>Manche {bet.manche}</span>
                        <span className="font-medium">{bet.mise} jetons</span>
                      </div>
                    ))}
                  </div>
                )}
                {showHistory && betHistory.length === 0 && (
                  <p className="mt-3 text-sm text-muted-foreground">Aucune mise enregistrée</p>
                )}
              </div>
            </div>
          </>
        )}

        {game.status === 'ENDED' && (
          <div className="card-gradient rounded-lg border border-muted p-6 text-center">
            <div className="text-4xl mb-3">🏁</div>
            <h2 className="font-display text-lg mb-2">Partie terminée</h2>
            <p className="text-muted-foreground text-sm">
              Merci d'avoir joué !
            </p>
          </div>
        )}

        <PlayerList gameId={game.id} />

        <div className="pt-4">
          <button
            type="button"
            onClick={handleLeave}
            className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-destructive transition-colors p-2"
          >
            <LogOut className="h-4 w-4" />
            Quitter la partie
          </button>
        </div>
      </main>
    </div>
  );
}
