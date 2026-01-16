import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ForestButton } from '@/components/ui/ForestButton';
import { User, RefreshCw, Loader2, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface Player {
  id: string;
  display_name: string;
  player_number: number | null;
  is_host: boolean;
  player_token: string | null;
}

interface PlayerManagementListProps {
  gameId: string;
}

export function PlayerManagementList({ gameId }: PlayerManagementListProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchPlayers();

    const channel = supabase
      .channel(`mj-players-${gameId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_players',
          filter: `game_id=eq.${gameId}`,
        },
        () => {
          fetchPlayers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  const fetchPlayers = async () => {
    const { data, error } = await supabase
      .from('game_players')
      .select('id, display_name, player_number, is_host, player_token')
      .eq('game_id', gameId)
      .order('player_number', { ascending: true, nullsFirst: false });

    if (!error && data) {
      setPlayers(data);
    }
    setLoading(false);
  };

  const handleResetToken = async (playerId: string, playerName: string) => {
    setResettingId(playerId);
    try {
      const { data, error } = await supabase.functions.invoke('reset-player-token', {
        body: { playerId },
      });

      if (error || !data?.success) {
        toast.error(data?.error || 'Erreur lors de la réinitialisation');
        return;
      }

      toast.success(`Token de ${playerName} réinitialisé`);
      fetchPlayers();
    } catch (err) {
      console.error('Reset error:', err);
      toast.error('Erreur lors de la réinitialisation');
    } finally {
      setResettingId(null);
    }
  };

  const handleCopyJoinLink = async (playerId: string, token: string) => {
    const joinUrl = `${window.location.origin}/player/${gameId}?token=${token}`;
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopiedId(playerId);
      toast.success('Lien copié !');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Erreur lors de la copie');
    }
  };

  if (loading) {
    return (
      <div className="card-gradient rounded-lg border border-border p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const anonymousPlayers = players.filter(p => !p.is_host && p.player_token);

  return (
    <div className="card-gradient rounded-lg border border-border p-6">
      <h3 className="font-display text-lg mb-4 flex items-center gap-2">
        <User className="h-5 w-5 text-primary" />
        Gestion des joueurs ({anonymousPlayers.length})
      </h3>

      {anonymousPlayers.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-4">
          Aucun joueur n'a encore rejoint la partie
        </p>
      ) : (
        <div className="space-y-3">
          {anonymousPlayers.map((player) => (
            <div
              key={player.id}
              className="flex items-center justify-between gap-3 p-3 rounded-md bg-secondary/50"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-medium text-primary">
                    {player.player_number || '?'}
                  </span>
                </div>
                <span className="font-medium truncate">{player.display_name}</span>
              </div>
              
              <div className="flex items-center gap-2 flex-shrink-0">
                {player.player_token && (
                  <ForestButton
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyJoinLink(player.id, player.player_token!)}
                    title="Copier le lien de reconnexion"
                  >
                    {copiedId === player.id ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </ForestButton>
                )}
                <ForestButton
                  variant="ghost"
                  size="sm"
                  onClick={() => handleResetToken(player.id, player.display_name)}
                  disabled={resettingId === player.id}
                  title="Réinitialiser le token (si le joueur a changé de téléphone)"
                >
                  {resettingId === player.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </ForestButton>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
