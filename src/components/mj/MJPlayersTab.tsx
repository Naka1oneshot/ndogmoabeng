import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ForestButton } from '@/components/ui/ForestButton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { KickPlayerModal } from '@/components/game/KickPlayerModal';
import { 
  User, RefreshCw, Loader2, Copy, Check, Pencil, Save, X, 
  Users, UserX, Play, Trash2 
} from 'lucide-react';
import { toast } from 'sonner';
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
} from '@/components/ui/alert-dialog';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Player {
  id: string;
  display_name: string;
  player_number: number | null;
  is_host: boolean;
  player_token: string | null;
  clan: string | null;
  mate_num: number | null;
  jetons: number;
  recompenses: number;
  is_alive: boolean;
  status: string;
  joined_at: string;
  last_seen: string | null;
}

interface Game {
  id: string;
  name: string;
  status: string;
  starting_tokens: number;
}

interface MJPlayersTabProps {
  game: Game;
  onGameUpdate: () => void;
}

export function MJPlayersTab({ game, onGameUpdate }: MJPlayersTabProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Player>>({});
  const [saving, setSaving] = useState(false);
  
  const [kickModalOpen, setKickModalOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<{ id: string; name: string } | null>(null);

  const isLobby = game.status === 'LOBBY';

  useEffect(() => {
    fetchPlayers();

    const channel = supabase
      .channel(`mj-players-tab-${game.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_players',
          filter: `game_id=eq.${game.id}`,
        },
        () => fetchPlayers()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [game.id]);

  const fetchPlayers = async () => {
    const { data, error } = await supabase
      .from('game_players')
      .select('*')
      .eq('game_id', game.id)
      .order('player_number', { ascending: true, nullsFirst: false });

    if (!error && data) {
      setPlayers(data);
    }
    setLoading(false);
  };

  const handleStartGame = async () => {
    setStarting(true);
    try {
      const { data, error } = await supabase.functions.invoke('start-game', {
        body: { gameId: game.id },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || 'Erreur lors du démarrage');
      }

      toast.success(`La partie commence avec ${data.playerCount} joueurs !`);
      onGameUpdate();
    } catch (error: any) {
      console.error('Error starting game:', error);
      toast.error(error.message || 'Erreur lors du démarrage');
    } finally {
      setStarting(false);
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
      onGameUpdate();
    } catch (error) {
      console.error('Error deleting game:', error);
      toast.error('Erreur lors de la suppression');
    } finally {
      setDeleting(false);
    }
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
    const joinUrl = `${window.location.origin}/player/${game.id}?token=${token}`;
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopiedId(playerId);
      toast.success('Lien copié !');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Erreur lors de la copie');
    }
  };

  const startEditing = (player: Player) => {
    setEditingId(player.id);
    setEditForm({
      display_name: player.display_name,
      clan: player.clan || '',
      mate_num: player.mate_num,
      jetons: player.jetons,
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSave = async (playerId: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('game_players')
        .update({
          display_name: editForm.display_name,
          clan: editForm.clan || null,
          mate_num: editForm.mate_num || null,
          jetons: editForm.jetons || 0,
        })
        .eq('id', playerId);

      if (error) throw error;

      toast.success('Joueur mis à jour');
      setEditingId(null);
      setEditForm({});
      fetchPlayers();
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const openKickModal = (playerId: string, playerName: string) => {
    setSelectedPlayer({ id: playerId, name: playerName });
    setKickModalOpen(true);
  };

  // Player presence states:
  // - ONLINE: last_seen within 30s
  // - DISCONNECTED: last_seen > 90s (visible but marked as disconnected)
  // - OFFLINE: last_seen between 30-90s (temporarily offline)
  const getPlayerPresenceState = (lastSeen: string | null): 'online' | 'offline' | 'disconnected' => {
    if (!lastSeen) return 'disconnected';
    const diff = Date.now() - new Date(lastSeen).getTime();
    if (diff < 30000) return 'online'; // 30 seconds
    if (diff < 90000) return 'offline'; // 90 seconds
    return 'disconnected';
  };

  const getPresenceBadge = (lastSeen: string | null) => {
    const state = getPlayerPresenceState(lastSeen);
    switch (state) {
      case 'online':
        return { color: 'bg-green-500', textColor: 'text-green-500', label: 'En ligne' };
      case 'offline':
        return { color: 'bg-yellow-500', textColor: 'text-yellow-500', label: 'Hors ligne' };
      case 'disconnected':
        return { color: 'bg-red-500', textColor: 'text-red-500', label: 'Déconnecté' };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const activePlayers = players.filter(p => !p.is_host && p.status === 'ACTIVE');
  const kickedPlayers = players.filter(p => p.status === 'REMOVED');
  const availablePlayerNumbers = activePlayers.map(p => p.player_number).filter(Boolean) as number[];

  return (
    <div className="space-y-6">
      {/* Actions principales */}
      <div className="flex flex-wrap gap-3">
        {isLobby && (
          <ForestButton
            onClick={handleStartGame}
            disabled={starting || activePlayers.length === 0}
            className="bg-green-600 hover:bg-green-700"
          >
            {starting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
            Démarrer la partie ({activePlayers.length} joueurs)
          </ForestButton>
        )}

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <ForestButton variant="outline" className="text-destructive border-destructive/50 hover:bg-destructive/10">
              <Trash2 className="h-4 w-4 mr-2" />
              Supprimer la partie
            </ForestButton>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer la partie ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action est irréversible. Tous les joueurs seront déconnectés et toutes les données seront supprimées.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteGame}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Supprimer définitivement
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Liste des joueurs actifs */}
      <div className="card-gradient rounded-lg border border-border p-4">
        <h3 className="font-display text-lg mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Joueurs actifs ({activePlayers.length})
        </h3>

        {activePlayers.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-4">
            Aucun joueur n'a encore rejoint la partie
          </p>
        ) : (
          <div className="space-y-2">
            {/* Header */}
            <div className="hidden lg:grid grid-cols-12 gap-2 text-xs text-muted-foreground px-3 py-1">
              <div className="col-span-1">#</div>
              <div className="col-span-2">Nom</div>
              <div className="col-span-1">Clan</div>
              <div className="col-span-1">Mate</div>
              <div className="col-span-1">Jetons</div>
              <div className="col-span-2">Rejoint</div>
              <div className="col-span-1">Statut</div>
              <div className="col-span-3 text-right">Actions</div>
            </div>

            {activePlayers.map((player) => (
              <div
                key={player.id}
                className={`p-3 rounded-md bg-secondary/50 ${!player.is_alive ? 'opacity-50' : ''}`}
              >
                {editingId === player.id ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground">Nom</label>
                        <Input
                          value={editForm.display_name || ''}
                          onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Clan</label>
                        <Select
                          value={editForm.clan || 'none'}
                          onValueChange={(val) => setEditForm({ ...editForm, clan: val === 'none' ? '' : val })}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Clan" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Aucun</SelectItem>
                            <SelectItem value="Akila">Akila</SelectItem>
                            <SelectItem value="Akandé">Akandé</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Coéquipier</label>
                        <Select
                          value={editForm.mate_num?.toString() || 'none'}
                          onValueChange={(val) => setEditForm({ ...editForm, mate_num: val === 'none' ? null : parseInt(val) })}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Mate" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Aucun</SelectItem>
                            {availablePlayerNumbers
                              .filter(n => n !== player.player_number)
                              .map(n => (
                                <SelectItem key={n} value={n.toString()}>
                                  Joueur {n}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Jetons</label>
                        <Input
                          type="number"
                          value={editForm.jetons || 0}
                          onChange={(e) => setEditForm({ ...editForm, jetons: parseInt(e.target.value) || 0 })}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <ForestButton variant="ghost" size="sm" onClick={cancelEditing}>
                        <X className="h-4 w-4" />
                        Annuler
                      </ForestButton>
                      <ForestButton size="sm" onClick={() => handleSave(player.id)} disabled={saving}>
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Sauvegarder
                      </ForestButton>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-1">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                          {player.player_number || '?'}
                        </span>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <span className="font-medium text-sm truncate block">{player.display_name}</span>
                    </div>
                    <div className="col-span-1 text-sm text-muted-foreground">
                      {player.clan || '-'}
                    </div>
                    <div className="col-span-1 text-sm text-muted-foreground">
                      {player.mate_num || '-'}
                    </div>
                    <div className="col-span-1 text-sm font-medium text-forest-gold">
                      {player.jetons}
                    </div>
                    <div className="col-span-2 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(player.joined_at), { addSuffix: true, locale: fr })}
                    </div>
                    <div className="col-span-1">
                      {(() => {
                        const badge = getPresenceBadge(player.last_seen);
                        return (
                          <span className={`inline-flex items-center gap-1 text-xs ${badge.textColor}`}>
                            <span className={`w-2 h-2 rounded-full ${badge.color}`} />
                            {badge.label}
                          </span>
                        );
                      })()}
                    </div>
                    <div className="col-span-3 flex items-center justify-end gap-1">
                      <ForestButton
                        variant="ghost"
                        size="sm"
                        onClick={() => startEditing(player)}
                        title="Modifier le joueur"
                      >
                        <Pencil className="h-4 w-4" />
                      </ForestButton>
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
                        title="Réinitialiser le token"
                      >
                        {resettingId === player.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </ForestButton>
                      <ForestButton
                        variant="ghost"
                        size="sm"
                        onClick={() => openKickModal(player.id, player.display_name)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        title="Expulser le joueur"
                      >
                        <UserX className="h-4 w-4" />
                      </ForestButton>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Joueurs expulsés */}
      {kickedPlayers.length > 0 && (
        <div className="card-gradient rounded-lg border border-border/50 p-4 opacity-75">
          <h3 className="font-display text-sm mb-3 flex items-center gap-2 text-muted-foreground">
            <UserX className="h-4 w-4" />
            Joueurs expulsés ({kickedPlayers.length})
          </h3>
          <div className="space-y-1">
            {kickedPlayers.map((player) => (
              <div key={player.id} className="text-sm text-muted-foreground flex items-center gap-2">
                <span>{player.display_name}</span>
                <span className="text-xs">-</span>
                <span className="text-xs text-destructive/70">{player.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedPlayer && (
        <KickPlayerModal
          open={kickModalOpen}
          onOpenChange={setKickModalOpen}
          playerId={selectedPlayer.id}
          playerName={selectedPlayer.name}
          gameId={game.id}
          onSuccess={fetchPlayers}
        />
      )}
    </div>
  );
}
