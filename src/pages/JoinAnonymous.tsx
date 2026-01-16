import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ForestButton } from '@/components/ui/ForestButton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TreePine, User, AlertCircle, Loader2, Smartphone } from 'lucide-react';
import { toast } from 'sonner';

interface Game {
  id: string;
  name: string;
  status: string;
}

const PLAYER_TOKEN_PREFIX = 'ndogmoabeng_player_';

export default function JoinAnonymous() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();

  const [displayName, setDisplayName] = useState('');
  const [game, setGame] = useState<Game | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (code) {
      checkGame(code);
    } else {
      setError('Code de partie manquant');
      setLoading(false);
    }
  }, [code]);

  const checkGame = async (joinCode: string) => {
    setLoading(true);
    setError('');

    try {
      const { data, error: fetchError } = await supabase
        .from('games')
        .select('id, name, status')
        .eq('join_code', joinCode.toUpperCase())
        .single();

      if (fetchError || !data) {
        setError('Partie introuvable');
        setLoading(false);
        return;
      }

      if (data.status !== 'LOBBY') {
        setError('Cette partie a déjà commencé');
        setLoading(false);
        return;
      }

      setGame(data as Game);

      // Check if we already have a token for this game
      const existingToken = localStorage.getItem(`${PLAYER_TOKEN_PREFIX}${data.id}`);
      if (existingToken) {
        // Validate the token
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
    } catch {
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
      const { data, error: joinError } = await supabase.functions.invoke('join-game', {
        body: { joinCode: code, displayName: displayName.trim() },
      });

      if (joinError || !data?.success) {
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

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/20 mb-4 animate-float">
            <TreePine className="h-8 w-8 text-primary" />
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

          {game && (
            <>
              <div className="text-center p-4 bg-secondary/50 rounded-md">
                <p className="text-sm text-muted-foreground mb-1">Partie</p>
                <p className="font-display text-lg">{game.name}</p>
              </div>

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

          {!game && !error && (
            <p className="text-center text-muted-foreground">
              Recherche de la partie...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
