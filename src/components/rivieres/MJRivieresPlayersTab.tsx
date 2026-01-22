import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ForestButton } from '@/components/ui/ForestButton';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { KickPlayerModal } from '@/components/game/KickPlayerModal';
import { useUserRole } from '@/hooks/useUserRole';
import { 
  Users, RefreshCw, Loader2, Copy, Check, Pencil, Save, X, 
  UserX, Lock, Coins, ShieldCheck, Bot, Plus, Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { rivieresCardStyle } from './RivieresTheme';

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
  clan_locked: boolean;
  clan_token_used: boolean;
  user_id: string | null;
  is_bot?: boolean;
}

interface RiverPlayerStats {
  id: string;
  player_id: string;
  player_num: number;
  validated_levels: number;
  keryndes_available: boolean;
  current_round_status: string;
  descended_level: number | null;
}

interface MJRivieresPlayersTabProps {
  gameId: string;
  sessionGameId?: string;
  gameStatus?: string;
  isLobby?: boolean;
  onRefresh: () => void;
}

export function MJRivieresPlayersTab({ gameId, sessionGameId, gameStatus, isLobby: isLobbyProp, onRefresh }: MJRivieresPlayersTabProps) {
  const { isAdmin } = useUserRole();
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerStats, setPlayerStats] = useState<RiverPlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Player>>({});
  const [saving, setSaving] = useState(false);
  
  const [kickModalOpen, setKickModalOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<{ id: string; name: string } | null>(null);

  // Bot management state
  const [addingBots, setAddingBots] = useState(false);
  const [deletingBots, setDeletingBots] = useState(false);
  const [botCount, setBotCount] = useState(5);
  const [botsWithClans, setBotsWithClans] = useState(false);
  const [botsWithMates, setBotsWithMates] = useState(false);
  
  const isLobby = isLobbyProp || gameStatus === 'LOBBY';

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel(`mj-rivieres-players-${gameId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${gameId}` }, 
        () => fetchData());
    
    // Only subscribe to river_player_stats if we have a sessionGameId
    if (sessionGameId) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'river_player_stats', filter: `session_game_id=eq.${sessionGameId}` },
        () => fetchStats());
    }
    
    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, sessionGameId]);

  const fetchData = async () => {
    const { data, error } = await supabase
      .from('game_players')
      .select('*')
      .eq('game_id', gameId)
      .order('player_number', { ascending: true, nullsFirst: false });

    if (!error && data) {
      setPlayers(data as Player[]);
    }
    
    await fetchStats();
    setLoading(false);
  };

  const fetchStats = async () => {
    if (!sessionGameId) {
      setPlayerStats([]);
      return;
    }
    const { data } = await supabase
      .from('river_player_stats')
      .select('*')
      .eq('session_game_id', sessionGameId)
      .order('player_num');
    if (data) setPlayerStats(data);
  };

  // Add bots handler
  const handleAddBots = async () => {
    if (!isAdmin) {
      toast.error('Seuls les administrateurs peuvent ajouter des bots');
      return;
    }
    
    setAddingBots(true);
    try {
      const { data, error } = await supabase.functions.invoke('add-bots', {
        body: { gameId, count: botCount, withClans: botsWithClans, withMates: botsWithMates },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || 'Erreur lors de l\'ajout des bots');
      }

      toast.success(`${data.botsAdded} bots ajoutés !`);
      fetchData();
    } catch (error: any) {
      console.error('Error adding bots:', error);
      toast.error(error.message || 'Erreur lors de l\'ajout des bots');
    } finally {
      setAddingBots(false);
    }
  };

  // Delete all bots handler
  const handleDeleteAllBots = async () => {
    if (!isAdmin) {
      toast.error('Seuls les administrateurs peuvent supprimer les bots');
      return;
    }
    
    const botPlayers = players.filter(p => p.is_bot && p.status === 'ACTIVE');
    if (botPlayers.length === 0) {
      toast.info('Aucun bot à supprimer');
      return;
    }
    
    setDeletingBots(true);
    try {
      const { error } = await supabase
        .from('game_players')
        .delete()
        .eq('game_id', gameId)
        .eq('is_bot', true);

      if (error) throw error;

      toast.success(`${botPlayers.length} bots supprimés !`);
      fetchData();
    } catch (error: any) {
      console.error('Error deleting bots:', error);
      toast.error(error.message || 'Erreur lors de la suppression des bots');
    } finally {
      setDeletingBots(false);
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

      const { getPlayerReconnectUrl } = await import('@/lib/urlHelpers');
      const reconnectUrl = getPlayerReconnectUrl(gameId, data.newToken);
      
      try {
        await navigator.clipboard.writeText(reconnectUrl);
        setCopiedId(playerId);
        setTimeout(() => setCopiedId(null), 3000);
        toast.success(
          <div className="space-y-1">
            <p>Token de <strong>{playerName}</strong> réinitialisé</p>
            <p className="text-xs text-muted-foreground">Lien de reconnexion copié</p>
          </div>
        );
      } catch {
        toast.success(`Token de ${playerName} réinitialisé`);
      }

      fetchData();
    } catch (err) {
      console.error('Reset error:', err);
      toast.error('Erreur lors de la réinitialisation');
    } finally {
      setResettingId(null);
    }
  };

  const handleCopyJoinLink = async (playerId: string, token: string) => {
    const { getPlayerReconnectUrl } = await import('@/lib/urlHelpers');
    const joinUrl = getPlayerReconnectUrl(gameId, token);
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

  const canEditClan = (player: Player): boolean => {
    if (isAdmin) return true;
    if (!player.clan && !player.clan_token_used) return true;
    if (player.clan_locked) return false;
    if (player.clan_token_used) return false;
    return true;
  };

  const getClanEditTooltip = (player: Player): string | null => {
    if (isAdmin) return null;
    if (player.clan_locked) return 'Clan verrouillé par le joueur';
    if (player.clan_token_used) return 'Token utilisé pour les avantages de clan';
    return null;
  };

  const handleSave = async (playerId: string) => {
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    setSaving(true);
    try {
      const newMateNum = editForm.mate_num || null;
      const oldMateNum = player.mate_num;

      const updateData: any = {
        display_name: editForm.display_name,
        mate_num: newMateNum,
        jetons: editForm.jetons || 0,
      };

      if (canEditClan(player)) {
        updateData.clan = editForm.clan || null;
      }

      const { error } = await supabase
        .from('game_players')
        .update(updateData)
        .eq('id', playerId);

      if (error) throw error;

      // Synchronize mate
      if (newMateNum !== oldMateNum && player.player_number) {
        if (newMateNum) {
          await supabase
            .from('game_players')
            .update({ mate_num: player.player_number })
            .eq('game_id', gameId)
            .eq('player_number', newMateNum);
        }
        
        if (oldMateNum && oldMateNum !== newMateNum) {
          await supabase
            .from('game_players')
            .update({ mate_num: null })
            .eq('game_id', gameId)
            .eq('player_number', oldMateNum);
        }
      }

      toast.success('Joueur mis à jour');
      setEditingId(null);
      setEditForm({});
      fetchData();
      onRefresh();
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

  const getPlayerPresenceState = (lastSeen: string | null): 'online' | 'offline' | 'disconnected' => {
    if (!lastSeen) return 'disconnected';
    const diff = Date.now() - new Date(lastSeen).getTime();
    if (diff < 30000) return 'online';
    if (diff < 90000) return 'offline';
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

  const RIVIERES_CLANS = [
    { value: 'none', label: 'Aucun' },
    { value: 'Royaux', label: '👑 Royaux' },
    { value: 'Zoulous', label: '💰 Zoulous' },
    { value: 'Keryndes', label: '🧭 Keryndes' },
    { value: 'Akandé', label: '⚔️ Akandé' },
    { value: 'Aseyra', label: '📜 Aséyra' },
    { value: 'Akila', label: '🔬 Akila' },
    { value: 'Ezkar', label: '💥 Ezkar' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-[#D4AF37]" />
      </div>
    );
  }

  const activePlayers = players.filter(p => !p.is_host && p.status === 'ACTIVE');
  const kickedPlayers = players.filter(p => p.status === 'REMOVED');
  const availablePlayerNumbers = activePlayers.map(p => p.player_number).filter(Boolean) as number[];
  
  const getStatsByPlayerId = (id: string) => playerStats.find(s => s.player_id === id);

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header avec refresh */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-[#D4AF37] flex items-center gap-2">
            <Users className="h-5 w-5" />
            Gestion des Joueurs ({activePlayers.length})
          </h3>
          <Button
            size="sm"
            variant="ghost"
            onClick={fetchData}
            className="text-[#D4AF37] hover:bg-[#D4AF37]/10"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Bot management - Admin only, Lobby only */}
        {isAdmin && isLobby && (
          <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-dashed border-[#D4AF37]/30 bg-[#D4AF37]/5">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-[#D4AF37]" />
              <span className="text-sm text-[#9CA3AF]">Bots:</span>
              <NumberInput
                min={1}
                max={50}
                value={botCount}
                onChange={setBotCount}
                defaultValue={5}
                className="h-8 w-16 text-sm text-center bg-[#0B1020] border-[#D4AF37]/30 text-[#E8E8E8]"
              />
            </div>
            
            <div className="flex items-center gap-3 text-sm">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={botsWithClans}
                  onChange={(e) => setBotsWithClans(e.target.checked)}
                  className="h-4 w-4 rounded border-[#D4AF37]/30 accent-[#D4AF37]"
                />
                <span className="text-[#9CA3AF]">Clans aléatoires</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={botsWithMates}
                  onChange={(e) => setBotsWithMates(e.target.checked)}
                  className="h-4 w-4 rounded border-[#D4AF37]/30 accent-[#D4AF37]"
                />
                <span className="text-[#9CA3AF]">Mates aléatoires</span>
              </label>
            </div>
            
            <ForestButton
              size="sm"
              onClick={handleAddBots}
              disabled={addingBots}
              className="bg-[#D4AF37] hover:bg-[#D4AF37]/80 text-black"
            >
              {addingBots ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Ajouter
            </ForestButton>
            
            {players.some(p => p.is_bot && p.status === 'ACTIVE') && (
              <ForestButton
                size="sm"
                onClick={handleDeleteAllBots}
                disabled={deletingBots}
                variant="ghost"
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                {deletingBots ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Supprimer tous
              </ForestButton>
            )}
          </div>
        )}

        {/* Liste des joueurs actifs */}
        <div className={rivieresCardStyle}>
          {activePlayers.length === 0 ? (
            <p className="text-[#9CA3AF] text-sm text-center py-4">
              Aucun joueur n'a encore rejoint la partie
            </p>
          ) : (
            <div className="overflow-x-auto">
              {/* Header */}
              <div className="hidden lg:grid grid-cols-12 gap-2 text-xs text-[#9CA3AF] px-3 py-2 bg-[#0B1020] rounded-t-lg">
                <div className="col-span-1">#</div>
                <div className="col-span-2">Nom</div>
                <div className="col-span-2">Clan</div>
                <div className="col-span-1">Mate</div>
                <div className="col-span-1">Jetons</div>
                <div className="col-span-1">Niveaux</div>
                <div className="col-span-1">Rejoint</div>
                <div className="col-span-1">Statut</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>

              <div className="space-y-1 p-2">
                {activePlayers.map((player) => {
                  const stats = getStatsByPlayerId(player.id);
                  
                  return (
                    <div
                      key={player.id}
                      className={`p-3 rounded-md bg-[#20232A] border border-[#D4AF37]/10 ${!player.is_alive ? 'opacity-50' : ''}`}
                    >
                      {editingId === player.id ? (
                        // Mode édition
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                              <label className="text-xs text-[#9CA3AF]">Nom</label>
                              <Input
                                value={editForm.display_name || ''}
                                onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })}
                                className="h-8 text-sm bg-[#0B1020] border-[#D4AF37]/30 text-[#E8E8E8]"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-[#9CA3AF] flex items-center gap-1">
                                Clan
                                {!canEditClan(player) && (
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Lock className="h-3 w-3 text-[#9CA3AF]" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {getClanEditTooltip(player)}
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </label>
                              <Select
                                value={editForm.clan || 'none'}
                                onValueChange={(val) => setEditForm({ ...editForm, clan: val === 'none' ? '' : val })}
                                disabled={!canEditClan(player)}
                              >
                                <SelectTrigger className={`h-8 text-sm bg-[#0B1020] border-[#D4AF37]/30 text-[#E8E8E8] ${!canEditClan(player) ? 'opacity-50' : ''}`}>
                                  <SelectValue placeholder="Clan" />
                                </SelectTrigger>
                                <SelectContent>
                                  {RIVIERES_CLANS.map(c => (
                                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <label className="text-xs text-[#9CA3AF]">Coéquipier</label>
                              <Select
                                value={editForm.mate_num?.toString() || 'none'}
                                onValueChange={(val) => setEditForm({ ...editForm, mate_num: val === 'none' ? null : parseInt(val) })}
                              >
                                <SelectTrigger className="h-8 text-sm bg-[#0B1020] border-[#D4AF37]/30 text-[#E8E8E8]">
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
                              <label className="text-xs text-[#9CA3AF]">Jetons</label>
                              <NumberInput
                                value={editForm.jetons || 0}
                                onChange={(v) => setEditForm({ ...editForm, jetons: v })}
                                defaultValue={0}
                                min={0}
                                className="h-8 text-sm bg-[#0B1020] border-[#D4AF37]/30 text-[#E8E8E8]"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <ForestButton variant="ghost" size="sm" onClick={cancelEditing} className="text-[#9CA3AF]">
                              <X className="h-4 w-4" />
                              Annuler
                            </ForestButton>
                            <ForestButton size="sm" onClick={() => handleSave(player.id)} disabled={saving} className="bg-[#D4AF37] hover:bg-[#D4AF37]/80 text-black">
                              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                              Sauvegarder
                            </ForestButton>
                          </div>
                        </div>
                      ) : (
                        // Mode affichage
                        <div className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-1">
                            <div className="w-8 h-8 rounded-full bg-[#D4AF37]/20 flex items-center justify-center">
                              <span className="text-sm font-bold text-[#D4AF37]">
                                {player.player_number || '?'}
                              </span>
                            </div>
                          </div>
                          <div className="col-span-2 flex items-center gap-1">
                            <span className="font-medium text-sm text-[#E8E8E8] truncate">{player.display_name}</span>
                            {player.is_bot && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <Bot className="h-3 w-3 text-[#D4AF37]" />
                                </TooltipTrigger>
                                <TooltipContent>Bot automatique</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                          <div className="col-span-2 text-sm text-[#9CA3AF] flex items-center gap-1">
                            {player.clan || '-'}
                            {player.clan && (
                              <>
                                {player.clan_locked && (
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Lock className="h-3 w-3 text-[#D4AF37]" />
                                    </TooltipTrigger>
                                    <TooltipContent>Verrouillé par le joueur</TooltipContent>
                                  </Tooltip>
                                )}
                                {player.clan_token_used && (
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Coins className="h-3 w-3 text-[#D4AF37]" />
                                    </TooltipTrigger>
                                    <TooltipContent>Token utilisé</TooltipContent>
                                  </Tooltip>
                                )}
                                {(player.clan_locked || player.clan_token_used) && (
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <ShieldCheck className="h-3 w-3 text-green-500" />
                                    </TooltipTrigger>
                                    <TooltipContent>Avantages de clan actifs</TooltipContent>
                                  </Tooltip>
                                )}
                              </>
                            )}
                          </div>
                          <div className="col-span-1 text-sm text-[#9CA3AF]">
                            {player.mate_num || '-'}
                          </div>
                          <div className="col-span-1 text-sm font-medium text-[#4ADE80]">
                            {player.jetons}💎
                          </div>
                          <div className="col-span-1 text-sm text-[#E8E8E8]">
                            {stats?.validated_levels ?? 0}/15
                          </div>
                          <div className="col-span-1 text-xs text-[#9CA3AF]">
                            {formatDistanceToNow(new Date(player.joined_at), { addSuffix: true, locale: fr })}
                          </div>
                          <div className="col-span-1">
                            {(() => {
                              const badge = getPresenceBadge(player.last_seen);
                              return (
                                <span className={`inline-flex items-center gap-1 text-xs ${badge.textColor}`}>
                                  <span className={`w-2 h-2 rounded-full ${badge.color}`} />
                                  <span className="hidden xl:inline">{badge.label}</span>
                                </span>
                              );
                            })()}
                          </div>
                          <div className="col-span-2 flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => startEditing(player)}
                              title="Modifier le joueur"
                              className="h-7 w-7 p-0 text-[#D4AF37] hover:bg-[#D4AF37]/10"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            {player.player_token && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCopyJoinLink(player.id, player.player_token!)}
                                title="Copier le lien de reconnexion"
                                className="h-7 w-7 p-0"
                              >
                                {copiedId === player.id ? (
                                  <Check className="h-3 w-3 text-green-500" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleResetToken(player.id, player.display_name)}
                              disabled={resettingId === player.id}
                              title="Réinitialiser le token"
                              className="h-7 w-7 p-0"
                            >
                              {resettingId === player.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3 w-3" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openKickModal(player.id, player.display_name)}
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                              title="Expulser le joueur"
                            >
                              <UserX className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Joueurs expulsés */}
        {kickedPlayers.length > 0 && (
          <div className={`${rivieresCardStyle} opacity-75`}>
            <h3 className="font-display text-sm mb-3 px-3 pt-3 flex items-center gap-2 text-[#9CA3AF]">
              <UserX className="h-4 w-4" />
              Joueurs expulsés ({kickedPlayers.length})
            </h3>
            <div className="space-y-1 px-3 pb-3">
              {kickedPlayers.map((player) => (
                <div key={player.id} className="text-sm text-[#9CA3AF] flex items-center gap-2">
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
            gameId={gameId}
            onSuccess={() => {
              fetchData();
              onRefresh();
            }}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
