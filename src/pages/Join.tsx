import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { ForestButton } from '@/components/ui/ForestButton';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import logoNdogmoabeng from '@/assets/logo-ndogmoabeng.png';

interface Game {
  id: string;
  name: string;
  join_code: string;
  status: 'LOBBY' | 'IN_GAME' | 'ENDED';
}

export default function Join() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const codeFromUrl = searchParams.get('code') || '';

  const [code, setCode] = useState(codeFromUrl);
  const [displayName, setDisplayName] = useState('');
  const [game, setGame] = useState<Game | null>(null);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(!!codeFromUrl);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate(`/auth?redirect=/join?code=${code}`);
    }
  }, [user, authLoading, navigate, code]);

  useEffect(() => {
    if (codeFromUrl && user) {
      checkGame(codeFromUrl);
    }
  }, [codeFromUrl, user]);

  const checkGame = async (joinCode: string) => {
    setChecking(true);
    setError('');
    setGame(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('games')
        .select('*')
        .eq('join_code', joinCode.toUpperCase())
        .single();

      if (fetchError || !data) {
        setError('Partie introuvable');
        return;
      }

      if (data.status !== 'LOBBY') {
        setError('Cette partie a déjà commencé');
        return;
      }

      setGame(data as Game);
    } catch {
      setError('Erreur lors de la recherche');
    } finally {
      setChecking(false);
    }
  };

  const handleCheckCode = () => {
    if (code.trim().length >= 6) {
      checkGame(code.trim());
    } else {
      setError('Code invalide');
    }
  };

  const handleJoin = async () => {
    if (!game || !user || !displayName.trim()) {
      toast.error('Veuillez entrer un pseudo');
      return;
    }

    setJoining(true);
    try {
      // Check if already joined
      const { data: existing } = await supabase
        .from('game_players')
        .select('id')
        .eq('game_id', game.id)
        .eq('user_id', user.id)
        .single();

      if (existing) {
        navigate(`/lobby?game=${game.id}`);
        return;
      }

      const { error: insertError } = await supabase
        .from('game_players')
        .insert({
          game_id: game.id,
          user_id: user.id,
          display_name: displayName.trim(),
          is_host: false,
        });

      if (insertError) {
        if (insertError.code === '23505') {
          toast.info('Vous avez déjà rejoint cette partie');
        } else {
          throw insertError;
        }
      }

      navigate(`/lobby?game=${game.id}`);
    } catch (error) {
      console.error('Error joining game:', error);
      toast.error('Erreur lors de la connexion');
    } finally {
      setJoining(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative">
      {/* Theme toggle in top-right corner */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 mb-4 animate-float">
            <img src={logoNdogmoabeng} alt="Ndogmoabeng" className="w-full h-full object-contain" />
          </div>
          <h1 className="font-display text-2xl text-glow mb-2">
            Rejoindre une partie
          </h1>
          <p className="text-muted-foreground">
            Entrez le code fourni par le Maître du Jeu
          </p>
        </div>

        <div className="card-gradient rounded-lg border border-border p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive border border-destructive/20">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {!game ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="code">Code de la partie</Label>
                <Input
                  id="code"
                  placeholder="XXXXXX"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="text-center text-2xl tracking-widest font-display"
                />
              </div>

              <ForestButton 
                className="w-full" 
                onClick={handleCheckCode}
                disabled={checking || code.length < 6}
              >
                {checking ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  'Vérifier le code'
                )}
              </ForestButton>
            </>
          ) : (
            <>
              <div className="text-center p-4 bg-secondary/50 rounded-md">
                <p className="text-sm text-muted-foreground mb-1">Partie trouvée</p>
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

              <button
                type="button"
                onClick={() => {
                  setGame(null);
                  setCode('');
                  setError('');
                }}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Changer de code
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
