import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ForestButton } from '@/components/ui/ForestButton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { KickPlayerModal } from '@/components/game/KickPlayerModal';
import { useUserRole } from '@/hooks/useUserRole';
import { 
  User, RefreshCw, Loader2, Copy, Check, Pencil, Save, X, 
  Users, UserX, Play, Lock, Coins, ShieldCheck, Swords, ShoppingBag, Bot, Plus
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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

interface Game {
  id: string;
  name: string;
  status: string;
  starting_tokens: number;
  phase?: string;
  phase_locked?: boolean;
  manche_active?: number;
  current_session_game_id?: string | null;
}

interface MJPlayersTabProps {
  game: Game;
  onGameUpdate: () => void;
}

export function MJPlayersTab({ game, onGameUpdate }: MJPlayersTabProps) {
  const { isAdmin } = useUserRole();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Player>>({});
  const [saving, setSaving] = useState(false);
  
  const [kickModalOpen, setKickModalOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<{ id: string; name: string } | null>(null);
  
  // Phase action state
  const [phaseActionLoading, setPhaseActionLoading] = useState(false);
  const [validatedCount, setValidatedCount] = useState(0);
  const [positionsPublished, setPositionsPublished] = useState(false);
  const [combatResolved, setCombatResolved] = useState(false);
  const [shopResolved, setShopResolved] = useState(false);
  
  // Bot addition state
  const [addingBots, setAddingBots] = useState(false);
  const [botCount, setBotCount] = useState(5);
  const [botsWithClans, setBotsWithClans] = useState(false);
  const [botsWithMates, setBotsWithMates] = useState(false);

  const isLobby = game.status === 'LOBBY';
  const isInGame = game.status === 'IN_GAME';

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

  // State for manual refresh
  const [isRefreshingPhaseState, setIsRefreshingPhaseState] = useState(false);

  // Fetch validation counts based on phase
  const fetchValidationState = async () => {
    if (!isInGame || !game.manche_active) return;
    
    const manche = game.manche_active!;
    const sessionGameId = game.current_session_game_id;
    
    const phase = game.phase || '';
    
    if (phase.startsWith('PHASE1')) {
      // Count players who have placed bets for current manche
      let query = supabase
        .from('round_bets')
        .select('player_id', { count: 'exact' })
        .eq('game_id', game.id)
        .eq('manche', manche);
      if (sessionGameId) query = query.eq('session_game_id', sessionGameId);
      
      const { count } = await query;
      setValidatedCount(count || 0);
      setPositionsPublished(false);
      setCombatResolved(false);
      setShopResolved(false);
    } else if (phase.startsWith('PHASE2')) {
      // Count players who have submitted actions
      let actionsQuery = supabase
        .from('actions')
        .select('num_joueur', { count: 'exact' })
        .eq('game_id', game.id)
        .eq('manche', manche);
      if (sessionGameId) actionsQuery = actionsQuery.eq('session_game_id', sessionGameId);
      
      const { count: actionsCount } = await actionsQuery;
      setValidatedCount(actionsCount || 0);
      
      // Check if positions have been published
      let posQuery = supabase
        .from('positions_finales')
        .select('id', { count: 'exact', head: true })
        .eq('game_id', game.id)
        .eq('manche', manche);
      if (sessionGameId) posQuery = posQuery.eq('session_game_id', sessionGameId);
      
      const { count: posCount } = await posQuery;
      setPositionsPublished((posCount || 0) > 0);
      
      // Check if combat has been resolved
      let combatQuery = supabase
        .from('combat_results')
        .select('id', { count: 'exact', head: true })
        .eq('game_id', game.id)
        .eq('manche', manche);
      if (sessionGameId) combatQuery = combatQuery.eq('session_game_id', sessionGameId);
      
      const { count: combatCount } = await combatQuery;
      setCombatResolved((combatCount || 0) > 0);
      setShopResolved(false);
    } else if (phase.startsWith('PHASE3')) {
      // Count players who submitted shop requests
      let shopQuery = supabase
        .from('game_item_purchases')
        .select('player_num', { count: 'exact' })
        .eq('game_id', game.id)
        .eq('manche', manche)
        .eq('status', 'pending');
      if (sessionGameId) shopQuery = shopQuery.eq('session_game_id', sessionGameId);
      
      const { count: shopCount } = await shopQuery;
      setValidatedCount(shopCount || 0);
      
      // Check if shop has been resolved
      let shopOfferQuery = supabase
        .from('game_shop_offers')
        .select('resolved')
        .eq('game_id', game.id)
        .eq('manche', manche);
      if (sessionGameId) shopOfferQuery = shopOfferQuery.eq('session_game_id', sessionGameId);
      
      const { data: shopOffer } = await shopOfferQuery.maybeSingle();
      setShopResolved(shopOffer?.resolved || false);
    }
  };

  // Manual refresh handler
  const handleRefreshPhaseState = async () => {
    setIsRefreshingPhaseState(true);
    await fetchValidationState();
    setIsRefreshingPhaseState(false);
    toast.success('Compteurs actualisés');
  };

  useEffect(() => {
    fetchValidationState();
    
    // Subscribe to relevant tables for real-time updates
    const channel = supabase
      .channel(`mj-phase-state-${game.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'round_bets', filter: `game_id=eq.${game.id}` }, fetchValidationState)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'actions', filter: `game_id=eq.${game.id}` }, fetchValidationState)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_item_purchases', filter: `game_id=eq.${game.id}` }, fetchValidationState)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'positions_finales', filter: `game_id=eq.${game.id}` }, fetchValidationState)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'combat_results', filter: `game_id=eq.${game.id}` }, fetchValidationState)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_shop_offers', filter: `game_id=eq.${game.id}` }, fetchValidationState)
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [game.id, game.phase, game.manche_active, game.current_session_game_id, isInGame, players.length]);

  const fetchPlayers = async () => {
    const { data, error } = await supabase
      .from('game_players')
      .select('*')
      .eq('game_id', game.id)
      .order('player_number', { ascending: true, nullsFirst: false });

    if (!error && data) {
      setPlayers(data as Player[]);
    }
    setLoading(false);
  };

  // Phase action handlers
  const handlePhaseAction = async () => {
    setPhaseActionLoading(true);
    const phase = game.phase || '';
    try {
      if (phase.startsWith('PHASE1')) {
        // Close bets and calculate priorities
        const { data, error } = await supabase.functions.invoke('close-phase1-bets', {
          body: { gameId: game.id },
        });
        if (error || !data?.success) throw new Error(data?.error || 'Erreur');
        toast.success('Mises clôturées, priorités calculées !');
      } else if (phase.startsWith('PHASE2') && !positionsPublished) {
        // Publish positions
        const { data, error } = await supabase.functions.invoke('publish-positions', {
          body: { gameId: game.id },
        });
        if (error || !data?.success) throw new Error(data?.error || 'Erreur');
        toast.success('Positions publiées !');
      } else if (phase.startsWith('PHASE2') && positionsPublished && !combatResolved) {
        // Resolve combat
        const { data, error } = await supabase.functions.invoke('resolve-combat', {
          body: { gameId: game.id },
        });
        if (error || !data?.success) throw new Error(data?.error || 'Erreur');
        toast.success('Combat résolu !');
      } else if (phase.startsWith('PHASE3')) {
        // Resolve shop
        const { data, error } = await supabase.functions.invoke('resolve-shop', {
          body: { gameId: game.id },
        });
        if (error || !data?.success) throw new Error(data?.error || 'Erreur');
        toast.success('Shop résolu !');
      }
      onGameUpdate();
    } catch (error: any) {
      console.error('Phase action error:', error);
      toast.error(error.message || 'Erreur lors de l\'action');
    } finally {
      setPhaseActionLoading(false);
    }
  };

  const getPhaseActionButton = () => {
    if (!isInGame) return null;
    
    const activePlayers = players.filter(p => !p.is_host && p.status === 'ACTIVE');
    const totalPlayers = activePlayers.length;
    
    let buttonText = '';
    let buttonIcon = <Lock className="h-4 w-4 mr-2" />;
    let isDisabled = false;
    
    const phase = game.phase || '';
    
    if (phase.startsWith('PHASE1')) {
      buttonText = 'Clôturer et calculer priorités';
      buttonIcon = <Lock className="h-4 w-4 mr-2" />;
    } else if (phase.startsWith('PHASE2')) {
      if (!positionsPublished) {
        buttonText = 'Publier les positions';
        buttonIcon = <Play className="h-4 w-4 mr-2" />;
      } else if (!combatResolved) {
        buttonText = 'Résoudre le combat';
        buttonIcon = <Swords className="h-4 w-4 mr-2" />;
      } else {
        buttonText = 'Combat résolu ✓';
        isDisabled = true;
      }
    } else if (phase.startsWith('PHASE3')) {
      if (!shopResolved) {
        buttonText = 'Résoudre le Shop';
        buttonIcon = <ShoppingBag className="h-4 w-4 mr-2" />;
      } else {
        buttonText = 'Shop résolu ✓';
        isDisabled = true;
      }
    } else {
      return null;
    }
    
    return (
      <div className="flex items-center gap-3 flex-wrap">
        <ForestButton
          onClick={handlePhaseAction}
          disabled={phaseActionLoading || isDisabled}
          className="bg-primary hover:bg-primary/90"
        >
          {phaseActionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : buttonIcon}
          {buttonText}
        </ForestButton>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {validatedCount}/{totalPlayers} validés
          </span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleRefreshPhaseState}
                  disabled={isRefreshingPhaseState}
                  className="p-1 rounded-md hover:bg-secondary transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 text-muted-foreground ${isRefreshingPhaseState ? 'animate-spin' : ''}`} />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Actualiser les compteurs</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    );
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

  // Add bots handler
  const handleAddBots = async () => {
    if (!isAdmin) {
      toast.error('Seuls les administrateurs peuvent ajouter des bots');
      return;
    }
    
    setAddingBots(true);
    try {
      const { data, error } = await supabase.functions.invoke('add-bots', {
        body: { gameId: game.id, count: botCount, withClans: botsWithClans, withMates: botsWithMates },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || 'Erreur lors de l\'ajout des bots');
      }

      toast.success(`${data.botsAdded} bots ajoutés !`);
      fetchPlayers();
    } catch (error: any) {
      console.error('Error adding bots:', error);
      toast.error(error.message || 'Erreur lors de l\'ajout des bots');
    } finally {
      setAddingBots(false);
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

      // Generate the reconnection link with the new token
      const { getPlayerReconnectUrl } = await import('@/lib/urlHelpers');
      const reconnectUrl = getPlayerReconnectUrl(game.id, data.newToken);
      
      // Copy to clipboard
      try {
        await navigator.clipboard.writeText(reconnectUrl);
        setCopiedId(playerId);
        setTimeout(() => setCopiedId(null), 3000);
        toast.success(
          <div className="space-y-1">
            <p>Token de <strong>{playerName}</strong> réinitialisé</p>
            <p className="text-xs text-muted-foreground">Lien de reconnexion copié dans le presse-papier</p>
          </div>
        );
      } catch {
        // Fallback: show the link in the toast
        toast.success(
          <div className="space-y-2">
            <p>Token de <strong>{playerName}</strong> réinitialisé</p>
            <div className="text-xs bg-secondary p-2 rounded break-all select-all">
              {reconnectUrl}
            </div>
          </div>,
          { duration: 10000 }
        );
      }

      fetchPlayers();
    } catch (err) {
      console.error('Reset error:', err);
      toast.error('Erreur lors de la réinitialisation');
    } finally {
      setResettingId(null);
    }
  };

  const handleCopyJoinLink = async (playerId: string, token: string) => {
    const { getPlayerReconnectUrl } = await import('@/lib/urlHelpers');
    const joinUrl = getPlayerReconnectUrl(game.id, token);
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

  // Check if MJ can edit clan for this player
  const canEditClan = (player: Player): boolean => {
    // Admin can always edit
    if (isAdmin) return true;
    
    // If player has no clan and no token used, MJ can assign (no advantage)
    if (!player.clan && !player.clan_token_used) return true;
    
    // If clan is locked, MJ cannot edit
    if (player.clan_locked) return false;
    
    // If player used a token for clan, MJ cannot edit (they paid for it)
    if (player.clan_token_used) return false;
    
    // If player has a user_id (registered user), check if they have subscription benefits
    // For simplicity, we allow MJ to edit if not locked and not token-used
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

      // Only update clan if allowed
      if (canEditClan(player)) {
        updateData.clan = editForm.clan || null;
      }

      const { error } = await supabase
        .from('game_players')
        .update(updateData)
        .eq('id', playerId);

      if (error) throw error;

      // Synchronize mate: if we set a mate, update the other player's mate_num too
      if (newMateNum !== oldMateNum && player.player_number) {
        // If we're setting a new mate, update that player to have us as mate
        if (newMateNum) {
          const { error: mateError } = await supabase
            .from('game_players')
            .update({ mate_num: player.player_number })
            .eq('game_id', game.id)
            .eq('player_number', newMateNum);
          
          if (mateError) console.error('Error syncing mate:', mateError);
        }
        
        // If we had a previous mate and changed/removed it, clear their mate_num
        if (oldMateNum && oldMateNum !== newMateNum) {
          const { error: clearError } = await supabase
            .from('game_players')
            .update({ mate_num: null })
            .eq('game_id', game.id)
            .eq('player_number', oldMateNum);
          
          if (clearError) console.error('Error clearing old mate:', clearError);
        }
      }

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

  // Get available clans for dropdown (exclude clans with advantages if player can't have them)
  const getAvailableClans = (player: Player) => {
    const allClans = [
      { value: 'none', label: 'Aucun' },
      { value: 'Royaux', label: '👑 Royaux' },
      { value: 'Zoulous', label: '💰 Zoulous' },
      { value: 'Keryndes', label: '🧭 Keryndes' },
      { value: 'Akandé', label: '⚔️ Akandé' },
      { value: 'Aseyra', label: '📜 Aséyra' },
      { value: 'Akila', label: '🔬 Akila' },
      { value: 'Ezkar', label: '💥 Ezkar' },
    ];
    return allClans;
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Actions principales - Lobby */}
        {isLobby && (
          <div className="flex flex-wrap gap-3 items-center">
            <ForestButton
              onClick={handleStartGame}
              disabled={starting || activePlayers.length === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              {starting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
              Démarrer la partie ({activePlayers.length} joueurs)
            </ForestButton>
            
            {/* Add bots - Admin only */}
            {isAdmin && (
              <div className="flex flex-wrap items-center gap-3 ml-4 p-3 rounded-lg border border-dashed border-primary/30 bg-primary/5">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-primary" />
                  <span className="text-sm text-muted-foreground">Bots:</span>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={botCount}
                    onChange={(e) => setBotCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                    className="h-8 w-16 text-sm text-center"
                  />
                </div>
                
                <div className="flex items-center gap-3 text-sm">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={botsWithClans}
                      onChange={(e) => setBotsWithClans(e.target.checked)}
                      className="h-4 w-4 rounded border-border accent-primary"
                    />
                    <span className="text-muted-foreground">Clans aléatoires</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={botsWithMates}
                      onChange={(e) => setBotsWithMates(e.target.checked)}
                      className="h-4 w-4 rounded border-border accent-primary"
                    />
                    <span className="text-muted-foreground">Mates aléatoires</span>
                  </label>
                </div>
                
                <ForestButton
                  size="sm"
                  onClick={handleAddBots}
                  disabled={addingBots}
                  variant="outline"
                >
                  {addingBots ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Ajouter
                </ForestButton>
              </div>
            )}
          </div>
        )}

        {/* Phase action button - In Game */}
        {isInGame && (
          <div className="card-gradient rounded-lg border border-primary/30 bg-primary/5 p-4">
            <h3 className="font-display text-sm mb-3 flex items-center gap-2 text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Action de phase - Manche {game.manche_active || 1} ({game.phase || 'N/A'})
            </h3>
            {getPhaseActionButton()}
          </div>
        )}

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
                <div className="col-span-2">Clan</div>
                <div className="col-span-1">Mate</div>
                <div className="col-span-1">Jetons</div>
                <div className="col-span-2">Rejoint</div>
                <div className="col-span-1">Statut</div>
                <div className="col-span-2 text-right">Actions</div>
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
                          <label className="text-xs text-muted-foreground flex items-center gap-1">
                            Clan
                            {!canEditClan(player) && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <Lock className="h-3 w-3 text-muted-foreground" />
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
                            <SelectTrigger className={`h-8 text-sm ${!canEditClan(player) ? 'opacity-50' : ''}`}>
                              <SelectValue placeholder="Clan" />
                            </SelectTrigger>
                            <SelectContent>
                              {getAvailableClans(player).map(c => (
                                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                              ))}
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
                      <div className="col-span-2 flex items-center gap-1">
                        <span className="font-medium text-sm truncate">{player.display_name}</span>
                        {player.is_bot && (
                          <Tooltip>
                            <TooltipTrigger>
                              <Bot className="h-3 w-3 text-primary" />
                            </TooltipTrigger>
                            <TooltipContent>Bot automatique</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      <div className="col-span-2 text-sm text-muted-foreground flex items-center gap-1">
                        {player.clan || '-'}
                        {player.clan && (
                          <>
                            {player.clan_locked && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <Lock className="h-3 w-3 text-primary" />
                                </TooltipTrigger>
                                <TooltipContent>Verrouillé par le joueur</TooltipContent>
                              </Tooltip>
                            )}
                            {player.clan_token_used && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <Coins className="h-3 w-3 text-forest-gold" />
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
                      <div className="col-span-2 flex items-center justify-end gap-1">
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
    </TooltipProvider>
  );
}