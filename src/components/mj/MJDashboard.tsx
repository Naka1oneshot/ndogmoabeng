import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ForestButton } from '@/components/ui/ForestButton';
import { QRCodeDisplay } from '@/components/game/QRCodeDisplay';
import { GameStatusBadge } from '@/components/game/GameStatusBadge';
import { MJPlayersTab } from './MJPlayersTab';
import { MJBetsTab } from './MJBetsTab';
import { MJPhase2Tab } from './MJPhase2Tab';
import { MJInventoryTab } from './MJInventoryTab';
import { MJCombatTab } from './MJCombatTab';
import { MJEventsTab } from './MJEventsTab';
import { MJMonstersConfigTab } from './MJMonstersConfigTab';
import { MJItemsShopTab } from './MJItemsShopTab';
import { MJShopPhaseTab } from './MJShopPhaseTab';
import { 
  ChevronLeft, Loader2, Users, 
  MessageSquare, Copy, Check, Edit2, X, Save, Coins, Package,
  Bug, Store, Swords, Target, SkipForward, Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Game {
  id: string;
  name: string;
  join_code: string;
  status: string;
  manche_active: number;
  phase: string;
  phase_locked: boolean;
  starting_tokens: number;
  x_nb_joueurs: number;
  sens_depart_egalite: string;
  created_at: string;
}

interface MJDashboardProps {
  game: Game;
  onBack: () => void;
}

export function MJDashboard({ game: initialGame, onBack }: MJDashboardProps) {
  const { user } = useAuth();
  const [game, setGame] = useState<Game>(initialGame);
  const [copied, setCopied] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editedName, setEditedName] = useState(game.name);
  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const channel = supabase
      .channel(`mj-dashboard-${game.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${game.id}` },
        (payload) => {
          setGame(prev => ({ ...prev, ...payload.new }));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'games', filter: `id=eq.${game.id}` },
        () => {
          toast.info('La partie a été supprimée');
          onBack();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [game.id, onBack]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(game.join_code);
      setCopied(true);
      toast.success('Code copié !');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Erreur lors de la copie');
    }
  };

  const handleUpdateName = async () => {
    if (!editedName.trim()) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('games')
        .update({ name: editedName.trim() })
        .eq('id', game.id);

      if (error) throw error;

      setGame(prev => ({ ...prev, name: editedName.trim() }));
      setEditingName(false);
      toast.success('Nom modifié');
    } catch (error) {
      console.error('Error updating name:', error);
      toast.error('Erreur lors de la modification');
    } finally {
      setSaving(false);
    }
  };

  const fetchGame = async () => {
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('id', game.id)
      .single();

    if (data && !error) {
      setGame(data);
    } else if (error) {
      // Game was deleted
      onBack();
    }
  };

  const handleNextRound = async () => {
    const nextManche = game.manche_active + 1;
    try {
      const { error } = await supabase
        .from('games')
        .update({ 
          manche_active: nextManche, 
          phase: 'PHASE1_MISES',
          phase_locked: false
        })
        .eq('id', game.id);

      if (error) throw error;

      // Log the round change
      await supabase.from('logs_mj').insert({
        game_id: game.id,
        manche: nextManche,
        action: 'NOUVELLE_MANCHE',
        details: `Passage manuel à la manche ${nextManche}`,
      });

      await supabase.from('logs_joueurs').insert({
        game_id: game.id,
        manche: nextManche,
        type: 'PHASE',
        message: `🔄 Nouvelle manche ${nextManche} - Phase 1 : Mises`,
      });

      await supabase.from('session_events').insert({
        game_id: game.id,
        type: 'ROUND_CHANGE',
        audience: 'ALL',
        message: `Nouvelle manche ${nextManche}`,
        payload: { manche: nextManche, phase: 'PHASE1_MISES' },
      });

      toast.success(`Passage à la manche ${nextManche}`);
    } catch (error) {
      console.error('Error advancing round:', error);
      toast.error('Erreur lors du passage à la manche suivante');
    }
  };

  const handleDeleteGame = async () => {
    setDeleting(true);
    try {
      const tablesToClear = [
        'session_events',
        'session_bans',
        'pending_effects',
        'positions_finales',
        'round_bets',
        'actions',
        'inventory',
        'logs_joueurs',
        'logs_mj',
        'battlefield',
        'monsters',
        'combat_config',
        'shop_catalogue',
        'game_state_monsters',
        'game_monsters',
        'priority_rankings',
        'game_shop_offers',
        'shop_requests',
        'game_item_purchases',
        'game_events',
        'game_players',
      ];

      for (const table of tablesToClear) {
        await (supabase.from(table as any).delete().eq('game_id', game.id));
      }

      const { error } = await supabase
        .from('games')
        .delete()
        .eq('id', game.id);

      if (error) throw error;

      toast.success('Partie supprimée');
      onBack();
    } catch (error) {
      console.error('Error deleting game:', error);
      toast.error('Erreur lors de la suppression');
    } finally {
      setDeleting(false);
    }
  };

  const joinUrl = `${window.location.origin}/join/${game.join_code}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ForestButton variant="ghost" size="sm" onClick={onBack}>
            <ChevronLeft className="h-4 w-4" />
          </ForestButton>
          
          {editingName ? (
            <div className="flex items-center gap-2">
              <Input
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="h-8 w-48"
                autoFocus
              />
              <ForestButton size="sm" onClick={handleUpdateName} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              </ForestButton>
              <ForestButton variant="ghost" size="sm" onClick={() => setEditingName(false)}>
                <X className="h-4 w-4" />
              </ForestButton>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h2 className="font-display text-xl">{game.name}</h2>
              <ForestButton variant="ghost" size="sm" onClick={() => setEditingName(true)}>
                <Edit2 className="h-4 w-4" />
              </ForestButton>
            </div>
          )}
          
          <GameStatusBadge status={game.status} />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-lg">
            <span className="text-sm text-muted-foreground">Code:</span>
            <span className="font-mono text-lg font-bold text-primary">{game.join_code}</span>
            <ForestButton variant="ghost" size="sm" onClick={handleCopyCode}>
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </ForestButton>
          </div>
        </div>
      </div>

      {/* Game info bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
        <div className="p-3 bg-secondary/50 rounded-lg text-center">
          <div className="text-muted-foreground">Manche</div>
          <div className="font-bold text-lg">{game.manche_active}</div>
        </div>
        <div className="p-3 bg-secondary/50 rounded-lg text-center">
          <div className="text-muted-foreground">Phase</div>
          <div className="font-bold text-sm">{game.phase.replace('PHASE', 'P').replace('_', ' ')}</div>
        </div>
        <div className="p-3 bg-secondary/50 rounded-lg text-center">
          <div className="text-muted-foreground">Verrouillée</div>
          <div className="font-bold">{game.phase_locked ? 'Oui' : 'Non'}</div>
        </div>
        <div className="p-3 bg-secondary/50 rounded-lg text-center">
          <div className="text-muted-foreground">Jetons départ</div>
          <div className="font-bold">{game.starting_tokens}</div>
        </div>
        <div className="p-3 bg-secondary/50 rounded-lg text-center">
          <div className="text-muted-foreground">Max joueurs</div>
          <div className="font-bold">{game.x_nb_joueurs || '∞'}</div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <ForestButton 
          size="sm" 
          onClick={handleNextRound}
          className="bg-amber-600 hover:bg-amber-700"
        >
          <SkipForward className="h-4 w-4 mr-1" />
          Manche suivante
        </ForestButton>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <ForestButton
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1" />
              )}
              Supprimer la partie
            </ForestButton>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer la partie ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action est irréversible. Toutes les données de la partie
                "{game.name}" seront définitivement supprimées.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleDeleteGame}
              >
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      {/* QR Code (collapsible on mobile) */}
      {game.status === 'LOBBY' && (
        <details className="card-gradient rounded-lg border border-border p-4">
          <summary className="cursor-pointer font-medium flex items-center gap-2">
            📱 QR Code pour rejoindre
          </summary>
          <div className="mt-4 flex justify-center">
            <QRCodeDisplay joinCode={game.join_code} />
          </div>
        </details>
      )}

      {/* Tabs */}
      <Tabs defaultValue="players" className="w-full">
        <TabsList className="grid w-full grid-cols-4 md:grid-cols-8">
          <TabsTrigger value="players" className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span className="hidden md:inline">Joueurs</span>
          </TabsTrigger>
          <TabsTrigger value="bets" className="flex items-center gap-1">
            <Coins className="h-4 w-4" />
            <span className="hidden md:inline">Phase 1</span>
          </TabsTrigger>
          <TabsTrigger value="phase2" className="flex items-center gap-1">
            <Target className="h-4 w-4" />
            <span className="hidden md:inline">Phase 2</span>
          </TabsTrigger>
          <TabsTrigger value="shop" className="flex items-center gap-1">
            <Store className="h-4 w-4" />
            <span className="hidden md:inline">Phase 3</span>
          </TabsTrigger>
          <TabsTrigger value="monsters" className="flex items-center gap-1">
            <Bug className="h-4 w-4" />
            <span className="hidden md:inline">Monstres</span>
          </TabsTrigger>
          <TabsTrigger value="inventory" className="flex items-center gap-1">
            <Package className="h-4 w-4" />
            <span className="hidden md:inline">Inventaires</span>
          </TabsTrigger>
          <TabsTrigger value="combat" className="flex items-center gap-1">
            <Swords className="h-4 w-4" />
            <span className="hidden md:inline">Combat</span>
          </TabsTrigger>
          <TabsTrigger value="events" className="flex items-center gap-1">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden md:inline">Events</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="players" className="mt-6">
          <MJPlayersTab game={game} onGameUpdate={fetchGame} />
        </TabsContent>

        <TabsContent value="bets" className="mt-6">
          <MJBetsTab game={game} onGameUpdate={fetchGame} />
        </TabsContent>

        <TabsContent value="phase2" className="mt-6">
          <MJPhase2Tab game={game} onGameUpdate={fetchGame} />
        </TabsContent>

        <TabsContent value="shop" className="mt-6">
          <div className="space-y-6">
            <MJShopPhaseTab game={game} />
            <hr className="border-border" />
            <MJItemsShopTab game={game} />
          </div>
        </TabsContent>

        <TabsContent value="monsters" className="mt-6">
          <MJMonstersConfigTab game={game} />
        </TabsContent>

        <TabsContent value="inventory" className="mt-6">
          <MJInventoryTab game={game} />
        </TabsContent>

        <TabsContent value="combat" className="mt-6">
          <MJCombatTab game={game} />
        </TabsContent>

        <TabsContent value="events" className="mt-6">
          <MJEventsTab game={game} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
