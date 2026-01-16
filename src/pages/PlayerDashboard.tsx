import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { PlayerList } from '@/components/game/PlayerList';
import { GameStatusBadge } from '@/components/game/GameStatusBadge';
import { usePlayerPresence } from '@/hooks/usePlayerPresence';
import { TreePine, Loader2, Clock, User, LogOut } from 'lucide-react';
import { ForestButton } from '@/components/ui/ForestButton';
import { toast } from 'sonner';

interface Game {
  id: string;
  name: string;
  status: 'LOBBY' | 'IN_GAME' | 'ENDED';
  join_code: string;
}

interface Player {
  id: string;
  displayName: string;
  playerNumber: number;
}

const PLAYER_TOKEN_PREFIX = 'ndogmoabeng_player_';

export default function PlayerDashboard() {
  const navigate = useNavigate();
  const { gameId } = useParams<{ gameId: string }>();

  const [game, setGame] = useState<Game | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
      });

      setGame(data.game as Game);
      setLoading(false);

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
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/20 mb-4 animate-float">
          <TreePine className="h-6 w-6 text-primary" />
        </div>
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
          <div className="card-gradient rounded-lg border border-forest-gold/30 p-6 text-center animate-pulse-glow">
            <div className="text-4xl mb-3">🎮</div>
            <h2 className="font-display text-lg text-forest-gold mb-2">La partie a commencé !</h2>
            <p className="text-muted-foreground text-sm">
              Préparez-vous à explorer la forêt mystique...
            </p>
          </div>
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
