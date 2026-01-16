import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ForestButton } from '@/components/ui/ForestButton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, AlertCircle, Loader2, Smartphone, Users, Ban } from 'lucide-react';
import { toast } from 'sonner';
import { getDeviceId } from '@/hooks/useDeviceId';
import logoNdogmoabeng from '@/assets/logo-ndogmoabeng.png';

interface Game {
  id: string;
  name: string;
  status: string;
  x_nb_joueurs: number;
}

const PLAYER_TOKEN_PREFIX = 'ndogmoabeng_player_';

export default function JoinAnonymous() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();

  const [displayName, setDisplayName] = useState('');
  const [clan, setClan] = useState<string>('none');
  const [game, setGame] = useState<Game | null>(null);
  const [error, setError] = useState('');
  const [banReason, setBanReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);

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
        .select('id, name, status, x_nb_joueurs')
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

      // Allow LOBBY and IN_ROUND status
      if (data.status !== 'LOBBY' && data.status !== 'IN_ROUND') {
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

      // Check if we already have a token for this game
      const existingToken = localStorage.getItem(`${PLAYER_TOKEN_PREFIX}${data.id}`);
      if (existingToken) {
        const { data: validation } = await supabase.functions.invoke('validate-player', {
          body: { gameId: data.id, playerToken: existingToken },
        });

        if (validation?.valid) {
          navigate(`/player/${data.id}`);
          return;
        } else {
          localStorage.removeItem(`${PLAYER_TOKEN_PREFIX}${data.id}`);
        }
      }
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
      
      const { data, error: joinError } = await supabase.functions.invoke('join-game', {
        body: { 
          joinCode: code, 
          displayName: displayName.trim(),
          clan: clan !== 'none' ? clan : null,
          deviceId,
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
        toast.error(data?.error || 'Erreur lors de la connexion');
        return;
      }

      // Store the player token
      localStorage.setItem(`${PLAYER_TOKEN_PREFIX}${data.gameId}`, data.playerToken);

      toast.success(`Bienvenue ${displayName}! Vous êtes le joueur #${data.playerNumber}`);
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
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 mb-4 animate-float">
            <img src={logoNdogmoabeng} alt="Ndogmoabeng" className="w-full h-full object-contain" />
          </div>
          <h1 className="font-display text-2xl text-glow mb-2">
            La Forêt de Ndogmoabeng
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
              <div className="text-center p-4 bg-secondary/50 rounded-md">
                <p className="text-sm text-muted-foreground mb-1">Partie</p>
                <p className="font-display text-lg">{game.name}</p>
                <div className="flex items-center justify-center gap-2 mt-2 text-sm text-muted-foreground">
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
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="clan">Clan (optionnel)</Label>
                    <Select value={clan} onValueChange={setClan}>
                      <SelectTrigger id="clan">
                        <SelectValue placeholder="Choisir un clan" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucun clan</SelectItem>
                        <SelectItem value="Akila">🌙 Akila</SelectItem>
                        <SelectItem value="Akandé">☀️ Akandé</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

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
