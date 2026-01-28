import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RefreshCw, X, History, Trophy, Shield, Swords, Users } from 'lucide-react';
import { getSheriffThemeClasses, SHERIFF_COLORS } from '../SheriffTheme';
import logoNdogmoabeng from '@/assets/logo-ndogmoabeng.png';
import { useIsMobile } from '@/hooks/use-mobile';
import { SheriffVisaCostsSummaryAnimation } from './SheriffVisaCostsSummaryAnimation';
import { SheriffTeamSortAnimation } from './SheriffTeamSortAnimation';
import { SheriffDuelStartAnimation } from './SheriffDuelStartAnimation';
import { SheriffDuelResolutionAnimation } from './SheriffDuelResolutionAnimation';
import { SheriffVictoryPodium } from './SheriffVictoryPodium';
import { AdventureCinematicOverlay } from '@/components/adventure/AdventureCinematicOverlay';
import { useAdventureCinematic, getSequenceForGameType } from '@/hooks/useAdventureCinematic';

const LA_CARTE_TROUVEE_ID = 'a1b2c3d4-5678-9012-3456-789012345678';

interface Game {
  id: string;
  name: string;
  status: string;
  phase: string;
  manche_active: number | null;
  current_session_game_id: string | null;
  selected_game_type_code: string | null;
}

interface Player {
  id: string;
  display_name: string;
  player_number: number | null;
  clan: string | null;
  pvic: number | null;
  user_id: string | null;
  avatar_url?: string | null;
  is_bot?: boolean;
  team_code?: string | null;
  mate_num?: number | null;
}

interface PlayerChoice {
  id: string;
  player_number: number;
  visa_choice: string | null;
  visa_cost_applied: number;
  tokens_entering: number | null;
  has_illegal_tokens: boolean;
  victory_points_delta: number;
  pvic_initial?: number;
}

interface Duel {
  id: string;
  duel_order: number;
  player1_number: number;
  player2_number: number;
  player1_searches: boolean | null;
  player2_searches: boolean | null;
  status: string;
  player1_vp_delta: number;
  player2_vp_delta: number;
  resolution_summary: any;
}

interface RoundState {
  id: string;
  phase: string;
  current_duel_order: number | null;
  total_duels: number;
  common_pool_initial: number;
  common_pool_spent: number;
  bot_config?: {
    visa_pvic_percent?: number;
    cost_per_player?: number;
    duel_max_impact?: number;
  } | null;
}

interface SheriffPresentationViewProps {
  game: Game;
  onClose: () => void;
}

export function SheriffPresentationView({ game: initialGame, onClose }: SheriffPresentationViewProps) {
  const theme = getSheriffThemeClasses();
  
  const [game, setGame] = useState<Game>(initialGame);
  const [players, setPlayers] = useState<Player[]>([]);
  const [choices, setChoices] = useState<PlayerChoice[]>([]);
  const [duels, setDuels] = useState<Duel[]>([]);
  const [roundState, setRoundState] = useState<RoundState | null>(null);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  
  // Animation states
  const [showChoicesResolution, setShowChoicesResolution] = useState(false);
  const [showTeamSort, setShowTeamSort] = useState(false);
  const [showDuelStart, setShowDuelStart] = useState(false);
  const [showDuelResolution, setShowDuelResolution] = useState(false);
  const [currentDuelForAnimation, setCurrentDuelForAnimation] = useState<Duel | null>(null);
  const [showVictoryPodium, setShowVictoryPodium] = useState(false);
  
  // Track previous state for animations
  const prevPhaseRef = useRef<string | null>(null);
  const prevDuelOrderRef = useRef<number | null>(null);
  const prevDuelStatusRef = useRef<string | null>(null);
  
  // Adventure cinematic - broadcast on mount for ANY adventure mode
  const cinematicBroadcastedRef = useRef(false);
  const { broadcastCinematic, debugState: cinematicDebugState } = useAdventureCinematic(game.id, { enabled: false });
  
  useEffect(() => {
    if (cinematicBroadcastedRef.current) return;
    
    // Check if this is ANY adventure mode
    const checkAndBroadcast = async () => {
      const { data: gameData } = await supabase
        .from('games')
        .select('mode, adventure_id')
        .eq('id', game.id)
        .single();
      
      console.log('[SHERIFF][PRESENTATION] Game context:', {
        mode: gameData?.mode,
        adventure_id: gameData?.adventure_id,
        isAdventure: gameData?.mode === 'ADVENTURE',
      });
      
      // Broadcast for ANY adventure mode, not just "La carte trouvée"
      if (gameData?.mode === 'ADVENTURE') {
        cinematicBroadcastedRef.current = true;
        const sequence = getSequenceForGameType('SHERIFF', true);
        console.log('[SHERIFF][PRESENTATION] Broadcasting cinematic:', sequence);
        if (sequence.length > 0) {
          broadcastCinematic(sequence);
        }
      }
    };
    
    checkAndBroadcast();
  }, [game.id, broadcastCinematic]);
  
  const fetchData = useCallback(async () => {
    if (!game.id) return;
    
    // Fetch game
    const { data: gameData } = await supabase
      .from('games')
      .select('*')
      .eq('id', game.id)
      .single();
    
    if (gameData) setGame(gameData as Game);
    
    // Fetch players with avatars
    const { data: playersData } = await supabase
      .from('game_players')
      .select('*')
      .eq('game_id', game.id)
      .is('removed_at', null)
      .neq('is_host', true)
      .order('player_number', { ascending: true });
    
    if (playersData) {
      // Get avatar URLs
      const userIds = playersData.filter(p => p.user_id).map(p => p.user_id);
      let avatarMap: Record<string, string> = {};
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, avatar_url')
          .in('id', userIds);
        
        if (profiles) {
          avatarMap = Object.fromEntries(profiles.map(p => [p.id, p.avatar_url]));
        }
      }
      
      setPlayers(playersData.map(p => ({
        ...p,
        avatar_url: p.user_id ? avatarMap[p.user_id] || null : null,
      })) as Player[]);
    }
    
    // Fetch session-specific data
    if (game.current_session_game_id) {
      const { data: choicesData } = await supabase
        .from('sheriff_player_choices')
        .select('*')
        .eq('session_game_id', game.current_session_game_id);
      
      if (choicesData) setChoices(choicesData as PlayerChoice[]);
      
      const { data: duelsData } = await supabase
        .from('sheriff_duels')
        .select('*')
        .eq('session_game_id', game.current_session_game_id)
        .order('duel_order', { ascending: true });
      
      if (duelsData) setDuels(duelsData as Duel[]);
      
      const { data: stateData } = await supabase
        .from('sheriff_round_state')
        .select('*')
        .eq('session_game_id', game.current_session_game_id)
        .maybeSingle();
      
      if (stateData) setRoundState(stateData as unknown as RoundState);
    }
    
    setLoading(false);
  }, [game.id, game.current_session_game_id]);
  
  useEffect(() => {
    fetchData();
    
    // Build subscriptions - use session_game_id for sheriff tables when available
    const sessionGameId = game.current_session_game_id;
    
    let channel = supabase
      .channel(`sheriff-presentation-${game.id}-${sessionGameId || 'no-session'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${game.id}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${game.id}` }, fetchData);
    
    // Subscribe to sheriff tables by session_game_id when available (fixes realtime updates)
    if (sessionGameId) {
      channel = channel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sheriff_player_choices', filter: `session_game_id=eq.${sessionGameId}` }, fetchData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sheriff_duels', filter: `session_game_id=eq.${sessionGameId}` }, fetchData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sheriff_round_state', filter: `session_game_id=eq.${sessionGameId}` }, fetchData);
    }
    
    channel.subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [game.id, game.current_session_game_id, fetchData]);
  
  // Detect phase changes for animations
  useEffect(() => {
    if (!roundState) return;
    
    // Detect CHOICES -> DUELS transition (lock choices)
    if (prevPhaseRef.current === 'CHOICES' && roundState.phase === 'DUELS') {
      // Trigger choices resolution animation sequence
      setShowChoicesResolution(true);
    }
    
    prevPhaseRef.current = roundState.phase;
  }, [roundState?.phase]);
  
  // Detect duel changes - trigger animation when MJ activates a new duel
  useEffect(() => {
    if (!roundState || roundState.phase !== 'DUELS') return;
    
    const activeDuel = duels.find(d => d.status === 'ACTIVE');
    
    // New duel activated by MJ (status changed from PENDING to ACTIVE)
    if (activeDuel) {
      const prevOrder = prevDuelOrderRef.current;
      const isNewDuel = prevOrder === null || prevOrder !== activeDuel.duel_order;
      
      if (isNewDuel) {
        // Show duel start animation for every new duel activation
        setCurrentDuelForAnimation(activeDuel);
        setShowDuelStart(true);
        prevDuelOrderRef.current = activeDuel.duel_order;
        prevDuelStatusRef.current = activeDuel.status;
      }
    }
    
    // Duel resolved - detect when a previously active duel becomes resolved
    const justResolvedDuel = duels.find(
      d => d.status === 'RESOLVED' && 
           d.duel_order === prevDuelOrderRef.current && 
           prevDuelStatusRef.current === 'ACTIVE'
    );
    
    if (justResolvedDuel) {
      setCurrentDuelForAnimation(justResolvedDuel);
      setShowDuelResolution(true);
      prevDuelStatusRef.current = 'RESOLVED';
    }
  }, [duels, roundState?.phase]);
  
  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);
  
  // Animation callbacks
  const handleChoicesResolutionComplete = () => {
    setShowChoicesResolution(false);
    setShowTeamSort(true);
  };
  
  const handleTeamSortComplete = () => {
    setShowTeamSort(false);
    // No longer auto-trigger duel animation here
    // The duel start animation is now triggered when the MJ clicks "Déclencher le prochain duel"
    // and the duel status changes to ACTIVE (detected in useEffect above)
  };
  
  const handleDuelStartComplete = () => {
    setShowDuelStart(false);
  };
  
  const handleDuelResolutionComplete = () => {
    setShowDuelResolution(false);
  };
  
  // Derived data
  const activePlayers = players.filter(p => p.player_number !== null);
  const currentDuel = duels.find(d => d.status === 'ACTIVE');
  const resolvedDuels = duels.filter(d => d.status === 'RESOLVED');
  const pendingDuels = duels.filter(d => d.status === 'PENDING');
  const allDuelsResolved = roundState?.phase === 'DUELS' && duels.length > 0 && pendingDuels.length === 0 && !currentDuel;
  
  const getPlayer = (num: number) => activePlayers.find(p => p.player_number === num);
  const getChoice = (num: number) => choices.find(c => c.player_number === num);
  
  // Calculate totals
  const totalPool = roundState ? roundState.common_pool_initial - roundState.common_pool_spent : 0;
  const totalPvics = activePlayers.reduce((sum, p) => sum + (p.pvic || 0), 0);
  
  // Waiting vs validated choices
  const playersWithChoices = choices.filter(c => c.visa_choice !== null);
  const playersWithoutChoices = activePlayers.filter(p => !choices.find(c => c.player_number === p.player_number && c.visa_choice !== null));
  
  // Get configured visa percent from round state (default 20%)
  const visaPvicPercent = roundState?.bot_config?.visa_pvic_percent || 20;
  
  // Calculate cumulative PVic for a player using NEW logic:
  // Coût Visa PVic = 0 if pool, otherwise PVic Init * configured visa percent
  // Coût Duel = (PVic Init - Coût Visa PVic) * cumulative duel delta %
  // PVic Actuel = PVic Init - Coût Visa PVic - Coût Duel
  const getPlayerCumulativePvic = (playerNum: number): number => {
    const choice = choices.find(c => c.player_number === playerNum);
    const pvicInit = choice?.pvic_initial || activePlayers.find(p => p.player_number === playerNum)?.pvic || 0;
    
    // Coût Visa PVic
    const coutVisaPvic = (choice?.visa_choice === 'VICTORY_POINTS') 
      ? Math.round(pvicInit * (visaPvicPercent / 100)) 
      : 0;
    
    // Calculate cumulative duel delta from all resolved duels for this player
    const playerDuels = duels.filter(d => 
      d.status === 'RESOLVED' && 
      (d.player1_number === playerNum || d.player2_number === playerNum)
    );
    const duelDeltaPercent = playerDuels.reduce((sum, d) => {
      if (d.player1_number === playerNum) return sum + d.player1_vp_delta;
      return sum + d.player2_vp_delta;
    }, 0);
    
    // Coût Duel = (PVic Init - Coût Visa PVic) * cumulative duel delta %
    const baseAfterVisa = pvicInit - coutVisaPvic;
    const coutDuel = Math.round(baseAfterVisa * (Math.abs(duelDeltaPercent) / 100)) * (duelDeltaPercent < 0 ? 1 : -1);
    
    // PVic Actuel = PVic Init - Coût Visa PVic - Coût Duel
    return pvicInit - coutVisaPvic - coutDuel;
  };

  // Team ranking (grouped by mate pairs - player_number <-> mate_num are cross-referenced)
  const teamRanking = (() => {
    const teams: Record<string, { name: string; totalPvic: number; players: Player[] }> = {};
    const processed = new Set<number>();
    
    activePlayers.forEach(p => {
      const pNum = p.player_number;
      if (pNum === null || processed.has(pNum)) return;
      
      // Find the teammate (the player whose player_number equals this player's mate_num)
      const teammate = activePlayers.find(t => t.player_number === p.mate_num);
      
      if (teammate && teammate.player_number !== null) {
        // It's a pair - calculate cumulative PVic including all Sheriff session deltas
        const teamKey = `team-${Math.min(pNum, teammate.player_number)}-${Math.max(pNum, teammate.player_number)}`;
        const sortedPair = [p, teammate].sort((a, b) => (a.player_number || 0) - (b.player_number || 0));
        
        teams[teamKey] = {
          name: sortedPair.map(pl => pl.display_name).join(' & '),
          totalPvic: getPlayerCumulativePvic(pNum) + getPlayerCumulativePvic(teammate.player_number),
          players: sortedPair,
        };
        
        processed.add(pNum);
        processed.add(teammate.player_number);
      } else {
        // Solo player (no mate found)
        teams[`solo-${pNum}`] = {
          name: p.display_name,
          totalPvic: getPlayerCumulativePvic(pNum),
          players: [p],
        };
        processed.add(pNum);
      }
    });
    
    return Object.values(teams).sort((a, b) => b.totalPvic - a.totalPvic);
  })();
  
  // Players grouped by visa choice
  const poolPlayers = choices.filter(c => c.visa_choice === 'COMMON_POOL');
  const pvicPlayers = choices.filter(c => c.visa_choice === 'VICTORY_POINTS');
  
  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#1A1510] flex items-center justify-center z-50">
        <div className="text-[#D4AF37] text-xl animate-pulse">Chargement...</div>
      </div>
    );
  }
  
  // Show victory podium when triggered manually or game is complete
  if (showVictoryPodium || roundState?.phase === 'COMPLETE' || game.status === 'ENDED') {
    return (
      <SheriffVictoryPodium
        players={activePlayers}
        teamRanking={teamRanking}
        choices={choices}
        duels={duels}
        onClose={onClose}
      />
    );
  }
  
  return (
    <div className="fixed inset-0 bg-gradient-to-b from-[#1A1510] to-[#0F0D08] z-50 overflow-auto">
      {/* Animations */}
      {showChoicesResolution && roundState && (
        <SheriffVisaCostsSummaryAnimation
          players={activePlayers}
          choices={choices}
          poolInitial={roundState.common_pool_initial}
          poolSpent={roundState.common_pool_spent}
          visaPvicPercent={roundState.bot_config?.visa_pvic_percent || 20}
          poolCostPerPlayer={roundState.bot_config?.cost_per_player || 10}
          onComplete={handleChoicesResolutionComplete}
        />
      )}
      
      {showTeamSort && (
        <SheriffTeamSortAnimation
          players={activePlayers}
          choices={choices}
          getPlayer={getPlayer}
          onComplete={handleTeamSortComplete}
        />
      )}
      
      {showDuelStart && currentDuelForAnimation && (
        <SheriffDuelStartAnimation
          player1={getPlayer(currentDuelForAnimation.player1_number)}
          player2={getPlayer(currentDuelForAnimation.player2_number)}
          duelOrder={currentDuelForAnimation.duel_order}
          onComplete={handleDuelStartComplete}
        />
      )}
      
      {showDuelResolution && currentDuelForAnimation && (
        <SheriffDuelResolutionAnimation
          duel={currentDuelForAnimation}
          player1={getPlayer(currentDuelForAnimation.player1_number)}
          player2={getPlayer(currentDuelForAnimation.player2_number)}
          choice1={getChoice(currentDuelForAnimation.player1_number)}
          choice2={getChoice(currentDuelForAnimation.player2_number)}
          onComplete={handleDuelResolutionComplete}
        />
      )}
      
      {/* Header */}
      <div className="sticky top-0 bg-[#1A1510]/95 backdrop-blur border-b border-[#D4AF37]/30 z-40">
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-3">
            <img src={logoNdogmoabeng} alt="Logo" className="h-10 w-10 object-contain" />
            <div>
              <h1 className="text-lg font-bold text-[#D4AF37]">🤠 {game.name}</h1>
              <div className="flex items-center gap-2 text-xs text-[#9CA3AF]">
                <span>Phase: {roundState?.phase || 'En attente'}</span>
                {currentDuel && <span>• Duel {currentDuel.duel_order}/{roundState?.total_duels}</span>}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
              className="text-[#D4AF37] hover:bg-[#D4AF37]/10"
            >
              <History className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchData}
              className="text-[#D4AF37] hover:bg-[#D4AF37]/10"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-[#D4AF37] hover:bg-[#D4AF37]/10"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="p-4">
        {roundState?.phase === 'CHOICES' && (
          <ChoicesPhaseDisplay
            players={activePlayers}
            choices={choices}
            playersWithChoices={playersWithChoices}
            playersWithoutChoices={playersWithoutChoices}
            totalPool={totalPool}
            totalPvics={totalPvics}
            teamRanking={teamRanking}
            getPlayer={getPlayer}
          />
        )}
        
        {roundState?.phase === 'DUELS' && (
          <DuelsPhaseDisplay
            players={activePlayers}
            duels={duels}
            currentDuel={currentDuel}
            resolvedDuels={resolvedDuels}
            teamRanking={teamRanking}
            getPlayer={getPlayer}
            getChoice={getChoice}
          />
        )}
        
        {/* Show Podium Button when all duels are resolved */}
        {allDuelsResolved && (
          <div className="flex justify-center mt-8">
            <Button
              size="lg"
              onClick={() => setShowVictoryPodium(true)}
              className="bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-white font-bold text-lg px-8 py-6 rounded-xl shadow-lg shadow-yellow-500/30 animate-pulse"
            >
              <Trophy className="h-6 w-6 mr-3" />
              🏆 Voir le Podium
            </Button>
          </div>
        )}
      </div>
      {/* History Sidebar */}
      {showHistory && (
        <div className="fixed right-0 top-0 bottom-0 w-80 bg-[#1A1510] border-l border-[#D4AF37]/30 p-4 overflow-auto z-50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[#D4AF37] font-bold">Historique</h3>
            <Button variant="ghost" size="sm" onClick={() => setShowHistory(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-2">
            {resolvedDuels.map(duel => (
              <div key={duel.id} className="p-3 rounded-lg bg-[#2A2215] border border-[#D4AF37]/20">
                <div className="text-sm font-medium text-[#D4AF37] mb-1">Duel {duel.duel_order}</div>
                <div className="text-xs text-[#9CA3AF]">
                  {getPlayer(duel.player1_number)?.display_name} vs {getPlayer(duel.player2_number)?.display_name}
                </div>
                <div className="flex gap-2 mt-1 text-xs">
                  <span className={duel.player1_vp_delta >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {duel.player1_vp_delta >= 0 ? '+' : ''}{duel.player1_vp_delta}
                  </span>
                  <span className="text-[#9CA3AF]">|</span>
                  <span className={duel.player2_vp_delta >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {duel.player2_vp_delta >= 0 ? '+' : ''}{duel.player2_vp_delta}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-components for each phase

interface ChoicesPhaseDisplayProps {
  players: Player[];
  choices: PlayerChoice[];
  playersWithChoices: PlayerChoice[];
  playersWithoutChoices: Player[];
  totalPool: number;
  totalPvics: number;
  teamRanking: { name: string; totalPvic: number; players: Player[] }[];
  getPlayer: (num: number) => Player | undefined;
}

function ChoicesPhaseDisplay({
  players,
  choices,
  playersWithChoices,
  playersWithoutChoices,
  totalPool,
  totalPvics,
  teamRanking,
  getPlayer,
}: ChoicesPhaseDisplayProps) {
  return (
    <div className="grid grid-cols-12 gap-4">
      {/* Left/Center: Pool vs PVics */}
      <div className="col-span-12 lg:col-span-8">
        {/* Pool vs Pvics Display */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-amber-600/30 to-amber-800/20 border-2 border-amber-500/50 rounded-xl p-6 text-center">
            <div className="text-sm text-amber-300 mb-2">💰 Cagnotte</div>
            <div className="text-4xl font-bold text-amber-400">{totalPool}€</div>
          </div>
          
          <div className="flex items-center justify-center">
            <div className="text-5xl font-black text-[#D4AF37] animate-pulse">VS</div>
          </div>
          
          <div className="bg-gradient-to-br from-purple-600/30 to-purple-800/20 border-2 border-purple-500/50 rounded-xl p-6 text-center">
            <div className="text-sm text-purple-300 mb-2">⭐ Total PVics</div>
            <div className="text-4xl font-bold text-purple-400">{totalPvics}</div>
          </div>
        </div>
        
        {/* All Players */}
        <div className="bg-[#2A2215] border border-[#D4AF37]/20 rounded-xl p-4">
          <h3 className="text-[#D4AF37] font-bold mb-4 flex items-center gap-2">
            <Users className="h-5 w-5" />
            Joueurs ({players.length})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {players.map(player => {
              const hasChoice = choices.find(c => c.player_number === player.player_number && c.visa_choice !== null);
              return (
                <div
                  key={player.id}
                  className={`p-3 rounded-lg border ${hasChoice ? 'bg-green-900/20 border-green-500/30' : 'bg-[#1A1510] border-[#D4AF37]/20'}`}
                >
                  <div className="flex items-center gap-2">
                    {player.avatar_url ? (
                      <img src={player.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#D4AF37]/40 to-[#8B4513]/40 flex items-center justify-center text-[#D4AF37] text-xs font-bold">
                        {player.display_name ? player.display_name.slice(0, 2).toUpperCase() : player.player_number}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{player.display_name}</div>
                      <div className="text-xs text-[#9CA3AF]">{player.pvic || 0} PV</div>
                    </div>
                    {hasChoice && <div className="text-green-400 text-lg">✓</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Right: Waiting/Validated + Team Ranking */}
      <div className="col-span-12 lg:col-span-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {/* Waiting */}
          <div className="bg-[#2A2215] border border-orange-500/30 rounded-xl p-3">
            <h4 className="text-orange-400 text-sm font-medium mb-2">⏳ En attente ({playersWithoutChoices.length})</h4>
            <div className="space-y-1 max-h-40 overflow-auto">
              {playersWithoutChoices.map(p => (
                <div key={p.id} className="text-xs text-[#9CA3AF] truncate">
                  #{p.player_number} {p.display_name}
                </div>
              ))}
            </div>
          </div>
          
          {/* Validated */}
          <div className="bg-[#2A2215] border border-green-500/30 rounded-xl p-3">
            <h4 className="text-green-400 text-sm font-medium mb-2">✓ Validés ({playersWithChoices.length})</h4>
            <div className="space-y-1 max-h-40 overflow-auto">
              {playersWithChoices.map(c => {
                const p = getPlayer(c.player_number);
                return (
                  <div key={c.id} className="text-xs text-[#9CA3AF] truncate">
                    #{c.player_number} {p?.display_name}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        
        {/* Team Ranking */}
        <div className="bg-[#2A2215] border border-[#D4AF37]/20 rounded-xl p-4">
          <h4 className="text-[#D4AF37] font-bold mb-3 flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            Classement Équipes
            <span className="text-xs font-normal text-[#9CA3AF]">(PVic cumulés 🔄)</span>
          </h4>
          <div className="space-y-2">
            {teamRanking.map((team, idx) => (
              <TeamRankingRow key={team.name} team={team} idx={idx} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface DuelsPhaseDisplayProps {
  players: Player[];
  duels: Duel[];
  currentDuel: Duel | undefined;
  resolvedDuels: Duel[];
  teamRanking: { name: string; totalPvic: number; players: Player[] }[];
  getPlayer: (num: number) => Player | undefined;
  getChoice: (num: number) => PlayerChoice | undefined;
}

function DuelsPhaseDisplay({
  players,
  duels,
  currentDuel,
  resolvedDuels,
  teamRanking,
  getPlayer,
  getChoice,
}: DuelsPhaseDisplayProps) {
  const pendingDuels = duels.filter(d => d.status === 'PENDING');
  const player1 = currentDuel ? getPlayer(currentDuel.player1_number) : null;
  const player2 = currentDuel ? getPlayer(currentDuel.player2_number) : null;
  
  // Helper to get initials from display name
  const getInitials = (name: string | undefined) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };
  
  return (
    <div className="grid grid-cols-12 gap-4 h-full">
      {/* Center: Current Duel */}
      <div className="col-span-12 lg:col-span-8 flex flex-col">
        {currentDuel ? (
          <div className="bg-gradient-to-br from-[#2A2215] to-[#1A1510] border-2 border-[#D4AF37]/40 rounded-2xl p-6 lg:p-10 flex-1 flex flex-col justify-center min-h-[70vh]">
            {/* PVics Display */}
            <div className="grid grid-cols-3 gap-4 mb-6 lg:mb-10">
              <div className="text-center">
                <div className="text-sm lg:text-base text-[#9CA3AF] mb-1">PVic Équipe</div>
                <div className="text-4xl lg:text-5xl font-bold text-[#D4AF37]">{player1?.pvic || 0}</div>
              </div>
              <div className="flex items-center justify-center">
                <Swords className="h-10 w-10 lg:h-14 lg:w-14 text-[#D4AF37] animate-pulse" />
              </div>
              <div className="text-center">
                <div className="text-sm lg:text-base text-[#9CA3AF] mb-1">PVic Équipe</div>
                <div className="text-4xl lg:text-5xl font-bold text-[#D4AF37]">{player2?.pvic || 0}</div>
              </div>
            </div>
            
            {/* Players VS - Maximized */}
            <div className="grid grid-cols-3 gap-4 items-center flex-1">
              {/* Player 1 */}
              <div className="text-center flex flex-col items-center justify-center">
                {player1?.avatar_url ? (
                  <img 
                    src={player1.avatar_url} 
                    alt="" 
                    className="h-32 w-32 lg:h-44 lg:w-44 xl:h-52 xl:w-52 rounded-full object-cover mb-4 border-4 lg:border-[6px] border-[#D4AF37] shadow-2xl shadow-[#D4AF37]/20" 
                  />
                ) : (
                  <div className="h-32 w-32 lg:h-44 lg:w-44 xl:h-52 xl:w-52 rounded-full bg-gradient-to-br from-[#D4AF37]/40 to-[#8B4513]/40 flex items-center justify-center mb-4 border-4 lg:border-[6px] border-[#D4AF37] text-4xl lg:text-6xl xl:text-7xl font-bold text-[#D4AF37] shadow-2xl shadow-[#D4AF37]/20">
                    {getInitials(player1?.display_name)}
                  </div>
                )}
                <div className="text-xl lg:text-2xl xl:text-3xl font-bold text-white">{player1?.display_name}</div>
                <div className="text-sm lg:text-base text-[#9CA3AF]">#{player1?.player_number} • {player1?.clan || 'Solo'}</div>
                <div className="mt-3">
                  {currentDuel.player1_searches !== null ? (
                    <span className="px-4 py-2 rounded-full text-sm lg:text-base font-medium bg-green-500/20 text-green-400 border border-green-500/40">✓ A choisi</span>
                  ) : (
                    <span className="px-4 py-2 rounded-full text-sm lg:text-base font-medium bg-orange-500/20 text-orange-400 border border-orange-500/40">⏳ En attente</span>
                  )}
                </div>
              </div>
              
              {/* VS */}
              <div className="text-center flex flex-col items-center justify-center">
                <div className="text-7xl lg:text-8xl xl:text-9xl font-black text-[#D4AF37] drop-shadow-lg">VS</div>
                <div className="text-base lg:text-lg text-[#9CA3AF] mt-3">Duel {currentDuel.duel_order}</div>
              </div>
              
              {/* Player 2 */}
              <div className="text-center flex flex-col items-center justify-center">
                {player2?.avatar_url ? (
                  <img 
                    src={player2.avatar_url} 
                    alt="" 
                    className="h-32 w-32 lg:h-44 lg:w-44 xl:h-52 xl:w-52 rounded-full object-cover mb-4 border-4 lg:border-[6px] border-[#D4AF37] shadow-2xl shadow-[#D4AF37]/20" 
                  />
                ) : (
                  <div className="h-32 w-32 lg:h-44 lg:w-44 xl:h-52 xl:w-52 rounded-full bg-gradient-to-br from-[#D4AF37]/40 to-[#8B4513]/40 flex items-center justify-center mb-4 border-4 lg:border-[6px] border-[#D4AF37] text-4xl lg:text-6xl xl:text-7xl font-bold text-[#D4AF37] shadow-2xl shadow-[#D4AF37]/20">
                    {getInitials(player2?.display_name)}
                  </div>
                )}
                <div className="text-xl lg:text-2xl xl:text-3xl font-bold text-white">{player2?.display_name}</div>
                <div className="text-sm lg:text-base text-[#9CA3AF]">#{player2?.player_number} • {player2?.clan || 'Solo'}</div>
                <div className="mt-3">
                  {currentDuel.player2_searches !== null ? (
                    <span className="px-4 py-2 rounded-full text-sm lg:text-base font-medium bg-green-500/20 text-green-400 border border-green-500/40">✓ A choisi</span>
                  ) : (
                    <span className="px-4 py-2 rounded-full text-sm lg:text-base font-medium bg-orange-500/20 text-orange-400 border border-orange-500/40">⏳ En attente</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-[#2A2215] border border-[#D4AF37]/20 rounded-xl p-12 text-center flex-1 flex flex-col items-center justify-center min-h-[70vh]">
            <Shield className="h-24 w-24 mb-6 text-[#D4AF37]/50" />
            <p className="text-xl text-[#9CA3AF]">En attente du prochain duel...</p>
          </div>
        )}
      </div>
      
      {/* Right: Waiting/Resolved + Team Ranking */}
      <div className="col-span-12 lg:col-span-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {/* Pending Duels */}
          <div className="bg-[#2A2215] border border-orange-500/30 rounded-xl p-3">
            <h4 className="text-orange-400 text-sm font-medium mb-2">⏳ En attente ({pendingDuels.length})</h4>
            <div className="space-y-1 max-h-40 overflow-auto">
              {pendingDuels.map(d => (
                <div key={d.id} className="text-xs text-[#9CA3AF]">
                  Duel {d.duel_order}
                </div>
              ))}
            </div>
          </div>
          
          {/* Resolved Duels */}
          <div className="bg-[#2A2215] border border-green-500/30 rounded-xl p-3">
            <h4 className="text-green-400 text-sm font-medium mb-2">✓ Résolus ({resolvedDuels.length})</h4>
            <div className="space-y-1 max-h-40 overflow-auto">
              {resolvedDuels.map(d => (
                <div key={d.id} className="text-xs text-[#9CA3AF]">
                  Duel {d.duel_order}
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Team Ranking */}
        <div className="bg-[#2A2215] border border-[#D4AF37]/20 rounded-xl p-4">
          <h4 className="text-[#D4AF37] font-bold mb-3 flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            Classement Équipes
            <span className="text-xs font-normal text-[#9CA3AF]">(PVic cumulés 🔄)</span>
          </h4>
          <div className="space-y-2">
            {teamRanking.slice(0, 10).map((team, idx) => (
              <TeamRankingRow key={team.name} team={team} idx={idx} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Team ranking row with tooltip/popover for long names
function TeamRankingRow({ team, idx }: { team: { name: string; totalPvic: number; players: Player[] }; idx: number }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  
  const rankColor = idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-gray-400' : idx === 2 ? 'text-amber-600' : 'text-[#9CA3AF]';
  
  // Mobile: truncate names, PC: show full names
  const mobileContent = (
    <div className="flex items-center justify-between p-2 rounded bg-[#1A1510]">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className={`font-bold shrink-0 ${rankColor}`}>
          #{idx + 1}
        </span>
        <span className="text-sm truncate">{team.name}</span>
      </div>
      <span className="text-[#D4AF37] font-bold shrink-0 ml-2">{team.totalPvic}</span>
    </div>
  );
  
  const desktopContent = (
    <div className="flex items-center justify-between p-2 rounded bg-[#1A1510]">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className={`font-bold shrink-0 ${rankColor}`}>
          #{idx + 1}
        </span>
        <span className="text-sm whitespace-nowrap">{team.name}</span>
      </div>
      <span className="text-[#D4AF37] font-bold shrink-0 ml-2">{team.totalPvic}</span>
    </div>
  );
  
  if (isMobile) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="cursor-pointer">{mobileContent}</div>
        </PopoverTrigger>
        <PopoverContent className="bg-[#2A2215] border-[#D4AF37]/30 text-white p-3 max-w-xs">
          <div className="text-sm font-medium break-words">{team.name}</div>
          <div className="text-xs text-[#D4AF37] mt-1">{team.totalPvic} PV</div>
        </PopoverContent>
      </Popover>
    );
  }
  
  // Desktop: full names + tooltip with player details
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-pointer">{desktopContent}</div>
        </TooltipTrigger>
        <TooltipContent className="bg-[#2A2215] border-[#D4AF37]/30 text-white max-w-sm p-3">
          <div className="font-medium text-[#D4AF37] mb-2">{team.name}</div>
          <div className="space-y-1">
            {team.players.map(p => (
              <div key={p.id} className="flex items-center gap-2 text-sm">
                <span className="text-[#9CA3AF]">#{p.player_number}</span>
                <span>{p.display_name}</span>
                <span className="text-[#D4AF37] ml-auto">{p.pvic || 0} PV</span>
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-[#D4AF37]/20 text-[#D4AF37] font-bold">
            Total: {team.totalPvic} PV
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
