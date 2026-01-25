import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { RefreshCw, Skull, X } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { INFECTION_COLORS, INFECTION_ROLE_LABELS } from '../InfectionTheme';
import logoNdogmoabeng from '@/assets/logo-ndogmoabeng.png';
import { InfectionCampfireCircle } from './InfectionCampfireCircle';
import { InfectionPatient0Timeline } from './InfectionPatient0Timeline';
import { InfectionRoleRoster } from './InfectionRoleRoster';
import { InfectionStatsPanel } from './InfectionStatsPanel';
import { InfectionDeathRevealAnimation } from './InfectionDeathRevealAnimation';
import { InfectionSYResearchProgress } from './InfectionSYResearchProgress';
import { InfectionVictoryPodium } from './InfectionVictoryPodium';
import { InfectionVictoryTransition } from './InfectionVictoryTransition';

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
  is_alive: boolean | null;
  is_host: boolean;
  role_code: string | null;
  team_code: string | null;
  user_id: string | null;
  pvic: number | null;
  mate_num: number | null;
}

interface RoundState {
  id: string;
  manche: number;
  status: string;
  resolved_at: string | null;
  sy_success_count: number | null;
  sy_required_success: number | null;
}

interface InfectionPresentationViewProps {
  game: Game;
  onClose: () => void;
}

export function InfectionPresentationView({ game: initialGame, onClose }: InfectionPresentationViewProps) {
  const isMobile = useIsMobile();
  const [game, setGame] = useState<Game>(initialGame);
  const [players, setPlayers] = useState<Player[]>([]);
  const [roundStates, setRoundStates] = useState<RoundState[]>([]);
  const [avatarUrls, setAvatarUrls] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [winner, setWinner] = useState<'SY' | 'PV' | null>(null);
  const [showVictoryTransition, setShowVictoryTransition] = useState(false);
  const [showVictoryPodium, setShowVictoryPodium] = useState(false);
  
  // Animation state for death reveal
  const [showDeathReveal, setShowDeathReveal] = useState(false);
  const [deathRevealPlayers, setDeathRevealPlayers] = useState<Array<{
    player_number: number;
    display_name: string;
    role_code: string | null;
    team_code: string | null;
    avatar_url?: string | null;
    pvic?: number | null;
  }>>([]);
  const [deathRevealManche, setDeathRevealManche] = useState(1);
  
  // Track resolved manches to detect new resolutions
  const previousResolvedCountRef = useRef<number>(0);
  const previousDeadPlayersRef = useRef<Set<number>>(new Set());

  const fetchData = useCallback(async () => {
    if (!game.id) return;
    
    // Fetch latest game state
    const { data: gameData } = await supabase
      .from('games')
      .select('id, name, status, manche_active, phase, current_session_game_id')
      .eq('id', game.id)
      .single();
    
    if (gameData) {
      setGame(gameData);
    }

    // Fetch players (exclude host)
    const { data: playersData } = await supabase
      .from('game_players')
      .select('id, display_name, player_number, is_alive, is_host, role_code, team_code, user_id, pvic, mate_num')
      .eq('game_id', game.id)
      .is('removed_at', null)
      .order('player_number', { ascending: true });

    let activePlayers: Player[] = [];
    let avatarMap = new Map<string, string>();

    if (playersData) {
      activePlayers = playersData.filter(p => !p.is_host && p.player_number !== null) as Player[];
      setPlayers(activePlayers);

      // Fetch avatar URLs for players with user_id
      const userIds = activePlayers.filter(p => p.user_id).map(p => p.user_id as string);
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, avatar_url')
          .in('id', userIds);

        if (profiles) {
          profiles.forEach(profile => {
            if (profile.avatar_url) {
              avatarMap.set(profile.id, profile.avatar_url);
            }
          });
          setAvatarUrls(avatarMap);
        }
      }
    }

    // Fetch round states for timeline and SY progress
    if (game.current_session_game_id) {
      const { data: roundData } = await supabase
        .from('infection_round_state')
        .select('id, manche, status, resolved_at, sy_success_count, sy_required_success')
        .eq('session_game_id', game.current_session_game_id)
        .order('manche', { ascending: true });

      if (roundData) {
        const resolvedRounds = roundData.filter(r => r.status === 'RESOLVED');
        const newResolvedCount = resolvedRounds.length;
        
        // Get the current dead players from DB (source of truth)
        const currentDeadPlayerNums = new Set(
          activePlayers.filter(p => p.is_alive === false).map(p => p.player_number!)
        );
        
        // Trigger death reveal animation if a new round was just resolved
        if (newResolvedCount > previousResolvedCountRef.current && previousResolvedCountRef.current > 0) {
          const lastResolvedManche = resolvedRounds[resolvedRounds.length - 1]?.manche || 1;
          
          // Identify newly dead players by comparing with previous state
          const newlyDeadPlayers = activePlayers.filter(p => 
            p.is_alive === false && 
            p.player_number !== null &&
            !previousDeadPlayersRef.current.has(p.player_number)
          );
          
          console.log('[DeathReveal] Previous dead:', Array.from(previousDeadPlayersRef.current));
          console.log('[DeathReveal] Current dead:', Array.from(currentDeadPlayerNums));
          console.log('[DeathReveal] Newly dead players:', newlyDeadPlayers.map(p => p.display_name));
          
          // Only show animation if there are newly dead players
          if (newlyDeadPlayers.length > 0) {
            // Build death reveal data with avatars
            const deathRevealData = newlyDeadPlayers.map(p => ({
              player_number: p.player_number!,
              display_name: p.display_name,
              role_code: p.role_code,
              team_code: p.team_code,
              avatar_url: p.user_id ? avatarMap.get(p.user_id) || null : null,
              pvic: p.pvic,
            }));
            
            setDeathRevealPlayers(deathRevealData);
            setDeathRevealManche(lastResolvedManche);
            setShowDeathReveal(true);
          }
        }
        
        // Always update the tracking refs after processing
        previousDeadPlayersRef.current = currentDeadPlayerNums;
        previousResolvedCountRef.current = newResolvedCount;
        setRoundStates(roundData as RoundState[]);
      }
      
      // Check for GAME_END event to get winner
      const { data: gameEndEvent } = await supabase
        .from('game_events')
        .select('message, payload')
        .eq('session_game_id', game.current_session_game_id)
        .eq('event_type', 'GAME_END')
        .maybeSingle();
      
      if (gameEndEvent && !winner) {
        const payload = gameEndEvent.payload as { winner?: string } | null;
        const winnerTeam = payload?.winner || (gameEndEvent.message?.includes('SY') ? 'SY' : 'PV');
        setWinner(winnerTeam as 'SY' | 'PV');
        setShowVictoryTransition(true);
      }
    }

    setLoading(false);
    setLastUpdate(new Date());
    setIsRefreshing(false);
  }, [game.id, game.current_session_game_id, game.manche_active, winner]);

  // Calculate deaths per round from player data
  useEffect(() => {
    fetchData();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`infection-presentation-${game.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${game.id}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${game.id}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'infection_round_state', filter: `game_id=eq.${game.id}` }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData, game.id]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    fetchData();
  };

  // Get alive/dead counts by role
  const roleStats = Object.keys(INFECTION_ROLE_LABELS).map(roleCode => {
    const rolePlayers = players.filter(p => p.role_code === roleCode);
    const alive = rolePlayers.filter(p => p.is_alive !== false).length;
    const dead = rolePlayers.filter(p => p.is_alive === false).length;
    return { roleCode, alive, dead, total: rolePlayers.length };
  });

  // Game stats
  const totalPlayers = players.length;
  const alivePlayers = players.filter(p => p.is_alive !== false).length;
  const deadPlayers = players.filter(p => p.is_alive === false).length;
  const currentManche = game.manche_active || 1;

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: INFECTION_COLORS.bgPrimary }}>
        <div className="text-center">
          <Skull className="h-16 w-16 mx-auto mb-4 animate-pulse" style={{ color: INFECTION_COLORS.accent }} />
          <p style={{ color: INFECTION_COLORS.textSecondary }}>Chargement...</p>
        </div>
      </div>
    );
  }

  // Show victory transition animation first
  if (showVictoryTransition && winner) {
    return (
      <InfectionVictoryTransition
        winner={winner}
        onComplete={() => {
          setShowVictoryTransition(false);
          setShowVictoryPodium(true);
        }}
      />
    );
  }

  // Show victory podium after transition
  if (showVictoryPodium && winner) {
    // Add avatar URLs to players for podium
    const playersWithAvatars = players.map(p => ({
      ...p,
      avatar_url: p.user_id ? avatarUrls.get(p.user_id) || null : null,
    }));
    
    return (
      <InfectionVictoryPodium
        players={playersWithAvatars}
        winner={winner}
        onClose={onClose}
      />
    );
  }

  return (
    <div 
      className="fixed inset-0 z-50 overflow-hidden"
      style={{ backgroundColor: INFECTION_COLORS.bgPrimary }}
    >
      {/* Death Reveal Animation */}
      <InfectionDeathRevealAnimation
        show={showDeathReveal}
        deadPlayers={deathRevealPlayers}
        manche={deathRevealManche}
        onComplete={() => setShowDeathReveal(false)}
      />

      {/* Header */}
      <div 
        className="absolute top-0 left-0 right-0 h-14 flex items-center justify-between px-4 z-40"
        style={{ backgroundColor: INFECTION_COLORS.bgSecondary, borderBottom: `1px solid ${INFECTION_COLORS.border}` }}
      >
        <div className="flex items-center gap-3">
          <Badge style={{ backgroundColor: INFECTION_COLORS.accent, color: INFECTION_COLORS.bgPrimary }} className="font-bold">
            INFECTION
          </Badge>
          <span className="font-medium hidden sm:inline" style={{ color: INFECTION_COLORS.textPrimary }}>{game.name}</span>
        </div>

        <div className="flex items-center gap-3">
          <Badge style={{ backgroundColor: INFECTION_COLORS.bgCard, color: INFECTION_COLORS.textSecondary, borderColor: INFECTION_COLORS.border }} className="border">
            Manche {currentManche}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="h-8 w-8"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} style={{ color: INFECTION_COLORS.textSecondary }} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" style={{ color: INFECTION_COLORS.textSecondary }} />
          </Button>
        </div>
      </div>

      {/* Mobile Layout */}
      {isMobile ? (
        <div className="pt-14 h-full flex flex-col">
          {/* SY Research Progress at top */}
          <div className="flex-shrink-0 p-2 pb-0">
            <InfectionSYResearchProgress
              roundStates={roundStates}
              isMobile={true}
            />
          </div>

          {/* Timeline */}
          <div className="flex-shrink-0 p-2">
            <InfectionPatient0Timeline
              roundStates={roundStates}
              currentManche={currentManche}
              players={players}
              isMobile={true}
            />
          </div>

          {/* Campfire Circle */}
          <div className="flex-1 min-h-0">
            <InfectionCampfireCircle
              players={players}
              avatarUrls={avatarUrls}
              isMobile={true}
            />
          </div>

          {/* Bottom Stats */}
          <div className="flex-shrink-0 p-2 flex gap-2">
            <div className="flex-1">
              <InfectionRoleRoster roleStats={roleStats} isMobile={true} />
            </div>
            <div className="flex-1">
              <InfectionStatsPanel
                totalPlayers={totalPlayers}
                alivePlayers={alivePlayers}
                deadPlayers={deadPlayers}
                currentManche={currentManche}
                roundStates={roundStates}
                isMobile={true}
              />
            </div>
          </div>
        </div>
      ) : (
        /* Desktop Layout */
        <div className="pt-14 h-full grid grid-cols-12 gap-4 p-4">
          {/* Left Panel - Role Roster */}
          <div className="col-span-2">
            <InfectionRoleRoster roleStats={roleStats} isMobile={false} />
          </div>

          {/* Center - Campfire + SY Progress + Timeline */}
          <div className="col-span-8 flex flex-col gap-4">
            {/* SY Research Progress at top */}
            <div className="flex-shrink-0">
              <InfectionSYResearchProgress
                roundStates={roundStates}
                isMobile={false}
              />
            </div>

            {/* Timeline */}
            <div className="flex-shrink-0">
              <InfectionPatient0Timeline
                roundStates={roundStates}
                currentManche={currentManche}
                players={players}
                isMobile={false}
              />
            </div>

            {/* Campfire Circle */}
            <div className="flex-1 min-h-0">
              <InfectionCampfireCircle
                players={players}
                avatarUrls={avatarUrls}
                isMobile={false}
              />
            </div>
          </div>

          {/* Right Panel - Stats */}
          <div className="col-span-2">
            <InfectionStatsPanel
              totalPlayers={totalPlayers}
              alivePlayers={alivePlayers}
              deadPlayers={deadPlayers}
              currentManche={currentManche}
              roundStates={roundStates}
              isMobile={false}
            />
          </div>
        </div>
      )}
    </div>
  );
}
