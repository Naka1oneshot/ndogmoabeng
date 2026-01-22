import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { 
  Ship, Anchor, Waves, Trophy, Users, CheckCircle, Clock, 
  AlertTriangle, RefreshCw, Coins, Target, Skull, X
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { calculateDangerRange, formatDangerRangeDisplay } from '@/lib/rivieresDangerCalculator';
import logoNdogmoabeng from '@/assets/logo-ndogmoabeng.png';
import { BoatProgressBar } from './BoatProgressBar';
import { RivieresLockAnimation } from './RivieresLockAnimation';
import { RivieresResolveAnimation } from './RivieresResolveAnimation';
import { RivieresVictoryPodium } from './RivieresVictoryPodium';

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
  keryndes_choice: string;
  status: string;
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
  const [players, setPlayers] = useState<Player[]>([]);
  const [stageScores, setStageScores] = useState<StageScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Animation states
  const [showLockAnimation, setShowLockAnimation] = useState(false);
  const [showResolveAnimation, setShowResolveAnimation] = useState(false);
  const [resolveAnimationData, setResolveAnimationData] = useState<{
    danger: number;
    totalMises: number;
    outcome: 'SUCCESS' | 'FAIL';
    niveau: number;
    manche: number;
  } | null>(null);

  // Previous state refs for detecting changes
  const previousDecisionsLockedRef = useRef<boolean>(false);
  const previousLevelHistoryCountRef = useRef<number>(0);

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

    if (stateData) setSessionState(stateData);

    // Fetch level history
    const { data: historyData } = await supabase
      .from('river_level_history')
      .select('id, manche, niveau, outcome, danger_effectif, total_mises')
      .eq('session_game_id', sessionGameId)
      .order('resolved_at', { ascending: true });

    if (historyData) {
      // Check for new level resolution to trigger animation
      if (historyData.length > previousLevelHistoryCountRef.current && historyData.length > 0) {
        const latestLevel = historyData[historyData.length - 1];
        setResolveAnimationData({
          danger: latestLevel.danger_effectif,
          totalMises: latestLevel.total_mises,
          outcome: latestLevel.outcome as 'SUCCESS' | 'FAIL',
          niveau: latestLevel.niveau,
          manche: latestLevel.manche,
        });
        setShowResolveAnimation(true);
      }
      previousLevelHistoryCountRef.current = historyData.length;
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
        if (allLocked && !previousDecisionsLockedRef.current) {
          setShowLockAnimation(true);
        }
        previousDecisionsLockedRef.current = allLocked;
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
  const validatedPlayers = players.filter(p => {
    const decision = decisions.find(d => d.player_id === p.id);
    return decision && decision.status === 'LOCKED';
  });
  const pendingPlayers = enBateauPlayers
    .map(s => players.find(p => p.id === s.player_id))
    .filter((p): p is Player => !!p && !decisions.some(d => d.player_id === p.id && d.status === 'LOCKED'));

  // Calculate danger range for display
  const dangerRange = sessionState ? 
    calculateDangerRange(enBateauPlayers.length, sessionState.manche_active, sessionState.niveau_active) : null;

  const isGameEnded = sessionState?.status === 'ENDED' || game.status === 'ENDED';

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
      {/* Lock Animation Overlay */}
      {showLockAnimation && (
        <RivieresLockAnimation onComplete={() => setShowLockAnimation(false)} />
      )}

      {/* Resolve Animation Overlay */}
      {showResolveAnimation && resolveAnimationData && (
        <RivieresResolveAnimation
          danger={resolveAnimationData.danger}
          totalMises={resolveAnimationData.totalMises}
          outcome={resolveAnimationData.outcome}
          niveau={resolveAnimationData.niveau}
          manche={resolveAnimationData.manche}
          onComplete={() => setShowResolveAnimation(false)}
        />
      )}

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 h-16 bg-[#0B1020]/80 backdrop-blur border-b border-[#D4AF37]/20 flex items-center justify-between px-6 z-10">
        <div className="flex items-center gap-3">
          <img src={logoNdogmoabeng} alt="Logo" className="h-10 w-10" />
          <div>
            <h1 className="text-lg font-bold text-[#D4AF37]">{game.name}</h1>
            <p className="text-xs text-[#9CA3AF]">RIVIÈRES • Manche {sessionState.manche_active}/3</p>
          </div>
        </div>

        {/* Danger Display - Center */}
        <div className="flex items-center gap-6">
          {/* Danger Range */}
          <div className="text-center">
            <div className="text-xs text-[#9CA3AF] mb-1">Plage Danger</div>
            <div className="text-xl font-bold text-amber-400">
              {dangerRange ? formatDangerRangeDisplay(dangerRange.range) : '—'}
            </div>
          </div>

          {/* Validated Danger */}
          {sessionState.danger_effectif !== null && (
            <div className="text-center bg-red-900/30 border border-red-500/50 rounded-lg px-4 py-2">
              <div className="text-xs text-red-300 mb-1">Danger Validé</div>
              <div className="text-2xl font-bold text-red-400">
                {sessionState.danger_effectif}
              </div>
            </div>
          )}

          {/* Cagnotte */}
          <div className="text-center">
            <div className="text-xs text-[#9CA3AF] mb-1">Cagnotte</div>
            <div className="text-xl font-bold text-[#4ADE80]">
              {sessionState.cagnotte_manche}💎
            </div>
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#9CA3AF]">
            {format(lastUpdate, 'HH:mm:ss', { locale: fr })}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="text-[#9CA3AF] hover:text-[#D4AF37]"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-[#9CA3AF] hover:text-red-400"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="pt-20 pb-4 px-6 h-full flex flex-col gap-4">
        {/* Boat Progress Bar */}
        <div className="flex-shrink-0">
          <BoatProgressBar
            manche={sessionState.manche_active}
            currentNiveau={sessionState.niveau_active}
            levelHistory={levelHistory}
          />
        </div>

        {/* Main Grid: Status + Ranking */}
        <div className="flex-1 grid grid-cols-12 gap-4 min-h-0">
          {/* Left Panel: Status & Decisions */}
          <div className="col-span-5 flex flex-col gap-4">
            {/* Current Level Status */}
            <div className="bg-[#151B2D] border border-[#D4AF37]/20 rounded-lg p-4">
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

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-[#0B1020] rounded-lg p-3">
                  <div className="text-[#9CA3AF] text-xs">En bateau</div>
                  <div className="text-xl font-bold text-blue-400">{enBateauPlayers.length}</div>
                </div>
                <div className="bg-[#0B1020] rounded-lg p-3">
                  <div className="text-[#9CA3AF] text-xs">Mises totales</div>
                  <div className="text-xl font-bold text-[#4ADE80]">
                    {lockedDecisions.reduce((sum, d) => d.decision === 'RESTE' ? sum + d.mise_demandee : sum, 0)}💎
                  </div>
                </div>
                <div className="bg-[#0B1020] rounded-lg p-3">
                  <div className="text-[#9CA3AF] text-xs">Descentes</div>
                  <div className="text-xl font-bold text-amber-400">
                    {lockedDecisions.filter(d => d.decision === 'DESCENDS').length}
                  </div>
                </div>
              </div>
            </div>

            {/* Validated Players */}
            <div className="bg-[#151B2D] border border-green-500/30 rounded-lg p-4 flex-1 min-h-0">
              <h3 className="text-sm font-bold text-green-400 flex items-center gap-2 mb-3">
                <CheckCircle className="h-4 w-4" />
                Validés ({validatedPlayers.length})
              </h3>
              <ScrollArea className="h-[calc(100%-2rem)]">
                <div className="grid grid-cols-2 gap-2">
                  {validatedPlayers.map(p => {
                    const decision = decisions.find(d => d.player_id === p.id);
                    return (
                      <div key={p.id} className="flex items-center gap-2 bg-[#0B1020] rounded-lg p-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={p.avatar_url || undefined} />
                          <AvatarFallback className="bg-[#D4AF37]/20 text-[#D4AF37] text-xs">
                            {p.display_name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-[#E8E8E8] truncate">{p.display_name}</div>
                          <div className={`text-xs ${decision?.decision === 'RESTE' ? 'text-blue-400' : 'text-amber-400'}`}>
                            {decision?.decision === 'RESTE' ? `🚣 ${decision.mise_demandee}💎` : '⬇️ Descend'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            {/* Pending Players */}
            <div className="bg-[#151B2D] border border-amber-500/30 rounded-lg p-4">
              <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4" />
                En attente ({pendingPlayers.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {pendingPlayers.map(p => (
                  <div key={p.id} className="flex items-center gap-2 bg-[#0B1020] rounded-full px-3 py-1">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={p.avatar_url || undefined} />
                      <AvatarFallback className="bg-amber-500/20 text-amber-400 text-xs">
                        {p.display_name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-[#E8E8E8]">{p.display_name}</span>
                  </div>
                ))}
                {pendingPlayers.length === 0 && (
                  <span className="text-xs text-[#9CA3AF]">Tous les joueurs ont validé</span>
                )}
              </div>
            </div>
          </div>

          {/* Right Panel: Live Ranking */}
          <div className="col-span-7 bg-[#151B2D] border border-[#D4AF37]/20 rounded-lg p-4 flex flex-col min-h-0">
            <h3 className="text-lg font-bold text-[#D4AF37] flex items-center gap-2 mb-4">
              <Trophy className="h-5 w-5" />
              Classement en direct
            </h3>

            <ScrollArea className="flex-1">
              <table className="w-full text-sm">
                <thead className="bg-[#0B1020] sticky top-0">
                  <tr>
                    <th className="p-3 text-left text-[#D4AF37]">Rang</th>
                    <th className="p-3 text-left text-[#9CA3AF]">Joueur</th>
                    <th className="p-3 text-center text-[#9CA3AF]">Statut</th>
                    <th className="p-3 text-center text-[#9CA3AF]">Niveaux</th>
                    <th className="p-3 text-center text-[#9CA3AF]">Jetons</th>
                    <th className="p-3 text-right text-[#D4AF37]">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((p, idx) => (
                    <tr 
                      key={p.id} 
                      className={`border-t border-[#D4AF37]/10 ${idx === 0 ? 'bg-[#D4AF37]/10' : ''} ${p.current_status === 'A_TERRE' ? 'opacity-60' : ''}`}
                    >
                      <td className="p-3">
                        <span className={`text-lg font-bold ${
                          idx === 0 ? 'text-[#D4AF37]' : 
                          idx === 1 ? 'text-gray-300' : 
                          idx === 2 ? 'text-amber-600' : 'text-[#9CA3AF]'
                        }`}>
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={p.avatar_url || undefined} />
                            <AvatarFallback className="bg-[#D4AF37]/20 text-[#D4AF37] text-xs">
                              {p.display_name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="text-[#E8E8E8] font-medium">{p.display_name}</div>
                            {p.clan && <div className="text-xs text-[#9CA3AF]">{p.clan}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <Badge className={
                          p.current_status === 'EN_BATEAU' ? 'bg-blue-600' :
                          p.current_status === 'A_TERRE' ? 'bg-green-600' :
                          'bg-red-600'
                        }>
                          {p.current_status === 'EN_BATEAU' ? '🚣' : 
                           p.current_status === 'A_TERRE' ? '🏝️' : '💀'}
                        </Badge>
                      </td>
                      <td className="p-3 text-center">
                        <span className={p.validated_levels >= 9 ? 'text-[#4ADE80] font-bold' : 'text-amber-400'}>
                          {p.validated_levels}/15
                        </span>
                        {p.penalty_applied && <span className="text-xs text-red-400 ml-1">⚠️</span>}
                      </td>
                      <td className="p-3 text-center text-[#4ADE80] font-medium">
                        {p.jetons}💎
                      </td>
                      <td className="p-3 text-right">
                        <span className="text-xl font-bold text-[#D4AF37]">{p.score_value}</span>
                        <span className="text-[#9CA3AF] text-xs ml-1">pts</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  );
}
