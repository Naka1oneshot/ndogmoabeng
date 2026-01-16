import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { ForestButton } from '@/components/ui/ForestButton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { QRCodeDisplay } from '@/components/game/QRCodeDisplay';
import { PlayerManagementList } from '@/components/game/PlayerManagementList';
import { GameStatusBadge } from '@/components/game/GameStatusBadge';
import { AdminBadge } from '@/components/game/AdminBadge';
import { TreePine, Plus, Play, LogOut, Loader2, ShieldAlert, StopCircle, Settings, RotateCcw, Lock } from 'lucide-react';
import { toast } from 'sonner';

interface Game {
  id: string;
  name: string;
  join_code: string;
  status: string;
  manche_active: number;
  sens_depart_egalite: string;
  x_nb_joueurs: number;
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
  const [xNbJoueurs, setXNbJoueurs] = useState(6);
  const [sensEgalite, setSensEgalite] = useState<'ASC' | 'DESC'>('ASC');
  const [creating, setCreating] = useState(false);
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [resettingManche, setResettingManche] = useState(false);
  const [lockingJoins, setLockingJoins] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!authLoading && !roleLoading && user && !isAdmin) {
      navigate('/login');
    }
  }, [user, authLoading, roleLoading, isAdmin, navigate]);

  useEffect(() => {
    if (user) {
      fetchActiveGame();
    }
  }, [user]);

  const fetchActiveGame = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('games')
      .select('*')
      .eq('host_user_id', user.id)
      .neq('status', 'FINISHED')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setGame(data as Game);
    }
  };

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
          manche_active: 1,
          sens_depart_egalite: sensEgalite,
          x_nb_joueurs: xNbJoueurs,
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
        .update({ status: 'IN_ROUND' })
        .eq('id', game.id);

      if (error) throw error;

      setGame({ ...game, status: 'IN_ROUND' });
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
        .update({ status: 'FINISHED' })
        .eq('id', game.id);

      if (error) throw error;

      setGame({ ...game, status: 'FINISHED' });
      toast.success('Partie terminée');
    } catch (error) {
      console.error('Error ending game:', error);
      toast.error('Erreur lors de la fin de partie');
    } finally {
      setEnding(false);
    }
  };

  const handleResetManche = async () => {
    if (!game) return;
    
    setResettingManche(true);
    try {
      const { error } = await supabase
        .from('games')
        .update({ manche_active: 1 })
        .eq('id', game.id);

      if (error) throw error;

      setGame({ ...game, manche_active: 1 });
      toast.success('Manche réinitialisée à 1');
    } catch (error) {
      console.error('Error resetting manche:', error);
      toast.error('Erreur lors de la réinitialisation');
    } finally {
      setResettingManche(false);
    }
  };

  const handleLockJoins = async () => {
    if (!game) return;
    
    setLockingJoins(true);
    try {
      // Update status to prevent new joins (we'll use IN_ROUND status)
      const { error } = await supabase
        .from('games')
        .update({ status: 'IN_ROUND' })
        .eq('id', game.id);

      if (error) throw error;

      setGame({ ...game, status: 'IN_ROUND' });
      toast.success('Liste des joueurs verrouillée');
    } catch (error) {
      console.error('Error locking joins:', error);
      toast.error('Erreur lors du verrouillage');
    } finally {
      setLockingJoins(false);
    }
  };

  const handleNewGame = () => {
    setGame(null);
    setGameName('');
    setXNbJoueurs(6);
    setSensEgalite('ASC');
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

  const isLobby = game?.status === 'LOBBY';
  const isInGame = game?.status === 'IN_ROUND' || game?.status === 'RESOLVING_COMBAT' || game?.status === 'RESOLVING_SHOP';
  const isFinished = game?.status === 'FINISHED';

  return (
    <div className="min-h-screen px-4 py-6">
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 max-w-3xl mx-auto">
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

      <main className="max-w-3xl mx-auto space-y-6">
        {!game ? (
          // BLOC: Créer une partie
          <div className="card-gradient rounded-lg border border-border p-6 space-y-4">
            <h2 className="font-display text-xl text-center mb-4">🌲 Créer une nouvelle partie</h2>
            
            <div className="space-y-2">
              <Label htmlFor="gameName">Nom de la partie</Label>
              <Input
                id="gameName"
                placeholder="Ex: La Quête du Cristal"
                value={gameName}
                onChange={(e) => setGameName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="xNbJoueurs">Nombre de joueurs (X)</Label>
                <Input
                  id="xNbJoueurs"
                  type="number"
                  min={2}
                  max={20}
                  value={xNbJoueurs}
                  onChange={(e) => setXNbJoueurs(parseInt(e.target.value) || 6)}
                />
              </div>

              <div className="space-y-2">
                <Label>Sens départ égalité</Label>
                <Select value={sensEgalite} onValueChange={(val) => setSensEgalite(val as 'ASC' | 'DESC')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ASC">Ascendant (ASC)</SelectItem>
                    <SelectItem value="DESC">Descendant (DESC)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
            {/* BLOC: Info partie + QR */}
            <div className="card-gradient rounded-lg border border-border p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-xl">{game.name}</h2>
                <GameStatusBadge status={game.status} />
              </div>

              <div className="grid grid-cols-3 gap-4 text-center mb-4 text-sm">
                <div className="p-3 rounded-md bg-secondary/50">
                  <div className="text-muted-foreground">Joueurs</div>
                  <div className="text-lg font-bold text-primary">X = {game.x_nb_joueurs}</div>
                </div>
                <div className="p-3 rounded-md bg-secondary/50">
                  <div className="text-muted-foreground">Égalité</div>
                  <div className="text-lg font-bold">{game.sens_depart_egalite}</div>
                </div>
                <div className="p-3 rounded-md bg-secondary/50">
                  <div className="text-muted-foreground">Manche</div>
                  <div className="text-lg font-bold text-forest-gold">{game.manche_active}</div>
                </div>
              </div>
              
              {isLobby && (
                <div className="flex gap-3">
                  <ForestButton 
                    className="flex-1" 
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
                  <ForestButton 
                    variant="outline" 
                    onClick={handleLockJoins}
                    disabled={lockingJoins}
                    title="Verrouiller la liste des joueurs"
                  >
                    {lockingJoins ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Lock className="h-5 w-5" />
                    )}
                  </ForestButton>
                </div>
              )}

              {isInGame && (
                <div className="space-y-3">
                  <p className="text-center text-forest-gold font-medium">
                    🎮 Partie en cours - Manche {game.manche_active}
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

              {isFinished && (
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

            {/* BLOC: QR Code (visible en lobby) */}
            {isLobby && (
              <QRCodeDisplay joinCode={game.join_code} />
            )}

            {/* BLOC: Joueurs */}
            <PlayerManagementList gameId={game.id} isLobby={isLobby} />

            {/* BLOC: Paramètres MJ */}
            <div className="card-gradient rounded-lg border border-border p-6">
              <h3 className="font-display text-lg mb-4 flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                Paramètres
              </h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-md bg-secondary/50">
                  <div>
                    <div className="font-medium">Manche active</div>
                    <div className="text-sm text-muted-foreground">Actuellement : {game.manche_active}</div>
                  </div>
                  <ForestButton 
                    variant="outline" 
                    size="sm"
                    onClick={handleResetManche}
                    disabled={resettingManche}
                  >
                    {resettingManche ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <RotateCcw className="h-4 w-4" />
                        Reset à 1
                      </>
                    )}
                  </ForestButton>
                </div>

                <div className="flex items-center justify-between p-3 rounded-md bg-secondary/50">
                  <div>
                    <div className="font-medium">Code de session</div>
                    <div className="text-sm font-mono text-primary">{game.join_code}</div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
