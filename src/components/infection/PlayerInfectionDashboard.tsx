import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeThrottle, useStableCallback } from '@/hooks/useRealtimeThrottle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Target, MessageSquare, Package, Activity, Syringe, Vote, Skull, RefreshCw, BookOpen, Eye, EyeOff } from 'lucide-react';
import { INFECTION_ROLE_LABELS, INFECTION_TEAM_LABELS, getInfectionThemeClasses } from './InfectionTheme';
import { InfectionActionPanel } from './InfectionActionPanel';
import { InfectionVotePanel } from './InfectionVotePanel';
import { InfectionChatPanel } from './InfectionChatPanel';
import { InfectionInventoryPanel } from './InfectionInventoryPanel';
import { InfectionEventsPanel } from './InfectionEventsPanel';
import { InfectionPrivateMessagesPanel } from './InfectionPrivateMessagesPanel';
import { InfectionGameEndScreen } from './InfectionGameEndScreen';
import { InfectionRoleRevealAnimation } from './InfectionRoleRevealAnimation';
import { InfectionRulesOverlay } from './rules/InfectionRulesOverlay';

// Victory conditions based on team - using team codes from INFECTION_ROLE_LABELS
// Teams: PV (Porte-Venin), SY (Synthétistes), NEUTRE (Agent État), CITOYEN
const TEAM_VICTORY_CONDITIONS: Record<string, string> = {
  'PV': 'Infecter et éliminer tous les joueurs pour prendre le contrôle du village.',
  'SY': 'Trouver l\'antidote avant que le virus ne tue tout le monde.',
  'NEUTRE': 'Survivre et accumuler des récompenses (corruption, soupçons).',
  'CITOYEN': 'Survivre jusqu\'à ce que les Synthétistes trouvent l\'antidote.',
};

interface Game {
  id: string;
  name: string;
  status: string;
  manche_active: number | null;
  phase: string;
  current_session_game_id: string | null;
}

interface Player {
  id: string;
  display_name: string;
  player_number: number | null;
  clan: string | null;
  jetons: number | null;
  pvic: number | null;
  is_alive: boolean | null;
  role_code: string | null;
  team_code: string | null;
  immune_permanent: boolean | null;
  is_host?: boolean;
}

interface RoundState {
  id: string;
  manche: number;
  status: string;
}

interface PlayerInfectionDashboardProps {
  game: Game;
  player: Player;
  onLeave?: () => void;
  animationsEnabled?: boolean;
}

export function PlayerInfectionDashboard({ game, player, onLeave, animationsEnabled = true }: PlayerInfectionDashboardProps) {
  const theme = getInfectionThemeClasses();
  
  const [roundState, setRoundState] = useState<RoundState | null>(null);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [activeTab, setActiveTab] = useState('actions');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRoleHidden, setIsRoleHidden] = useState(true);
  
  // Role reveal animation state
  const [showRoleReveal, setShowRoleReveal] = useState(false);
  const hasShownRevealRef = useRef(false);
  const [showRulesOverlay, setShowRulesOverlay] = useState(false);
  
  // Check if we should show the role reveal animation (first time entering with role assigned)
  useEffect(() => {
    if (player.role_code && !hasShownRevealRef.current) {
      const revealKey = `infection_role_revealed_${game.id}_${player.player_number}`;
      const hasSeenReveal = localStorage.getItem(revealKey);
      
      if (!hasSeenReveal) {
        if (animationsEnabled) {
          setShowRoleReveal(true);
        }
        hasShownRevealRef.current = true;
        localStorage.setItem(revealKey, 'true');
      } else {
        hasShownRevealRef.current = true;
      }
    }
  }, [player.role_code, game.id, player.player_number, animationsEnabled]);

  // Optimized fetchData with parallel queries
  // Defined BEFORE useRealtimeThrottle to avoid hoisting issues
  const fetchData = useCallback(async () => {
    // Parallel fetch: players + round state
    const [playersResult, roundResult] = await Promise.all([
      // Fetch players with minimal columns
      supabase
        .from('game_players')
        .select('id, display_name, player_number, clan, is_alive, role_code, team_code, jetons, pvic, is_host')
        .eq('game_id', game.id)
        .is('removed_at', null)
        .order('player_number'),
      // Fetch round state only if session exists
      game.current_session_game_id && game.manche_active
        ? supabase
            .from('infection_round_state')
            .select('id, manche, status')
            .eq('session_game_id', game.current_session_game_id)
            .eq('manche', game.manche_active)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    if (playersResult.data) {
      setAllPlayers(playersResult.data as Player[]);
    }
    if (roundResult.data) {
      setRoundState(roundResult.data as RoundState);
    }
  }, [game.id, game.current_session_game_id, game.manche_active]);

  // Memoize fetch params to detect changes
  const fetchParams = useMemo(() => ({
    gameId: game.id,
    sessionGameId: game.current_session_game_id,
    mancheActive: game.manche_active,
  }), [game.id, game.current_session_game_id, game.manche_active]);

  // Stable callback ref to prevent stale closures in realtime handlers
  const stableFetchData = useStableCallback(fetchData);
  
  // Throttled fetch to avoid refetch storms from rapid realtime events
  // Groups events within 250ms and executes once
  const { throttledFn: throttledFetch, cancel: cancelThrottle } = useRealtimeThrottle(stableFetchData, 250);

  useEffect(() => {
    // Initial fetch
    stableFetchData();
    
    // Optimized realtime subscriptions - throttled to avoid refetch storms
    const channel = supabase
      .channel(`infection-player-${game.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${game.id}` }, 
        (payload) => {
          // Skip if only last_seen changed (presence heartbeat)
          if (payload.new && payload.old) {
            const newPlayer = payload.new as any;
            const oldPlayer = payload.old as any;
            if (newPlayer.last_seen !== oldPlayer.last_seen && 
                newPlayer.is_alive === oldPlayer.is_alive &&
                newPlayer.role_code === oldPlayer.role_code) {
              return;
            }
          }
          throttledFetch();
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'infection_round_state', filter: `game_id=eq.${game.id}` }, throttledFetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'infection_inputs', filter: `game_id=eq.${game.id}` }, throttledFetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'infection_shots', filter: `game_id=eq.${game.id}` }, throttledFetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${game.id}` }, throttledFetch)
      .subscribe();

    return () => {
      cancelThrottle();
      supabase.removeChannel(channel);
    };
  }, [game.id, stableFetchData, throttledFetch, cancelThrottle]);

  // Re-fetch when critical game params change
  useEffect(() => {
    stableFetchData();
  }, [fetchParams, stableFetchData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Use INFECTION_ROLE_LABELS as single source of truth for role details
  const roleInfo = player.role_code ? INFECTION_ROLE_LABELS[player.role_code] : null;
  const isLocked = roundState?.status !== 'OPEN';
  
  // Get team info and victory condition from centralized theme config
  const teamCode = roleInfo?.team || player.team_code || null;
  const teamInfo = teamCode ? INFECTION_TEAM_LABELS[teamCode] : null;
  const victoryCondition = teamCode ? TEAM_VICTORY_CONDITIONS[teamCode] : '';

  // Role reveal animation overlay - use roleInfo from INFECTION_ROLE_LABELS
  if (showRoleReveal && player.role_code && roleInfo) {
    return (
      <InfectionRoleRevealAnimation
        roleCode={player.role_code}
        roleName={roleInfo.name}
        teamName={teamInfo?.name || roleInfo.team}
        victoryCondition={victoryCondition}
        playerName={player.display_name}
        onComplete={() => setShowRoleReveal(false)}
      />
    );
  }

  // Lobby
  if (game.status === 'LOBBY') {
    return (
      <div className={theme.container}>
        <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
          <Syringe className="h-16 w-16 text-[#D4AF37] mb-6 animate-pulse" />
          <h1 className="text-2xl font-bold text-[#D4AF37] mb-2">Infection à Ndogmoabeng</h1>
          <p className="text-[#9CA3AF] mb-4">En attente du lancement...</p>
          <div className={theme.card + ' p-4'}>
            <p className="text-sm text-[#6B7280]">Connecté en tant que</p>
            <p className="text-lg font-bold mt-1">{player.display_name}</p>
            {player.clan && <Badge variant="outline" className="mt-2">{player.clan}</Badge>}
          </div>
        </div>
      </div>
    );
  }

  // Game ended
  if (game.status === 'ENDED' && game.current_session_game_id) {
    return (
      <InfectionGameEndScreen
        gameId={game.id}
        sessionGameId={game.current_session_game_id}
        player={player}
      />
    );
  }

  // Dead
  if (player.is_alive === false) {
    return (
      <div className={theme.container}>
        <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
          <Skull className="h-16 w-16 text-[#B00020] mb-6" />
          <h1 className="text-2xl font-bold text-[#B00020] mb-2">Vous êtes mort</h1>
          {roleInfo && (
            <Badge className="text-lg px-4 py-2" style={{ backgroundColor: `${roleInfo.color}20`, color: roleInfo.color }}>
              Vous étiez: {roleInfo.name}
            </Badge>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
    <InfectionRulesOverlay 
      open={showRulesOverlay} 
      onClose={() => setShowRulesOverlay(false)}
      userRole="PLAYER"
      gameId={game.id}
      sessionGameId={game.current_session_game_id || undefined}
    />
    <div className={`${theme.container} flex flex-col h-screen`}>
      {/* Header */}
      <div className={`${theme.header} p-4`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-[#D4AF37]">Manche {game.manche_active || 1}</h1>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-[#9CA3AF]">{player.display_name}</span>
              {roleInfo && (
                <button
                  onClick={() => setIsRoleHidden(!isRoleHidden)}
                  className="flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"
                >
                  <Badge style={{ 
                    backgroundColor: isRoleHidden ? '#374151' : `${roleInfo.color}20`, 
                    color: isRoleHidden ? '#9CA3AF' : roleInfo.color 
                  }}>
                    {isRoleHidden ? '•••' : roleInfo.name}
                  </Badge>
                  {isRoleHidden ? (
                    <EyeOff className="h-3 w-3 text-[#6B7280]" />
                  ) : (
                    <Eye className="h-3 w-3 text-[#6B7280]" />
                  )}
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowRulesOverlay(true)}
              className="h-8 w-8 text-[#9CA3AF] hover:text-[#D4AF37]"
            >
              <BookOpen className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-8 w-8 text-[#9CA3AF] hover:text-[#D4AF37]"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Badge className="bg-[#1A2235] border-[#D4AF37]/30 text-[#D4AF37]">💰 {player.jetons || 0}</Badge>
            <Badge className="bg-[#1A2235] border-[#2AB3A6]/30 text-[#2AB3A6]">⭐ {player.pvic || 0}</Badge>
          </div>
        </div>
        {roundState && (
          <Badge className={`mt-2 ${roundState.status === 'OPEN' ? 'bg-[#2AB3A6]/20 text-[#2AB3A6]' : 'bg-[#E6A23C]/20 text-[#E6A23C]'}`}>
            {roundState.status === 'OPEN' ? '🟢 Actions ouvertes' : '🔒 Résolution en cours'}
          </Badge>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="w-full bg-[#121A2B] border-b border-[#2D3748] rounded-none p-0 h-auto shrink-0">
          <TabsTrigger value="actions" className="flex-1 py-3"><Target className="h-4 w-4" /></TabsTrigger>
          <TabsTrigger value="votes" className="flex-1 py-3"><Vote className="h-4 w-4" /></TabsTrigger>
          <TabsTrigger value="chat" className="flex-1 py-3"><MessageSquare className="h-4 w-4" /></TabsTrigger>
          <TabsTrigger value="inventory" className="flex-1 py-3"><Package className="h-4 w-4" /></TabsTrigger>
          <TabsTrigger value="events" className="flex-1 py-3"><Activity className="h-4 w-4" /></TabsTrigger>
        </TabsList>

        <TabsContent value="actions" className="flex-1 p-4 mt-0 overflow-auto">
          <InfectionActionPanel
            gameId={game.id}
            sessionGameId={game.current_session_game_id!}
            manche={game.manche_active || 1}
            player={player}
            allPlayers={allPlayers}
            isLocked={isLocked}
          />
        </TabsContent>

        <TabsContent value="votes" className="flex-1 p-4 mt-0 overflow-auto">
          <InfectionVotePanel
            gameId={game.id}
            sessionGameId={game.current_session_game_id!}
            manche={game.manche_active || 1}
            player={player}
            allPlayers={allPlayers}
            isLocked={isLocked}
          />
        </TabsContent>

        <TabsContent value="chat" className="flex-1 mt-0 overflow-hidden">
          <InfectionChatPanel gameId={game.id} sessionGameId={game.current_session_game_id!} player={player} />
        </TabsContent>

        <TabsContent value="inventory" className="flex-1 p-4 mt-0 overflow-auto">
          <div className="space-y-4">
            <InfectionInventoryPanel sessionGameId={game.current_session_game_id!} player={player} />
            <InfectionPrivateMessagesPanel 
              gameId={game.id} 
              sessionGameId={game.current_session_game_id!} 
              player={player} 
            />
          </div>
        </TabsContent>

        <TabsContent value="events" className="flex-1 p-4 mt-0 overflow-auto">
          <InfectionEventsPanel gameId={game.id} sessionGameId={game.current_session_game_id!} />
        </TabsContent>
      </Tabs>
    </div>
    </>
  );
}
