import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ForestButton } from '@/components/ui/ForestButton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, RefreshCw, Loader2, Copy, Check, Pencil, Save, X, Lock, Users } from 'lucide-react';
import { toast } from 'sonner';

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
}

interface PlayerManagementListProps {
  gameId: string;
  isLobby: boolean;
}

export function PlayerManagementList({ gameId, isLobby }: PlayerManagementListProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Player>>({});
  const [saving, setSaving] = useState(false);

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
      .select('id, display_name, player_number, is_host, player_token, clan, mate_num, jetons, recompenses, is_alive')
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
  const availablePlayerNumbers = anonymousPlayers.map(p => p.player_number).filter(Boolean) as number[];

  return (
    <div className="card-gradient rounded-lg border border-border p-6">
      <h3 className="font-display text-lg mb-4 flex items-center gap-2">
        <Users className="h-5 w-5 text-primary" />
        Joueurs ({anonymousPlayers.length})
      </h3>

      {anonymousPlayers.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-4">
          Aucun joueur n'a encore rejoint la partie
        </p>
      ) : (
        <div className="space-y-3">
          {/* Header row */}
          <div className="hidden md:grid grid-cols-12 gap-2 text-xs text-muted-foreground px-3 py-1">
            <div className="col-span-1">#</div>
            <div className="col-span-3">Nom</div>
            <div className="col-span-2">Clan</div>
            <div className="col-span-1">Mate</div>
            <div className="col-span-1">Jetons</div>
            <div className="col-span-1">Récomp.</div>
            <div className="col-span-3 text-right">Actions</div>
          </div>

          {anonymousPlayers.map((player) => (
            <div
              key={player.id}
              className={`p-3 rounded-md bg-secondary/50 ${!player.is_alive ? 'opacity-50' : ''}`}
            >
              {editingId === player.id ? (
                // Edit mode
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
                // Display mode
                <div className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-1">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-sm font-medium text-primary">
                        {player.player_number || '?'}
                      </span>
                    </div>
                  </div>
                  <div className="col-span-3 md:col-span-3">
                    <span className="font-medium text-sm truncate block">{player.display_name}</span>
                  </div>
                  <div className="col-span-2 text-sm text-muted-foreground">
                    {player.clan || '-'}
                  </div>
                  <div className="col-span-1 text-sm text-muted-foreground">
                    {player.mate_num || '-'}
                  </div>
                  <div className="col-span-1 text-sm font-medium text-forest-gold">
                    {player.jetons}
                  </div>
                  <div className="col-span-1 text-sm font-medium text-green-500">
                    {player.recompenses}
                  </div>
                  <div className="col-span-3 flex items-center justify-end gap-1">
                    {isLobby && (
                      <ForestButton
                        variant="ghost"
                        size="sm"
                        onClick={() => startEditing(player)}
                        title="Modifier le joueur"
                      >
                        <Pencil className="h-4 w-4" />
                      </ForestButton>
                    )}
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
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
