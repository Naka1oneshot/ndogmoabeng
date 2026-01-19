import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { GameStatusBadge } from '@/components/game/GameStatusBadge';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import LobbyLayout from '@/components/lobby/LobbyLayout';
import { Loader2, Clock } from 'lucide-react';
import logoNdogmoabeng from '@/assets/logo-ndogmoabeng.png';

interface Game {
  id: string;
  name: string;
  join_code: string;
  status: 'LOBBY' | 'IN_GAME' | 'ENDED';
}

interface PlayerInfo {
  player_number: number;
  display_name: string;
}

export default function Lobby() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const gameId = searchParams.get('game');

  const [game, setGame] = useState<Game | null>(null);
  const [playerInfo, setPlayerInfo] = useState<PlayerInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!gameId || !user) return;

    const fetchGameAndPlayer = async () => {
      // Fetch game
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

      if (gameError || !gameData) {
        navigate('/join');
        return;
      }

      setGame(gameData as Game);

      // Fetch current player info
      const { data: playerData } = await supabase
        .from('game_players')
        .select('player_number, display_name')
        .eq('game_id', gameId)
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE')
        .maybeSingle();

      if (playerData) {
        setPlayerInfo({
          player_number: playerData.player_number ?? 0,
          display_name: playerData.display_name
        });
      }

      setLoading(false);
    };

    fetchGameAndPlayer();

    // Subscribe to game status changes
    const channel = supabase
      .channel(`game-${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          setGame(payload.new as Game);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, user, navigate]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!game) {
    return null;
  }

  return (
    <div className="min-h-screen px-4 py-6 relative">
      {/* Theme toggle in top-right corner */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      
      <header className="text-center mb-8">
        <Link to="/" className="inline-flex items-center justify-center w-16 h-16 mb-4 animate-float">
          <img src={logoNdogmoabeng} alt="Ndogmoabeng" className="w-full h-full object-contain" />
        </Link>
        <h1 className="font-display text-xl text-glow mb-2">{game.name}</h1>
        <GameStatusBadge status={game.status} />
      </header>

      <main className="max-w-3xl mx-auto space-y-6">
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
          <div className="card-gradient rounded-lg border border-border border-forest-gold/30 p-6 text-center animate-pulse-glow">
            <div className="text-4xl mb-3">🎮</div>
            <h2 className="font-display text-lg text-forest-gold mb-2">La partie a commencé !</h2>
            <p className="text-muted-foreground text-sm">
              Préparez-vous à explorer la forêt mystique...
            </p>
          </div>
        )}

        {/* Lobby Layout with Players + Chat */}
        {playerInfo && (
          <LobbyLayout 
            gameId={game.id}
            playerNum={playerInfo.player_number}
            playerName={playerInfo.display_name}
          />
        )}
      </main>
    </div>
  );
}
