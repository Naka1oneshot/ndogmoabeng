import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, Users, Syringe, Target, MessageSquare, 
  Activity, Play, Lock, CheckCircle, Settings, Skull,
  RefreshCw, Copy, Check, UserX, Loader2, Pencil, Save, X
} from 'lucide-react';
import { INFECTION_COLORS, INFECTION_ROLE_LABELS, getInfectionThemeClasses } from './InfectionTheme';
import { toast } from 'sonner';
import { MJActionsTab } from './MJActionsTab';
import { MJChatsTab } from './MJChatsTab';
import { MJRoundHistorySelector } from './MJRoundHistorySelector';
import { KickPlayerModal } from '@/components/game/KickPlayerModal';
import { LandscapeModePrompt } from '@/components/mj/LandscapeModePrompt';

interface Game {
  id: string;
  name: string;
  join_code: string;
  status: string;
  manche_active: number | null;
  phase: string;
  starting_tokens: number;
  current_session_game_id: string | null;
  selected_game_type_code: string | null;
}

interface Player {
  id: string;
  display_name: string;
  player_number: number | null;
  clan: string | null;
  status: string | null;
  jetons: number | null;
  pvic: number | null;
  is_alive: boolean | null;
  role_code: string | null;
  team_code: string | null;
  is_carrier: boolean | null;
  is_contagious: boolean | null;
  immune_permanent: boolean | null;
  infected_at_manche: number | null;
  will_contaminate_at_manche: number | null;
  will_die_at_manche: number | null;
  has_antibodies: boolean | null;
  last_seen: string | null;
  is_host: boolean;
  player_token: string | null;
}

interface RoundState {
  id: string;
  manche: number;
  status: string;
  sy_success_count: number;
  sy_required_success: number;
}

interface EditForm {
  display_name: string;
  player_number: number | null;
  jetons: number;
}

interface MJInfectionDashboardProps {
  game: Game;
  onBack: () => void;
}

export function MJInfectionDashboard({ game, onBack }: MJInfectionDashboardProps) {
  const navigate = useNavigate();
  const theme = getInfectionThemeClasses();
  
  const [players, setPlayers] = useState<Player[]>([]);
  const [roundState, setRoundState] = useState<RoundState | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('control');
  const [selectedManche, setSelectedManche] = useState(game.manche_active || 1);
  
  // Player management state
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [kickModalOpen, setKickModalOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<{ id: string; name: string } | null>(null);
  
  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ display_name: '', player_number: null, jetons: 0 });
  const [saving, setSaving] = useState(false);

  // Reset selected manche when game.manche_active changes
  useEffect(() => {
    if (game.manche_active) {
      setSelectedManche(game.manche_active);
    }
  }, [game.manche_active]);

  useEffect(() => {
    fetchData();
    
    // Subscribe to realtime updates - optimized to avoid unnecessary refreshes
    const channel = supabase
      .channel(`infection-mj-${game.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${game.id}` }, 
        (payload) => {
          // Skip if only last_seen changed
          if (payload.new && payload.old) {
            const newPlayer = payload.new as any;
            const oldPlayer = payload.old as any;
            if (newPlayer.last_seen !== oldPlayer.last_seen && 
                newPlayer.jetons === oldPlayer.jetons && 
                newPlayer.status === oldPlayer.status &&
                newPlayer.is_alive === oldPlayer.is_alive &&
                newPlayer.role_code === oldPlayer.role_code) {
              return;
            }
          }
          fetchData();
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'infection_round_state', filter: `game_id=eq.${game.id}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'infection_inputs', filter: `game_id=eq.${game.id}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'infection_shots', filter: `game_id=eq.${game.id}` }, fetchData)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'infection_chat_messages', filter: `game_id=eq.${game.id}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${game.id}` }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [game.id]);

  const fetchData = async () => {
    // Fetch players
    const { data: playersData } = await supabase
      .from('game_players')
      .select('*')
      .eq('game_id', game.id)
      .is('removed_at', null)
      .order('player_number', { ascending: true });

    if (playersData) {
      setPlayers(playersData as Player[]);
    }

    // Fetch current round state
    if (game.current_session_game_id && game.manche_active) {
      const { data: roundData } = await supabase
        .from('infection_round_state')
        .select('*')
        .eq('session_game_id', game.current_session_game_id)
        .eq('manche', game.manche_active)
        .maybeSingle();

      if (roundData) {
        setRoundState(roundData as RoundState);
      }
    }

    setLoading(false);
  };

  const handleStartGame = async () => {
    if (!game.current_session_game_id) {
      toast.error('Aucune session de jeu active');
      return;
    }

    if (activePlayers.length < 7) {
      toast.error('Minimum 7 joueurs requis pour INFECTION');
      return;
    }

    toast.info('Lancement de la partie INFECTION...');

    try {
      const { data, error } = await supabase.functions.invoke('start-infection', {
        body: {
          gameId: game.id,
          sessionGameId: game.current_session_game_id,
          startingTokens: game.starting_tokens,
        },
      });

      if (error) {
        console.error('[MJ] start-infection error:', error);
        toast.error(`Erreur: ${error.message}`);
        return;
      }

      if (!data?.success) {
        toast.error(data?.error || 'Erreur inconnue');
        return;
      }

      toast.success(`Partie lancée avec ${data.data.playerCount} joueurs !`);
      fetchData();
    } catch (err) {
      console.error('[MJ] start-infection exception:', err);
      toast.error('Erreur lors du lancement');
    }
  };

  const handleLockAndResolve = async () => {
    if (!roundState || !game.current_session_game_id) return;
    
    toast.info('Verrouillage et résolution en cours...');

    try {
      const { data, error } = await supabase.functions.invoke('resolve-infection-round', {
        body: {
          gameId: game.id,
          sessionGameId: game.current_session_game_id,
          manche: game.manche_active || 1,
        },
      });

      if (error) {
        console.error('[MJ] resolve-infection-round error:', error);
        toast.error(`Erreur: ${error.message}`);
        return;
      }

      if (!data?.success) {
        toast.error(data?.error || 'Erreur inconnue');
        return;
      }

      if (data.data.gameEnded) {
        toast.success(`Partie terminée! Victoire ${data.data.winner}`);
      } else {
        toast.success(`Manche ${game.manche_active} résolue! ${data.data.deaths} mort(s)`);
      }
      
      fetchData();
    } catch (err) {
      console.error('[MJ] resolve-infection-round exception:', err);
      toast.error('Erreur lors de la résolution');
    }
  };

  const handleNextRound = async () => {
    if (!game.current_session_game_id) return;
    
    toast.info('Ouverture de la manche suivante...');

    try {
      const { data, error } = await supabase.functions.invoke('next-infection-round', {
        body: {
          gameId: game.id,
          sessionGameId: game.current_session_game_id,
        },
      });

      if (error) {
        console.error('[MJ] next-infection-round error:', error);
        toast.error(`Erreur: ${error.message}`);
        return;
      }

      if (!data?.success) {
        toast.error(data?.error || 'Erreur inconnue');
        return;
      }

      toast.success(`Manche ${data.data.manche} ouverte !`);
      fetchData();
    } catch (err) {
      console.error('[MJ] next-infection-round exception:', err);
      toast.error('Erreur lors de l\'ouverture');
    }
  };

  // Player management functions
  const handleResetToken = async (playerId: string, playerName: string) => {
    setResettingId(playerId);
    try {
      const { data, error } = await supabase.functions.invoke('reset-player-token', {
        body: { playerId },
      });

      console.log('[MJ] reset-player-token response:', { data, error });

      if (error) {
        console.error('[MJ] reset-player-token error:', error);
        toast.error(error.message || 'Erreur lors de la réinitialisation');
        return;
      }

      if (!data?.success) {
        toast.error(data?.error || 'Erreur lors de la réinitialisation');
        return;
      }

      // Copy the new join link to clipboard
      if (data.newToken) {
        const { getPlayerReconnectUrl } = await import('@/lib/urlHelpers');
        const joinUrl = getPlayerReconnectUrl(game.id, data.newToken);
        try {
          await navigator.clipboard.writeText(joinUrl);
          setCopiedId(playerId);
          toast.success(`Token de ${playerName} réinitialisé et lien copié !`);
          setTimeout(() => setCopiedId(null), 2000);
        } catch {
          toast.success(`Token de ${playerName} réinitialisé`);
        }
      } else {
        toast.success(`Token de ${playerName} réinitialisé`);
      }
      
      fetchData();
    } catch (err) {
      console.error('[MJ] reset-player-token exception:', err);
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

  const openKickModal = (playerId: string, playerName: string) => {
    setSelectedPlayer({ id: playerId, name: playerName });
    setKickModalOpen(true);
  };

  // Editing functions
  const startEditing = (player: Player) => {
    setEditingId(player.id);
    setEditForm({
      display_name: player.display_name,
      player_number: player.player_number,
      jetons: player.jetons || 0,
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm({ display_name: '', player_number: null, jetons: 0 });
  };

  const handleSave = async (playerId: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('game_players')
        .update({
          display_name: editForm.display_name,
          player_number: editForm.player_number,
          jetons: editForm.jetons,
        })
        .eq('id', playerId);

      if (error) throw error;

      toast.success('Joueur mis à jour');
      setEditingId(null);
      setEditForm({ display_name: '', player_number: null, jetons: 0 });
      fetchData();
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  // Filter out the host (MJ) from players
  const activePlayers = players.filter(p => p.status === 'ACTIVE' && !p.is_host && p.player_number !== null);
  const alivePlayers = activePlayers.filter(p => p.is_alive !== false);
  const kickedPlayers = players.filter(p => p.status === 'REMOVED');
  const availablePlayerNumbers = Array.from({ length: 20 }, (_, i) => i + 1);
  // Lobby view
  if (game.status === 'LOBBY') {
    return (
      <div className={theme.container}>
      <div className={`${theme.header} p-3 sm:p-4`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="min-w-0">
                <h1 className="text-base sm:text-xl font-bold text-[#D4AF37] truncate">{game.name}</h1>
                <p className="text-xs sm:text-sm text-[#9CA3AF]">Code: {game.join_code}</p>
              </div>
            </div>
            <Badge className="bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/30 shrink-0">
              <Syringe className="h-3 w-3 sm:mr-1" />
              <span className="hidden sm:inline">INFECTION</span>
            </Badge>
          </div>
        </div>

        <div className="p-4 space-y-6">
          {/* Player list */}
          <div className={theme.card}>
            <div className="p-4 border-b border-[#2D3748]">
              <h2 className="font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-[#D4AF37]" />
                Joueurs en attente ({activePlayers.length})
              </h2>
            </div>
            <div className="p-4">
              {activePlayers.length === 0 ? (
                <p className="text-[#6B7280] text-center py-8">
                  En attente de joueurs...
                </p>
              ) : (
                <div className="space-y-2">
                  {activePlayers.map((player) => (
                    <div 
                      key={player.id}
                      className="p-3 bg-[#1A2235] rounded-lg"
                    >
                      {editingId === player.id ? (
                        // Edit mode
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                            <div>
                              <label className="text-xs text-[#6B7280]">Nom</label>
                              <Input
                                value={editForm.display_name}
                                onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })}
                                className="h-8 text-sm bg-[#0F1729] border-[#2D3748]"
                              />
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-1 gap-2">
                              <div>
                                <label className="text-xs text-[#6B7280]">Numéro</label>
                                <Select
                                  value={editForm.player_number?.toString() || ''}
                                  onValueChange={(val) => setEditForm({ ...editForm, player_number: parseInt(val) })}
                                >
                                  <SelectTrigger className="h-8 text-sm bg-[#0F1729] border-[#2D3748]">
                                    <SelectValue placeholder="#" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {availablePlayerNumbers.map(n => (
                                      <SelectItem key={n} value={n.toString()}>
                                        #{n}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <label className="text-xs text-[#6B7280]">Jetons</label>
                                <Input
                                  type="number"
                                  value={editForm.jetons}
                                  onChange={(e) => setEditForm({ ...editForm, jetons: parseInt(e.target.value) || 0 })}
                                  className="h-8 text-sm bg-[#0F1729] border-[#2D3748]"
                                />
                              </div>
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={cancelEditing}>
                              <X className="h-4 w-4 mr-1" />
                              Annuler
                            </Button>
                            <Button 
                              size="sm" 
                              onClick={() => handleSave(player.id)} 
                              disabled={saving}
                              className={theme.button}
                            >
                              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                              Sauvegarder
                            </Button>
                          </div>
                        </div>
                      ) : (
                        // View mode
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-[#D4AF37] font-mono">#{player.player_number}</span>
                            <span className="font-medium">{player.display_name}</span>
                            {player.clan && (
                              <Badge variant="outline" className="text-xs">
                                {player.clan}
                              </Badge>
                            )}
                            <span className="text-xs text-[#6B7280]">💰 {player.jetons || 0}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => startEditing(player)}
                              title="Modifier"
                              className="h-7 w-7 p-0"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            {player.player_token && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCopyJoinLink(player.id, player.player_token!)}
                                title="Copier le lien"
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
                              title="Reset token"
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
                              title="Expulser"
                            >
                              <UserX className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Role configuration (placeholder) */}
          <div className={theme.card}>
            <div className="p-4 border-b border-[#2D3748]">
              <h2 className="font-semibold flex items-center gap-2">
                <Settings className="h-4 w-4 text-[#D4AF37]" />
                Configuration des rôles
              </h2>
            </div>
            <div className="p-4">
              <p className="text-[#6B7280] text-sm mb-4">
                Composition par défaut selon le nombre de joueurs :
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(INFECTION_ROLE_LABELS).map(([code, info]) => (
                  <div key={code} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: info.color }}
                    />
                    <span>{info.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Kicked players */}
          {kickedPlayers.length > 0 && (
            <div className={`${theme.card} opacity-75`}>
              <div className="p-4 border-b border-[#2D3748]">
                <h2 className="font-semibold flex items-center gap-2 text-[#6B7280]">
                  <UserX className="h-4 w-4" />
                  Joueurs expulsés ({kickedPlayers.length})
                </h2>
              </div>
              <div className="p-4 space-y-1">
                {kickedPlayers.map((player) => (
                  <div key={player.id} className="text-sm text-[#6B7280] flex items-center gap-2">
                    <span>{player.display_name}</span>
                    <span className="text-xs">-</span>
                    <span className="text-xs text-[#B00020]">{player.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Start game button */}
          <Button 
            className={`w-full ${theme.button}`}
            size="lg"
            onClick={handleStartGame}
            disabled={activePlayers.length < 7}
          >
            <Play className="h-5 w-5 mr-2" />
            Lancer la partie ({activePlayers.length} joueurs)
          </Button>
          {activePlayers.length < 7 && (
            <p className="text-center text-[#6B7280] text-sm">
              Minimum 7 joueurs requis
            </p>
          )}
        </div>

        {/* Kick Modal for Lobby */}
        {selectedPlayer && (
          <KickPlayerModal
            open={kickModalOpen}
            onOpenChange={setKickModalOpen}
            playerId={selectedPlayer.id}
            playerName={selectedPlayer.name}
            gameId={game.id}
            onSuccess={fetchData}
          />
        )}
      </div>
    );
  }

  // In-game view
  return (
    <>
    <LandscapeModePrompt storageKey="mj-infection-landscape-dismissed" />
    <div className={theme.container}>
      {/* Header */}
      <div className={`${theme.header} p-3 sm:p-4`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold text-[#D4AF37] truncate">{game.name}</h1>
              <div className="flex items-center gap-2 text-xs sm:text-sm text-[#9CA3AF]">
                <span>M.{game.manche_active || 1}</span>
                {roundState && (
                  <Badge 
                    className={`text-xs ${
                      roundState.status === 'OPEN' ? 'bg-[#2AB3A6]/20 text-[#2AB3A6]' :
                      roundState.status === 'LOCKED' ? 'bg-[#E6A23C]/20 text-[#E6A23C]' :
                      'bg-[#6B7280]/20 text-[#6B7280]'
                    }`}
                  >
                    {roundState.status}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <Badge className="bg-[#2AB3A6]/20 text-[#2AB3A6] text-xs">
              {alivePlayers.length} <span className="hidden sm:inline">vivants</span>
            </Badge>
            <Badge className="bg-[#B00020]/20 text-[#B00020] text-xs">
              <Skull className="h-3 w-3 sm:mr-1" />
              <span className="hidden sm:inline">{activePlayers.length - alivePlayers.length}</span>
              <span className="sm:hidden">{activePlayers.length - alivePlayers.length}</span>
            </Badge>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
        <TabsList className="w-full bg-[#121A2B] border-b border-[#2D3748] rounded-none p-0 h-auto">
          <TabsTrigger value="control" className="flex-1 data-[state=active]:bg-[#1A2235] py-2 px-1 sm:px-3">
            <Activity className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Contrôle</span>
          </TabsTrigger>
          <TabsTrigger value="players" className="flex-1 data-[state=active]:bg-[#1A2235] py-2 px-1 sm:px-3">
            <Users className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Joueurs</span>
          </TabsTrigger>
          <TabsTrigger value="actions" className="flex-1 data-[state=active]:bg-[#1A2235] py-2 px-1 sm:px-3">
            <Target className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Actions</span>
          </TabsTrigger>
          <TabsTrigger value="chat" className="flex-1 data-[state=active]:bg-[#1A2235] py-2 px-1 sm:px-3">
            <MessageSquare className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Chats</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="control" className="p-4 space-y-4 mt-0">
          {/* Round control */}
          <div className={theme.card}>
            <div className="p-4 border-b border-[#2D3748]">
              <h2 className="font-semibold">Contrôle de la manche</h2>
            </div>
            <div className="p-4 space-y-4">
              {roundState?.status === 'OPEN' && (
                <Button 
                  className={`w-full ${theme.buttonDanger}`}
                  onClick={handleLockAndResolve}
                >
                  <Lock className="h-4 w-4 mr-2" />
                  Verrouiller et Résoudre
                </Button>
              )}
              {roundState?.status === 'RESOLVED' && (
                <Button 
                  className={`w-full ${theme.button}`}
                  onClick={handleNextRound}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Ouvrir manche suivante
                </Button>
              )}
              {!roundState && (
                <p className="text-center text-[#6B7280]">
                  Aucune manche active
                </p>
              )}
            </div>
          </div>

          {/* SY Progress */}
          {roundState && (
            <div className={theme.card}>
              <div className="p-4 border-b border-[#2D3748]">
                <h2 className="font-semibold text-[#2AB3A6]">Progression SY</h2>
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span>Recherches réussies</span>
                  <span className="font-bold text-[#2AB3A6]">
                    {roundState.sy_success_count} / {roundState.sy_required_success}
                  </span>
                </div>
                <div className="h-2 bg-[#1A2235] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#2AB3A6] transition-all"
                    style={{ 
                      width: `${(roundState.sy_success_count / roundState.sy_required_success) * 100}%` 
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="players" className="p-4 mt-0 space-y-4">
          <div className={theme.card}>
            <div className="p-4 border-b border-[#2D3748]">
              <h2 className="font-semibold">Joueurs ({activePlayers.length})</h2>
            </div>
            <div className="divide-y divide-[#2D3748]">
              {activePlayers.map(player => {
                const roleInfo = player.role_code ? INFECTION_ROLE_LABELS[player.role_code] : null;
                return (
                  <div key={player.id} className="p-4">
                    {editingId === player.id ? (
                      // Edit mode in-game
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                          <div>
                            <label className="text-xs text-[#6B7280]">Nom</label>
                            <Input
                              value={editForm.display_name}
                              onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })}
                              className="h-8 text-sm bg-[#0F1729] border-[#2D3748]"
                            />
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-1 gap-2">
                            <div>
                              <label className="text-xs text-[#6B7280]">Numéro</label>
                              <Input
                                type="number"
                                value={editForm.player_number || ''}
                                onChange={(e) => setEditForm({ ...editForm, player_number: parseInt(e.target.value) || null })}
                                className="h-8 text-sm bg-[#0F1729] border-[#2D3748]"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-[#6B7280]">Jetons</label>
                              <Input
                                type="number"
                                value={editForm.jetons}
                                onChange={(e) => setEditForm({ ...editForm, jetons: parseInt(e.target.value) || 0 })}
                                className="h-8 text-sm bg-[#0F1729] border-[#2D3748]"
                              />
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={cancelEditing}>
                            <X className="h-4 w-4 mr-1" />
                            Annuler
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={() => handleSave(player.id)} 
                            disabled={saving}
                            className={theme.button}
                          >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                            Sauvegarder
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // View mode in-game
                      <>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-[#D4AF37] font-mono">
                              #{player.player_number}
                            </span>
                            <span className={player.is_alive === false ? 'line-through text-[#6B7280]' : ''}>
                              {player.display_name}
                            </span>
                            {roleInfo && (
                              <Badge 
                                style={{ 
                                  backgroundColor: `${roleInfo.color}20`,
                                  color: roleInfo.color,
                                  borderColor: `${roleInfo.color}50`
                                }}
                              >
                                {roleInfo.short}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            {player.is_carrier && (
                              <Badge className="bg-[#B00020]/20 text-[#B00020]">Porteur</Badge>
                            )}
                            {player.is_contagious && (
                              <Badge className="bg-[#E6A23C]/20 text-[#E6A23C]">Contagieux</Badge>
                            )}
                            {player.immune_permanent && (
                              <Badge className="bg-[#2AB3A6]/20 text-[#2AB3A6]">Immunisé</Badge>
                            )}
                            {player.has_antibodies && (
                              <Badge className="bg-[#D4AF37]/20 text-[#D4AF37]">Anticorps</Badge>
                            )}
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <div className="flex items-center gap-4 text-xs text-[#6B7280]">
                            <span>💰 {player.jetons || 0} jetons</span>
                            <span>⭐ {player.pvic || 0} PVic</span>
                            {player.infected_at_manche && (
                              <span className="text-[#B00020]">
                                Infecté M{player.infected_at_manche}
                              </span>
                            )}
                          </div>
                          {/* Player management actions */}
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => startEditing(player)}
                              title="Modifier"
                              className="h-7 w-7 p-0"
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
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Kicked players in-game */}
          {kickedPlayers.length > 0 && (
            <div className={`${theme.card} opacity-75`}>
              <div className="p-4 border-b border-[#2D3748]">
                <h2 className="font-semibold flex items-center gap-2 text-[#6B7280]">
                  <UserX className="h-4 w-4" />
                  Joueurs expulsés ({kickedPlayers.length})
                </h2>
              </div>
              <div className="p-4 space-y-1">
                {kickedPlayers.map((player) => (
                  <div key={player.id} className="text-sm text-[#6B7280] flex items-center gap-2">
                    <span>{player.display_name}</span>
                    <span className="text-xs">-</span>
                    <span className="text-xs text-[#B00020]">{player.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="actions" className="p-4 mt-0">
          {game.current_session_game_id && (
            <div className="space-y-4">
              <MJRoundHistorySelector
                sessionGameId={game.current_session_game_id}
                currentManche={game.manche_active || 1}
                selectedManche={selectedManche}
                onSelectManche={setSelectedManche}
              />
              <MJActionsTab
                gameId={game.id}
                sessionGameId={game.current_session_game_id}
                manche={selectedManche}
                players={players}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="chat" className="p-4 mt-0">
          {game.current_session_game_id && (
            <MJChatsTab
              gameId={game.id}
              sessionGameId={game.current_session_game_id}
              players={players}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Kick Modal */}
      {selectedPlayer && (
        <KickPlayerModal
          open={kickModalOpen}
          onOpenChange={setKickModalOpen}
          playerId={selectedPlayer.id}
          playerName={selectedPlayer.name}
          gameId={game.id}
          onSuccess={fetchData}
        />
      )}
    </div>
    </>
  );
}
