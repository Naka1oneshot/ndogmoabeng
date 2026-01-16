import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { ForestButton } from '@/components/ui/ForestButton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QRCodeDisplay } from '@/components/game/QRCodeDisplay';
import { PlayerManagementList } from '@/components/game/PlayerManagementList';
import { GameStatusBadge } from '@/components/game/GameStatusBadge';
import { AdminBadge } from '@/components/game/AdminBadge';
import { TreePine, Plus, Play, LogOut, Loader2, ShieldAlert, StopCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Game {
  id: string;
  name: string;
  join_code: string;
  status: 'LOBBY' | 'IN_GAME' | 'ENDED';
}

function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export default function MJ() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const [game, setGame] = useState<Game | null>(null);
  const [gameName, setGameName] = useState('');
  const [creating, setCreating] = useState(false);
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  // Redirect non-admins after role is loaded
  useEffect(() => {
    if (!authLoading && !roleLoading && user && !isAdmin) {
      navigate('/login');
    }
  }, [user, authLoading, roleLoading, isAdmin, navigate]);

  useEffect(() => {
    if (user) {
      // Check for existing active game
      const fetchActiveGame = async () => {
        const { data } = await supabase
          .from('games')
          .select('*')
          .eq('host_user_id', user.id)
          .in('status', ['LOBBY', 'IN_GAME'])
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (data) {
          setGame(data as Game);
        }
      };

      fetchActiveGame();
    }
  }, [user]);

  const handleCreateGame = async () => {
    if (!user) return;
    if (!gameName.trim()) {
      toast.error('Veuillez entrer un nom de partie');
      return;
    }

    setCreating(true);
    try {
      const joinCode = generateJoinCode();
      
      const { data, error } = await supabase
        .from('games')
        .insert({
          host_user_id: user.id,
          name: gameName.trim(),
          join_code: joinCode,
          status: 'LOBBY',
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

      setGame(data as Game);
      toast.success('Partie créée !');
    } catch (error) {
      console.error('Error creating game:', error);
      toast.error('Erreur lors de la création de la partie');
    } finally {
      setCreating(false);
    }
  };

  const handleStartGame = async () => {
    if (!game) return;
    
    setStarting(true);
    try {
      const { error } = await supabase
        .from('games')
        .update({ status: 'IN_GAME' })
        .eq('id', game.id);

      if (error) throw error;

      setGame({ ...game, status: 'IN_GAME' });
      toast.success('La partie commence !');
    } catch (error) {
      console.error('Error starting game:', error);
      toast.error('Erreur lors du démarrage');
    } finally {
      setStarting(false);
    }
  };

  const handleEndGame = async () => {
    if (!game) return;
    
    setEnding(true);
    try {
      const { error } = await supabase
        .from('games')
        .update({ status: 'ENDED' })
        .eq('id', game.id);

      if (error) throw error;

      setGame({ ...game, status: 'ENDED' });
      toast.success('Partie terminée');
    } catch (error) {
      console.error('Error ending game:', error);
      toast.error('Erreur lors de la fin de partie');
    } finally {
      setEnding(false);
    }
  };

  const handleNewGame = () => {
    setGame(null);
    setGameName('');
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show access denied if not admin
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <ShieldAlert className="h-16 w-16 text-destructive" />
        <h1 className="font-display text-xl text-center">Accès refusé</h1>
        <p className="text-muted-foreground text-center">
          Seuls les administrateurs peuvent accéder à cette page.
        </p>
        <ForestButton onClick={() => navigate('/login')}>
          Retour à la connexion
        </ForestButton>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-6">
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <TreePine className="h-6 w-6 text-primary" />
          <h1 className="font-display text-xl">Tableau MJ</h1>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <AdminBadge email={user?.email} />
          <ForestButton variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Déconnexion</span>
          </ForestButton>
        </div>
      </header>

      <main className="max-w-2xl mx-auto space-y-6">
        {!game ? (
          <div className="card-gradient rounded-lg border border-border p-6 space-y-4">
            <h2 className="font-display text-xl text-center mb-4">Créer une nouvelle partie</h2>
            
            <div className="space-y-2">
              <Label htmlFor="gameName">Nom de la partie</Label>
              <Input
                id="gameName"
                placeholder="Ex: La Quête du Cristal"
                value={gameName}
                onChange={(e) => setGameName(e.target.value)}
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
        ) : (
          <>
            <div className="card-gradient rounded-lg border border-border p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-xl">{game.name}</h2>
                <GameStatusBadge status={game.status} />
              </div>
              
              {game.status === 'LOBBY' && (
                <ForestButton 
                  className="w-full" 
                  onClick={handleStartGame}
                  disabled={starting}
                >
                  {starting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Play className="h-5 w-5" />
                      Démarrer la partie
                    </>
                  )}
                </ForestButton>
              )}

              {game.status === 'IN_GAME' && (
                <div className="space-y-3">
                  <p className="text-center text-forest-gold font-medium">
                    🎮 Partie en cours...
                  </p>
                  <ForestButton 
                    variant="outline"
                    className="w-full border-destructive/50 text-destructive hover:bg-destructive/10" 
                    onClick={handleEndGame}
                    disabled={ending}
                  >
                    {ending ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <StopCircle className="h-5 w-5" />
                        Terminer la partie
                      </>
                    )}
                  </ForestButton>
                </div>
              )}

              {game.status === 'ENDED' && (
                <div className="space-y-3">
                  <p className="text-center text-muted-foreground font-medium">
                    🏁 Partie terminée
                  </p>
                  <ForestButton 
                    className="w-full" 
                    onClick={handleNewGame}
                  >
                    <Plus className="h-5 w-5" />
                    Nouvelle partie
                  </ForestButton>
                </div>
              )}
            </div>

            {game.status === 'LOBBY' && (
              <QRCodeDisplay joinCode={game.join_code} />
            )}

            <PlayerManagementList gameId={game.id} />
          </>
        )}
      </main>
    </div>
  );
}
