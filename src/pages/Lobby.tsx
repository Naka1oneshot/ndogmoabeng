import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { PlayerList } from '@/components/game/PlayerList';
import { GameStatusBadge } from '@/components/game/GameStatusBadge';
import { Loader2, Clock } from 'lucide-react';
import logoNdogmoabeng from '@/assets/logo-ndogmoabeng.png';

interface Game {
  id: string;
  name: string;
  join_code: string;
  status: 'LOBBY' | 'IN_GAME' | 'ENDED';
}

export default function Lobby() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const gameId = searchParams.get('game');

  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!gameId || !user) return;

    const fetchGame = async () => {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

      if (error || !data) {
        navigate('/join');
        return;
      }

      setGame(data as Game);
      setLoading(false);
    };

    fetchGame();

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
    <div className="min-h-screen px-4 py-6">
      <header className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 mb-4 animate-float">
          <img src={logoNdogmoabeng} alt="Ndogmoabeng" className="w-full h-full object-contain" />
        </div>
        <h1 className="font-display text-xl text-glow mb-2">{game.name}</h1>
        <GameStatusBadge status={game.status} />
      </header>

      <main className="max-w-md mx-auto space-y-6">
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

        <PlayerList gameId={game.id} />
      </main>
    </div>
  );
}
