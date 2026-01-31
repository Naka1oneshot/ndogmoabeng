import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { 
  Ship, Anchor, Waves, Trophy, Users, CheckCircle, Clock, 
  AlertTriangle, RefreshCw, Coins, Target, Skull, X, BookOpen
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { calculateDangerRange, formatDangerRangeDisplay } from '@/lib/rivieresDangerCalculator';
import logoNdogmoabeng from '@/assets/logo-ndogmoabeng.png';
import { BoatProgressBar } from './BoatProgressBar';
import { RivieresLockAnimation } from './RivieresLockAnimation';
import { RivieresResolveAnimation } from './RivieresResolveAnimation';
import { RivieresVictoryPodium } from './RivieresVictoryPodium';
import { RivieresPlayerSortAnimation } from './RivieresPlayerSortAnimation';
import { AdventureCinematicOverlay } from '@/components/adventure/AdventureCinematicOverlay';
import { useAdventureCinematic, getSequenceForGameType } from '@/hooks/useAdventureCinematic';
import { RivieresAutoCountdownOverlay } from '../RivieresAutoCountdownOverlay';
import { RivieresRulesOverlay } from '../rules/RivieresRulesOverlay';
import { PresentationPvicDetailsSheet } from '@/components/presentation/PresentationPvicDetailsSheet';
import { useAdventurePotPrize } from '@/hooks/useAdventurePotPrize';

const LA_CARTE_TROUVEE_ID = 'a1b2c3d4-5678-9012-3456-789012345678';

interface Game {
  id: string;
  name: string;
  status: string;
  current_session_game_id: string | null;
}

interface RiverSessionState {
  id: string;
  manche_active: number;
  niveau_active: number;
  cagnotte_manche: number;
  danger_raw: number | null;
  danger_effectif: number | null;
  status: string;
  auto_mode?: boolean;
  auto_countdown_ends_at?: string | null;
  auto_countdown_active?: boolean;
}

interface RiverLevelHistory {
  id: string;
  manche: number;
  niveau: number;
  outcome: 'SUCCESS' | 'FAIL';
  danger_effectif: number;
  total_mises: number;
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

interface RiverDecision {
  id: string;
  player_id: string;
  player_num: number;
  decision: string;
  mise_demandee: number;
  mise_effective: number | null;
  keryndes_choice: string;
  status: string;
}

interface HistoricalDecision {
  player_id: string;
  player_num: number;
  decision: string;
  mise_effective: number | null;
  manche: number;
  niveau: number;
}

interface Player {
  id: string;
  display_name: string;
  player_number: number | null;
  jetons: number;
  clan: string | null;
  avatar_url: string | null;
}

interface StageScore {
  game_player_id: string;
  score_value: number;
  details: {
    validated_levels: number;
    jetons_end: number;
    penalty_applied: boolean;
  };
}

interface RivieresPresentationViewProps {
  game: Game;
  onClose: () => void;
}

export function RivieresPresentationView({ game, onClose }: RivieresPresentationViewProps) {
  const [sessionState, setSessionState] = useState<RiverSessionState | null>(null);
  const [levelHistory, setLevelHistory] = useState<RiverLevelHistory[]>([]);
  const [playerStats, setPlayerStats] = useState<RiverPlayerStats[]>([]);
  const [decisions, setDecisions] = useState<RiverDecision[]>([]);
  const [allDecisions, setAllDecisions] = useState<HistoricalDecision[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [stageScores, setStageScores] = useState<StageScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showRulesOverlay, setShowRulesOverlay] = useState(false);
  const [adventureInfo, setAdventureInfo] = useState<{ mode: string; adventure_id: string | null } | null>(null);

  // Animation states
  const [showLockAnimation, setShowLockAnimation] = useState(false);
  const [showResolveAnimation, setShowResolveAnimation] = useState(false);
  const [showPlayerSortAnimation, setShowPlayerSortAnimation] = useState(false);
  const [resolveAnimationData, setResolveAnimationData] = useState<{
    danger: number;
    totalMises: number;
    outcome: 'SUCCESS' | 'FAIL';
    niveau: number;
    manche: number;
  } | null>(null);
  const [playerSortData, setPlayerSortData] = useState<{
    id: string;
    display_name: string;
    avatar_url: string | null;
    decision: 'RESTE' | 'DESCENDS';
  }[]>([]);

  // Animation lock refs - prevent re-triggering during animation playback
  const lockAnimationTriggeredRef = useRef(false);
  const resolveAnimationTriggeredRef = useRef(false);
  const hasBroadcastCinematicRef = useRef(false);
  
  // Previous state refs for detecting changes
  const previousDecisionsLockedRef = useRef<boolean>(false);
  const previousLevelHistoryCountRef = useRef<number>(0);
  const previousDangerEffectifRef = useRef<number | null>(null);
  const previousLevelKeyRef = useRef<string>('');

  // Check if this is ANY adventure mode (not just "La carte trouvée")
  const isAdventureMode = adventureInfo?.mode === 'ADVENTURE';
  const isLaCarteTrouvee = isAdventureMode && adventureInfo?.adventure_id === LA_CARTE_TROUVEE_ID;

  // Adventure cinematic hook - enabled for ANY adventure mode
  const {
    isOpen: isCinematicOpen,
    currentSequence: cinematicSequence,
    closeOverlay: closeCinematic,
    replayLocal: replayCinematic,
    broadcastCinematic,
    debugState: cinematicDebugState,
  } = useAdventureCinematic(isAdventureMode ? game.id : undefined, {
    enabled: isAdventureMode,
  });

  console.log('[RIVIERES][PRESENTATION] Adventure info:', {
    mode: adventureInfo?.mode,
    adventure_id: adventureInfo?.adventure_id,
    isAdventureMode,
    isLaCarteTrouvee,
  });

  // Fetch adventure info on mount
  useEffect(() => {
    const fetchAdventureInfo = async () => {
      const { data } = await supabase
        .from('games')
        .select('mode, adventure_id')
        .eq('id', game.id)
        .single();
      if (data) {
        setAdventureInfo({ mode: data.mode, adventure_id: data.adventure_id });
      }
    };
    fetchAdventureInfo();
  }, [game.id]);

  // Auto-broadcast cinematic when opening presentation for ANY adventure
  useEffect(() => {
    if (isAdventureMode && !hasBroadcastCinematicRef.current && !loading) {
      hasBroadcastCinematicRef.current = true;
      const sequence = getSequenceForGameType('RIVIERES', true);
      console.log('[RIVIERES][PRESENTATION] Broadcasting cinematic sequence:', sequence);
      if (sequence.length > 0) {
        broadcastCinematic(sequence);
      }
    }
  }, [isAdventureMode, loading, broadcastCinematic]);

  const fetchData = useCallback(async () => {
    if (!game.current_session_game_id) {
      setLoading(false);
      return;
    }

    const sessionGameId = game.current_session_game_id;

    // Fetch session state
    const { data: stateData } = await supabase
      .from('river_session_state')
      .select('*')
      .eq('session_game_id', sessionGameId)
      .single();

    if (stateData) {
      // Check if danger just got set to trigger player sort animation
      if (stateData.danger_effectif !== null && previousDangerEffectifRef.current === null) {
        // Danger was just set - we need to prepare the player sort animation
        // This will be triggered after the lock animation completes
      }
      previousDangerEffectifRef.current = stateData.danger_effectif;
      setSessionState(stateData);
    }

    // Fetch level history
    const { data: historyData } = await supabase
      .from('river_level_history')
      .select('id, manche, niveau, outcome, danger_effectif, total_mises')
      .eq('session_game_id', sessionGameId)
      .order('resolved_at', { ascending: true });

    if (historyData) {
      // Check for new level resolution to trigger animation
      const latestLevel = historyData[historyData.length - 1];
      const currentLevelKey = latestLevel ? `${latestLevel.manche}-${latestLevel.niveau}` : '';
      
      // Only trigger if this is a NEW level we haven't animated yet
      if (historyData.length > 0 && 
          currentLevelKey !== previousLevelKeyRef.current && 
          !resolveAnimationTriggeredRef.current) {
        
        resolveAnimationTriggeredRef.current = true;
        previousLevelKeyRef.current = currentLevelKey;
        
        setResolveAnimationData({
          danger: latestLevel.danger_effectif,
          totalMises: latestLevel.total_mises,
          outcome: latestLevel.outcome as 'SUCCESS' | 'FAIL',
          niveau: latestLevel.niveau,
          manche: latestLevel.manche,
        });
        setShowResolveAnimation(true);
      }
      
      setLevelHistory(historyData as RiverLevelHistory[]);
    }

    // Fetch player stats
    const { data: statsData } = await supabase
      .from('river_player_stats')
      .select('*')
      .eq('session_game_id', sessionGameId)
      .order('player_num');

    if (statsData) setPlayerStats(statsData);

    // Fetch current decisions
    if (stateData) {
      const { data: decisionsData } = await supabase
        .from('river_decisions')
        .select('*')
        .eq('session_game_id', sessionGameId)
        .eq('manche', stateData.manche_active)
        .eq('niveau', stateData.niveau_active);

      if (decisionsData) {
        // Check if all just got locked to trigger animation
        const allLocked = decisionsData.length > 0 && decisionsData.every(d => d.status === 'LOCKED');
        const wasLocked = previousDecisionsLockedRef.current;
        
        // Only trigger lock animation if:
        // 1. All decisions are now locked
        // 2. They weren't locked before
        // 3. We haven't already triggered this animation
        if (allLocked && !wasLocked && !lockAnimationTriggeredRef.current) {
          lockAnimationTriggeredRef.current = true;
          previousDecisionsLockedRef.current = true;
          
          // Prepare player sort animation data NOW before triggering lock animation
          const { data: freshPlayersData } = await supabase
            .from('game_players')
            .select('id, display_name, player_number, user_id')
            .eq('game_id', game.id)
            .eq('status', 'ACTIVE')
            .eq('is_host', false);
          
          // Get avatars for authenticated users
          const userIds = (freshPlayersData || []).filter(p => p.user_id).map(p => p.user_id);
          let avatarMap = new Map<string, string>();
          if (userIds.length > 0) {
            const { data: profilesData } = await supabase
              .from('profiles')
              .select('user_id, avatar_url')
              .in('user_id', userIds);
            if (profilesData) {
              avatarMap = new Map(profilesData.map(p => [p.user_id, p.avatar_url]));
            }
          }
          
          const sortData = decisionsData.map(d => {
            const player = (freshPlayersData || []).find(p => p.id === d.player_id);
            return {
              id: d.player_id,
              display_name: player?.display_name ?? `Joueur ${d.player_num}`,
              avatar_url: player?.user_id ? (avatarMap.get(player.user_id) || null) : null,
              decision: d.decision as 'RESTE' | 'DESCENDS',
            };
          });
          setPlayerSortData(sortData);
          setShowLockAnimation(true);
        } else if (!allLocked) {
          // Reset locked state when decisions are no longer locked (new level)
          previousDecisionsLockedRef.current = false;
        }
        
        setDecisions(decisionsData);
      }
    }

    // Fetch players with avatars
    const { data: playersData } = await supabase
      .from('game_players')
      .select('id, display_name, player_number, jetons, clan, user_id')
      .eq('game_id', game.id)
      .eq('status', 'ACTIVE')
      .eq('is_host', false)
      .order('player_number');

    if (playersData) {
      const userIds = playersData.filter(p => p.user_id).map(p => p.user_id);
      let avatarMap = new Map<string, string>();
      
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, avatar_url')
          .in('user_id', userIds);
        if (profilesData) {
          avatarMap = new Map(profilesData.map(p => [p.user_id, p.avatar_url]));
        }
      }

      setPlayers(playersData.map(p => ({
        ...p,
        avatar_url: p.user_id ? (avatarMap.get(p.user_id) || null) : null,
      })));
    }

    // Fetch stage scores
    const { data: scoresData } = await supabase
      .from('stage_scores')
      .select('game_player_id, score_value, details')
      .eq('session_game_id', sessionGameId);

    if (scoresData) setStageScores(scoresData as StageScore[]);

    // Fetch ALL decisions for stats (for victory podium)
    const { data: allDecisionsData } = await supabase
      .from('river_decisions')
      .select('player_id, player_num, decision, mise_effective, manche, niveau')
      .eq('session_game_id', sessionGameId)
      .eq('status', 'LOCKED');
    
    if (allDecisionsData) {
      setAllDecisions(allDecisionsData as HistoricalDecision[]);
    }

    setLastUpdate(new Date());
    setLoading(false);
    setIsRefreshing(false);
  }, [game.id, game.current_session_game_id]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
  };

  useEffect(() => {
    fetchData();

    if (!game.current_session_game_id) return;

    const sessionGameId = game.current_session_game_id;

    const channel = supabase
      .channel(`rivieres-presentation-${game.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'river_session_state', filter: `session_game_id=eq.${sessionGameId}` },
        () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'river_player_stats', filter: `session_game_id=eq.${sessionGameId}` },
        () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'river_decisions', filter: `session_game_id=eq.${sessionGameId}` },
        () => fetchData())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'river_level_history', filter: `session_game_id=eq.${sessionGameId}` },
        () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${game.id}` },
        () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stage_scores', filter: `session_game_id=eq.${sessionGameId}` },
        () => fetchData())
      .subscribe();

    // Handle escape key to close
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [game.id, game.current_session_game_id, fetchData, onClose]);

  // Build ranking
  const getPlayerById = (id: string) => players.find(p => p.id === id);
  const getStatsByPlayerId = (id: string) => playerStats.find(s => s.player_id === id);
  const getScoreByPlayerId = (id: string) => stageScores.find(s => s.game_player_id === id);

  const buildRanking = () => {
    return players
      .map(p => {
        const stats = getStatsByPlayerId(p.id);
        const score = getScoreByPlayerId(p.id);
        const validatedLevels = stats?.validated_levels ?? 0;
        const jetons = p.jetons;
        
        // Calculate potential score if game not ended
        const potentialScore = score?.score_value ?? (validatedLevels >= 9 ? jetons : Math.round((validatedLevels * jetons) / 9));
        
        return {
          ...p,
          validated_levels: validatedLevels,
          current_status: stats?.current_round_status ?? 'EN_BATEAU',
          score_value: potentialScore,
          penalty_applied: score?.details?.penalty_applied ?? false,
        };
      })
      .sort((a, b) => b.score_value - a.score_value);
  };

  const ranking = buildRanking();

  // Build decisions status
  const enBateauPlayers = playerStats.filter(s => s.current_round_status === 'EN_BATEAU');
  const lockedDecisions = decisions.filter(d => d.status === 'LOCKED');
  const draftDecisions = decisions.filter(d => d.status === 'DRAFT');
  
  // "Choix effectué" = players with any decision (DRAFT or LOCKED)
  const playersWithDecision = players.filter(p => {
    const decision = decisions.find(d => d.player_id === p.id);
    return decision !== undefined;
  });
  
  // "En attente de décision" = en bateau players WITHOUT any decision
  const pendingPlayers = enBateauPlayers
    .map(s => players.find(p => p.id === s.player_id))
    .filter((p): p is Player => !!p && !decisions.some(d => d.player_id === p.id));

  // Calculate danger range for display
  const dangerRange = sessionState ? 
    calculateDangerRange(enBateauPlayers.length, sessionState.manche_active, sessionState.niveau_active) : null;

  const isGameEnded = sessionState?.status === 'ENDED' || game.status === 'ENDED';
  
  // Check if all decisions are locked (for showing different UI)
  const allDecisionsLocked = lockedDecisions.length > 0 && lockedDecisions.length === enBateauPlayers.length;

  // Send animation ACK to DB for auto mode handshake
  const sendAnimationAck = useCallback(async (animType: 'LOCK_ANIM' | 'RESOLVE_ANIM') => {
    if (!game.current_session_game_id) return;
    
    try {
      // Check if auto mode is waiting for this animation
      const { data } = await supabase
        .from('river_session_state')
        .select('auto_waiting_for')
        .eq('session_game_id', game.current_session_game_id)
        .single();
      
      if (data?.auto_waiting_for === animType) {
        await supabase
          .from('river_session_state')
          .update({ auto_anim_ack_at: new Date().toISOString() })
          .eq('session_game_id', game.current_session_game_id);
        console.log(`[Presentation] Sent ACK for ${animType}`);
      }
    } catch (error) {
      console.error(`[Presentation] Error sending ACK for ${animType}:`, error);
    }
  }, [game.current_session_game_id]);

  // Handle lock animation complete - chain to player sort
  const handleLockAnimationComplete = useCallback(() => {
    setShowLockAnimation(false);
    
    // Send ACK for auto mode handshake
    sendAnimationAck('LOCK_ANIM');
    
    // Player sort data is already prepared when lock was triggered
    // Just show the animation if we have data
    if (playerSortData.length > 0) {
      setShowPlayerSortAnimation(true);
    }
  }, [playerSortData.length, sendAnimationAck]);

  // Handle player sort animation complete - reset lock trigger for next level
  const handlePlayerSortComplete = useCallback(() => {
    setShowPlayerSortAnimation(false);
    // Reset lock animation trigger so it can fire again for the next level
    lockAnimationTriggeredRef.current = false;
  }, []);

  // Handle resolve animation complete - reset trigger for next resolution
  const handleResolveComplete = useCallback(() => {
    setShowResolveAnimation(false);
    // Reset resolve animation trigger so it can fire again
    resolveAnimationTriggeredRef.current = false;
    
    // Send ACK for auto mode handshake
    sendAnimationAck('RESOLVE_ANIM');
  }, [sendAnimationAck]);

  // Loading state
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-gradient-to-br from-[#0B1020] via-[#151B2D] to-[#0B1020] flex items-center justify-center">
        <div className="text-center">
          <Ship className="h-16 w-16 text-[#D4AF37] mx-auto mb-4 animate-bounce" />
          <p className="text-[#E8E8E8] text-xl">Chargement...</p>
        </div>
      </div>
    );
  }

  // Victory podium for ended games
  if (isGameEnded && stageScores.length > 0) {
    return (
      <RivieresVictoryPodium
        ranking={ranking}
        levelHistory={levelHistory}
        allDecisions={allDecisions}
        players={players}
        onClose={onClose}
      />
    );
  }

  if (!sessionState) {
    return (
      <div className="fixed inset-0 z-50 bg-gradient-to-br from-[#0B1020] via-[#151B2D] to-[#0B1020] flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-16 w-16 text-amber-400 mx-auto mb-4" />
          <p className="text-[#E8E8E8] text-xl">Session Rivières non initialisée</p>
        </div>
      </div>
    );
  }


  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-[#0B1020] via-[#151B2D] to-[#0B1020] overflow-hidden">
      {/* Adventure Cinematic Overlay */}
      {isLaCarteTrouvee && (
        <AdventureCinematicOverlay
          open={isCinematicOpen}
          sequence={cinematicSequence}
          onClose={closeCinematic}
          onReplay={replayCinematic}
          isHost={true}
          onBroadcastReplay={() => {
            const sequence = getSequenceForGameType('RIVIERES', true);
            if (sequence.length > 0) broadcastCinematic(sequence);
          }}
        />
      )}

      {/* Auto Mode Countdown Overlay */}
      {sessionState?.auto_countdown_active && sessionState.auto_countdown_ends_at && (
        <RivieresAutoCountdownOverlay
          countdownEndsAt={new Date(sessionState.auto_countdown_ends_at)}
          isActive={sessionState.auto_countdown_active}
          isHost={true}
        />
      )}

      {/* Lock Animation Overlay */}
      {showLockAnimation && (
        <RivieresLockAnimation onComplete={handleLockAnimationComplete} />
      )}

      {/* Player Sort Animation Overlay */}
      {showPlayerSortAnimation && playerSortData.length > 0 && (
        <RivieresPlayerSortAnimation
          players={playerSortData}
          onComplete={handlePlayerSortComplete}
        />
      )}

      {/* Resolve Animation Overlay */}
      {showResolveAnimation && resolveAnimationData && (
        <RivieresResolveAnimation
          danger={resolveAnimationData.danger}
          totalMises={resolveAnimationData.totalMises}
          outcome={resolveAnimationData.outcome}
          niveau={resolveAnimationData.niveau}
          manche={resolveAnimationData.manche}
          onComplete={handleResolveComplete}
        />
      )}

      {/* Header - Mobile optimized */}
      <div className="absolute top-0 left-0 right-0 bg-[#0B1020]/80 backdrop-blur border-b border-[#D4AF37]/20 z-10">
        {/* Main header row */}
        <div className="flex items-center justify-between px-3 md:px-6 h-12 md:h-14">
          <div className="flex items-center gap-2 md:gap-3">
            <img src={logoNdogmoabeng} alt="Logo" className="h-8 w-8 md:h-10 md:w-10" />
            <div>
              <h1 className="text-sm md:text-lg font-bold text-[#D4AF37] truncate max-w-[120px] md:max-w-none">{game.name}</h1>
              <p className="text-[10px] md:text-xs text-[#9CA3AF]">RIVIÈRES • M{sessionState.manche_active}/3 N{sessionState.niveau_active}</p>
            </div>
          </div>

          {/* Right side controls */}
          <div className="flex items-center gap-1 md:gap-3">
            <span className="hidden md:block text-xs text-[#9CA3AF]">
              {format(lastUpdate, 'HH:mm:ss', { locale: fr })}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowRulesOverlay(true)}
              className="h-8 w-8 text-[#9CA3AF] hover:text-[#D4AF37]"
              title="Règles du jeu"
            >
              <BookOpen className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="h-8 w-8 text-[#9CA3AF] hover:text-[#D4AF37]"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 text-[#9CA3AF] hover:text-red-400"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Rules Overlay */}
        <RivieresRulesOverlay
          open={showRulesOverlay}
          onClose={() => setShowRulesOverlay(false)}
        />

        {/* Stats bar - compact on mobile */}
        <div className="flex items-center justify-center gap-3 md:gap-6 px-3 pb-2 md:pb-3">
          {/* Danger Range */}
          <div className="text-center">
            <div className="text-[10px] md:text-xs text-[#9CA3AF]">Plage</div>
            <div className="text-sm md:text-xl font-bold text-amber-400">
              {dangerRange ? formatDangerRangeDisplay(dangerRange.range) : '—'}
            </div>
          </div>

          {/* Validated Danger */}
          {sessionState.danger_effectif !== null && (
            <div className="text-center bg-red-900/30 border border-red-500/50 rounded-lg px-2 md:px-4 py-1 md:py-2">
              <div className="text-[10px] md:text-xs text-red-300">Danger</div>
              <div className="text-lg md:text-2xl font-bold text-red-400">
                {sessionState.danger_effectif}
              </div>
            </div>
          )}

          {/* Cagnotte */}
          <div className="text-center">
            <div className="text-[10px] md:text-xs text-[#9CA3AF]">Cagnotte</div>
            <div className="text-sm md:text-xl font-bold text-[#4ADE80]">
              {sessionState.cagnotte_manche}💎
            </div>
          </div>

          {/* En bateau count - mobile only compact */}
          <div className="text-center md:hidden">
            <div className="text-[10px] text-[#9CA3AF]">Bateau</div>
            <div className="text-sm font-bold text-blue-400">{enBateauPlayers.length}</div>
          </div>
        </div>
      </div>

      {/* Main Content - Mobile optimized */}
      <div className="pt-24 md:pt-28 pb-4 px-2 md:px-6 h-full flex flex-col gap-2 md:gap-4 overflow-hidden">
        {/* Boat Progress Bar */}
        <div className="flex-shrink-0">
          <BoatProgressBar
            manche={sessionState.manche_active}
            currentNiveau={sessionState.niveau_active}
            levelHistory={levelHistory}
          />
        </div>

        {/* Main Grid: Status + Ranking - Stacked on mobile */}
        <div className="flex-1 flex flex-col md:grid md:grid-cols-12 gap-2 md:gap-4 min-h-0 overflow-hidden">
          {/* Status & Decisions - Full width on mobile, left panel on desktop */}
          <div className="md:col-span-5 flex flex-col gap-2 md:gap-4 flex-shrink-0 md:flex-shrink md:overflow-auto">
            {/* Current Level Status - Compact on mobile */}
            <div className="bg-[#151B2D] border border-[#D4AF37]/20 rounded-lg p-2 md:p-4 hidden md:block">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-[#D4AF37] flex items-center gap-2">
                  <Anchor className="h-5 w-5" />
                  Niveau {sessionState.niveau_active}
                </h3>
                <Badge className={
                  lockedDecisions.length === enBateauPlayers.length 
                    ? 'bg-green-600' 
                    : 'bg-amber-600'
                }>
                  {lockedDecisions.length}/{enBateauPlayers.length} verrouillés
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-[#0B1020] rounded-lg p-3">
                  <div className="text-[#9CA3AF] text-xs">En bateau</div>
                  <div className="text-xl font-bold text-blue-400">{enBateauPlayers.length}</div>
                </div>
                <div className="bg-[#0B1020] rounded-lg p-3">
                  <div className="text-[#9CA3AF] text-xs">Descentes</div>
                  <div className="text-xl font-bold text-amber-400">
                    {lockedDecisions.filter(d => d.decision === 'DESCENDS').length}
                  </div>
                </div>
              </div>
            </div>

            {/* Before lock: En attente de décision / Choix effectué */}
            {/* After lock: Dans le bateau / A terre */}
            {!allDecisionsLocked ? (
              <>
                {/* Choix effectué (avant clôture) */}
                <div className="bg-[#151B2D] border border-green-500/30 rounded-lg p-2 md:p-4 flex-1 min-h-0 max-h-32 md:max-h-none overflow-hidden">
                  <h3 className="text-xs md:text-sm font-bold text-green-400 flex items-center gap-2 mb-2 md:mb-3">
                    <CheckCircle className="h-3 w-3 md:h-4 md:w-4" />
                    Choix effectué ({playersWithDecision.length})
                  </h3>
                  <ScrollArea className="h-[calc(100%-1.5rem)] md:h-[calc(100%-2rem)]">
                    <div className="grid grid-cols-3 md:grid-cols-2 gap-1 md:gap-2">
                      {playersWithDecision.map(p => (
                        <div key={p.id} className="flex items-center gap-1 md:gap-2 bg-[#0B1020] rounded-lg p-1.5 md:p-2">
                          <Avatar className="h-6 w-6 md:h-8 md:w-8">
                            <AvatarImage src={p.avatar_url || undefined} />
                            <AvatarFallback className="bg-[#D4AF37]/20 text-[#D4AF37] text-[10px] md:text-xs">
                              {p.display_name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0 hidden md:block">
                            <div className="text-xs text-[#E8E8E8] truncate">{p.display_name}</div>
                          </div>
                          <CheckCircle className="h-3 w-3 md:h-4 md:w-4 text-green-400" />
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                {/* En attente de décision (avant clôture) */}
                <div className="bg-[#151B2D] border border-amber-500/30 rounded-lg p-2 md:p-4 max-h-24 md:max-h-none overflow-hidden">
                  <h3 className="text-xs md:text-sm font-bold text-amber-400 flex items-center gap-2 mb-2 md:mb-3">
                    <Clock className="h-3 w-3 md:h-4 md:w-4" />
                    En attente ({pendingPlayers.length})
                  </h3>
                  <div className="flex flex-wrap gap-1 md:gap-2 overflow-y-auto max-h-12 md:max-h-none">
                    {pendingPlayers.map(p => (
                      <div key={p.id} className="flex items-center gap-1 md:gap-2 bg-[#0B1020] rounded-full px-2 md:px-3 py-0.5 md:py-1">
                        <Avatar className="h-5 w-5 md:h-6 md:w-6">
                          <AvatarImage src={p.avatar_url || undefined} />
                          <AvatarFallback className="bg-amber-500/20 text-amber-400 text-[10px] md:text-xs">
                            {p.display_name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-[10px] md:text-xs text-[#E8E8E8] hidden md:inline">{p.display_name}</span>
                      </div>
                    ))}
                    {pendingPlayers.length === 0 && (
                      <span className="text-[10px] md:text-xs text-[#9CA3AF]">Tous ont choisi</span>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Dans le bateau (après clôture) */}
                <div className="bg-[#151B2D] border border-blue-500/30 rounded-lg p-2 md:p-4 flex-1 min-h-0 max-h-32 md:max-h-none overflow-hidden">
                  <h3 className="text-xs md:text-sm font-bold text-blue-400 flex items-center gap-2 mb-2 md:mb-3">
                    <Ship className="h-3 w-3 md:h-4 md:w-4" />
                    Dans le bateau ({lockedDecisions.filter(d => d.decision === 'RESTE').length})
                  </h3>
                  <ScrollArea className="h-[calc(100%-1.5rem)] md:h-[calc(100%-2rem)]">
                    <div className="grid grid-cols-3 md:grid-cols-2 gap-1 md:gap-2">
                      {lockedDecisions.filter(d => d.decision === 'RESTE').map(d => {
                        const player = players.find(p => p.id === d.player_id);
                        if (!player) return null;
                        return (
                          <div key={d.id} className="flex items-center gap-1 md:gap-2 bg-[#0B1020] rounded-lg p-1.5 md:p-2">
                            <Avatar className="h-6 w-6 md:h-8 md:w-8">
                              <AvatarImage src={player.avatar_url || undefined} />
                              <AvatarFallback className="bg-blue-500/20 text-blue-400 text-[10px] md:text-xs">
                                {player.display_name.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0 hidden md:block">
                              <div className="text-xs text-[#E8E8E8] truncate">{player.display_name}</div>
                            </div>
                            <Ship className="h-3 w-3 md:h-4 md:w-4 text-blue-400" />
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>

                {/* A terre (après clôture) */}
                <div className="bg-[#151B2D] border border-green-500/30 rounded-lg p-2 md:p-4 max-h-24 md:max-h-none overflow-hidden">
                  <h3 className="text-xs md:text-sm font-bold text-green-400 flex items-center gap-2 mb-2 md:mb-3">
                    <Anchor className="h-3 w-3 md:h-4 md:w-4" />
                    A terre ({lockedDecisions.filter(d => d.decision === 'DESCENDS').length})
                  </h3>
                  <div className="flex flex-wrap gap-1 md:gap-2 overflow-y-auto max-h-12 md:max-h-none">
                    {lockedDecisions.filter(d => d.decision === 'DESCENDS').map(d => {
                      const player = players.find(p => p.id === d.player_id);
                      if (!player) return null;
                      return (
                        <div key={d.id} className="flex items-center gap-1 md:gap-2 bg-[#0B1020] rounded-full px-2 md:px-3 py-0.5 md:py-1">
                          <Avatar className="h-5 w-5 md:h-6 md:w-6">
                            <AvatarImage src={player.avatar_url || undefined} />
                            <AvatarFallback className="bg-green-500/20 text-green-400 text-[10px] md:text-xs">
                              {player.display_name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-[10px] md:text-xs text-[#E8E8E8] hidden md:inline">{player.display_name}</span>
                          <Anchor className="h-2.5 w-2.5 md:h-3 md:w-3 text-green-400" />
                        </div>
                      );
                    })}
                    {lockedDecisions.filter(d => d.decision === 'DESCENDS').length === 0 && (
                      <span className="text-[10px] md:text-xs text-[#9CA3AF]">Personne ne descend</span>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Right Panel: Live Ranking - Takes remaining space */}
          <div className="md:col-span-7 bg-[#151B2D] border border-[#D4AF37]/20 rounded-lg p-2 md:p-4 flex flex-col min-h-0 flex-1 overflow-hidden">
            <div className="flex items-center justify-between mb-2 md:mb-4">
              <h3 className="text-sm md:text-lg font-bold text-[#D4AF37] flex items-center gap-2">
                <Trophy className="h-4 w-4 md:h-5 md:w-5" />
                Classement
              </h3>
              <PresentationPvicDetailsSheet 
                gameId={game.id} 
                isAdventureMode={true}
                currentGameTypeCode="RIVIERES"
              />
            </div>

            <ScrollArea className="flex-1">
              {/* Top 3 - Compact on mobile */}
              <div className="space-y-1 md:space-y-2 mb-2 md:mb-4">
                {ranking.slice(0, 3).map((p, idx) => (
                  <div 
                    key={p.id} 
                    className={`flex items-center gap-2 md:gap-3 p-1.5 md:p-3 rounded-lg ${idx === 0 ? 'bg-[#D4AF37]/20 border border-[#D4AF37]/40' : 'bg-[#0B1020]'} ${p.current_status === 'A_TERRE' ? 'opacity-60' : ''}`}
                  >
                    <span className={`text-lg md:text-2xl font-bold w-7 md:w-10 ${
                      idx === 0 ? 'text-[#D4AF37]' : 
                      idx === 1 ? 'text-gray-300' : 'text-amber-600'
                    }`}>
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                    </span>
                    <Avatar className="h-7 w-7 md:h-10 md:w-10">
                      <AvatarImage src={p.avatar_url || undefined} />
                      <AvatarFallback className="bg-[#D4AF37]/20 text-[#D4AF37] text-xs md:text-sm">
                        {p.display_name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs md:text-base text-[#E8E8E8] font-medium truncate">{p.display_name}</div>
                      {p.clan && <div className="text-[10px] md:text-xs text-[#9CA3AF] hidden md:block">{p.clan}</div>}
                    </div>
                    <Badge className={`text-[10px] md:text-xs px-1 md:px-2 ${
                      p.current_status === 'EN_BATEAU' ? 'bg-blue-600' :
                      p.current_status === 'A_TERRE' ? 'bg-green-600' :
                      'bg-red-600'
                    }`}>
                      {p.current_status === 'EN_BATEAU' ? '🚣' : 
                       p.current_status === 'A_TERRE' ? '🏝️' : '💀'}
                    </Badge>
                    <span className={`text-xs md:text-sm ${p.validated_levels >= 9 ? 'text-[#4ADE80] font-bold' : 'text-amber-400'}`}>
                      {p.validated_levels}/15
                    </span>
                  </div>
                ))}
              </div>

              {/* Rest of players - Single column on mobile, 2 columns on desktop */}
              {ranking.length > 3 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1 md:gap-2">
                  {ranking.slice(3).map((p, idx) => (
                    <div 
                      key={p.id} 
                      className={`flex items-center gap-1 md:gap-1.5 p-1.5 md:p-2 rounded-lg bg-[#0B1020] ${p.current_status === 'A_TERRE' ? 'opacity-60' : ''}`}
                    >
                      <span className="text-[10px] md:text-xs font-bold text-[#9CA3AF] w-4 md:w-5 flex-shrink-0">
                        #{idx + 4}
                      </span>
                      <Avatar className="h-5 w-5 md:h-6 md:w-6 flex-shrink-0">
                        <AvatarImage src={p.avatar_url || undefined} />
                        <AvatarFallback className="bg-[#D4AF37]/20 text-[#D4AF37] text-[8px] md:text-[10px]">
                          {p.display_name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="text-[#E8E8E8] text-[10px] md:text-xs truncate">{p.display_name}</div>
                      </div>
                      <Badge className={`text-[8px] md:text-[10px] px-1 md:px-1.5 flex-shrink-0 ${
                        p.current_status === 'EN_BATEAU' ? 'bg-blue-600' :
                        p.current_status === 'A_TERRE' ? 'bg-green-600' :
                        'bg-red-600'
                      }`}>
                        {p.current_status === 'EN_BATEAU' ? '🚣' : 
                         p.current_status === 'A_TERRE' ? '🏝️' : '💀'}
                      </Badge>
                      <span className={`text-[10px] md:text-xs flex-shrink-0 min-w-[24px] md:min-w-[28px] text-right ${p.validated_levels >= 9 ? 'text-[#4ADE80]' : 'text-amber-400'}`}>
                        {p.validated_levels}/15
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  );
}
