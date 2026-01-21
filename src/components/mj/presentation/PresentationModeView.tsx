import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Heart, Trophy, Users, Target, Store, CheckCircle, Clock, Skull, Swords, RefreshCw, Coins, Sparkles } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getMonsterImage } from '@/lib/monsterImages';
import { CombatHistorySummarySheet } from './CombatHistorySummarySheet';
import logoNdogmoabeng from '@/assets/logo-ndogmoabeng.png';

interface Game {
  id: string;
  name: string;
  manche_active: number;
  phase: string;
  phase_locked: boolean;
  current_session_game_id: string | null;
}

interface MonsterState {
  id: string;
  monster_id: number;
  pv_current: number;
  status: 'EN_BATAILLE' | 'EN_FILE' | 'MORT';
  battlefield_slot: number | null;
  catalog?: {
    name: string;
    type: string | null;
    pv_max_default: number;
    reward_default: number;
  };
  config?: {
    pv_max_override: number | null;
    reward_override: number | null;
  };
}

interface Player {
  id: string;
  display_name: string;
  player_number: number;
  jetons: number;
  recompenses: number;
  mate_num: number | null;
  is_host: boolean;
  avatar_url: string | null;
  clan: string | null;
}

interface Team {
  members: Player[];
  teamScore: number;
  teamName: string;
}

interface Bet {
  num_joueur: number;
  manche: number;
  mise: number;
  status: string;
}

interface Action {
  num_joueur: number;
  manche: number;
}

interface Position {
  num_joueur: number;
  nom: string;
  position_finale: number;
}

interface PriorityRanking {
  player_id: string;
  num_joueur: number;
  display_name: string;
  rank: number;
}

interface ShopOffer {
  id: string;
  item_ids: string[];
}

interface ShopItem {
  id: string;
  name: string;
  category: string;
  detailed_description?: string | null;
  base_damage?: number;
  base_heal?: number;
}

interface ShopPrice {
  item_name: string;
  cost_normal: number;
  cost_akila: number;
}

interface ShopRequest {
  player_id: string;
  player_num: number;
}

interface CoupDeGraceInfo {
  killerName: string;
  monsterName: string;
  reward: number;
}

interface PresentationModeViewProps {
  game: Game;
  onClose: () => void;
}

export function PresentationModeView({ game: initialGame, onClose }: PresentationModeViewProps) {
  const [game, setGame] = useState<Game>(initialGame);
  const [monsters, setMonsters] = useState<MonsterState[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [bets, setBets] = useState<Bet[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [priorities, setPriorities] = useState<PriorityRanking[]>([]);
  const [shopOffer, setShopOffer] = useState<ShopOffer | null>(null);
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [shopPrices, setShopPrices] = useState<ShopPrice[]>([]);
  const [shopRequests, setShopRequests] = useState<ShopRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Animation states
  const [showPhaseTransition, setShowPhaseTransition] = useState(false);
  const [phaseTransitionText, setPhaseTransitionText] = useState('');
  const [showCoupDeGrace, setShowCoupDeGrace] = useState(false);
  const [coupDeGraceInfo, setCoupDeGraceInfo] = useState<CoupDeGraceInfo | null>(null);
  const previousPhaseRef = useRef<string>(initialGame.phase);
  const previousKillsCountRef = useRef<number>(0);

  const fetchData = useCallback(async () => {
    console.log('[Presentation] Fetching data for game', game.id, 'manche', game.manche_active, 'phase', game.phase);
    
    // First, fetch latest game state to ensure we have current phase/manche
    const { data: latestGame } = await supabase
      .from('games')
      .select('id, name, manche_active, phase, phase_locked, current_session_game_id')
      .eq('id', game.id)
      .single();
    
    if (latestGame) {
      // Check for phase change and trigger animation
      if (previousPhaseRef.current !== latestGame.phase) {
        triggerPhaseTransition(latestGame.phase);
        previousPhaseRef.current = latestGame.phase;
      }
      setGame(latestGame);
    }
    
    const manche = latestGame?.manche_active ?? game.manche_active;
    const sessionGameId = latestGame?.current_session_game_id ?? game.current_session_game_id;

    // Fetch monsters
    let monstersQuery = supabase
      .from('game_state_monsters')
      .select('id, monster_id, pv_current, status, battlefield_slot')
      .eq('game_id', game.id);
    
    if (sessionGameId) {
      monstersQuery = monstersQuery.eq('session_game_id', sessionGameId);
    }

    const { data: monstersData } = await monstersQuery.order('battlefield_slot', { ascending: true, nullsFirst: false });

    if (monstersData && monstersData.length > 0) {
      const monsterIds = monstersData.map(m => m.monster_id);
      const [catalogRes, configRes] = await Promise.all([
        supabase.from('monster_catalog').select('id, name, type, pv_max_default, reward_default').in('id', monsterIds),
        supabase.from('game_monsters').select('monster_id, pv_max_override, reward_override').eq('game_id', game.id).in('monster_id', monsterIds),
      ]);

      const catalogMap = new Map((catalogRes.data || []).map(c => [c.id, c]));
      const configMap = new Map((configRes.data || []).map(c => [c.monster_id, c]));

      setMonsters(monstersData.map(m => ({
        ...m,
        status: m.status as MonsterState['status'],
        catalog: catalogMap.get(m.monster_id),
        config: configMap.get(m.monster_id),
      })));
    } else {
      setMonsters([]);
    }

    // Fetch players with profile avatar
    const { data: playersData } = await supabase
      .from('game_players')
      .select('id, display_name, player_number, jetons, recompenses, mate_num, is_host, user_id, clan')
      .eq('game_id', game.id)
      .is('removed_at', null)
      .eq('is_host', false)
      .order('player_number');
    
    // Fetch avatar URLs from profiles for authenticated players
    let avatarMap = new Map<string, string>();
    if (playersData) {
      const userIds = playersData.filter(p => p.user_id).map(p => p.user_id);
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, avatar_url')
          .in('user_id', userIds);
        if (profilesData) {
          avatarMap = new Map(profilesData.map(p => [p.user_id, p.avatar_url]));
        }
      }
    }

    if (playersData) {
      setPlayers(playersData.map(p => ({
        ...p,
        jetons: p.jetons ?? 0,
        recompenses: p.recompenses ?? 0,
        avatar_url: p.user_id ? (avatarMap.get(p.user_id) || null) : null,
        clan: p.clan ?? null,
      })));
    }

    // Fetch bets for current manche
    const { data: betsData } = await supabase
      .from('round_bets')
      .select('num_joueur, manche, mise, status')
      .eq('game_id', game.id)
      .eq('manche', manche);
    setBets(betsData || []);

    // Fetch actions for current manche
    const { data: actionsData } = await supabase
      .from('actions')
      .select('num_joueur, manche')
      .eq('game_id', game.id)
      .eq('manche', manche);
    setActions(actionsData || []);

    // Fetch positions for current manche
    const { data: positionsData } = await supabase
      .from('positions_finales')
      .select('num_joueur, nom, position_finale')
      .eq('game_id', game.id)
      .eq('manche', manche);
    setPositions((positionsData || []).sort((a, b) => a.position_finale - b.position_finale));

    // Fetch priority rankings for current manche
    const { data: prioritiesData } = await supabase
      .from('priority_rankings')
      .select('player_id, num_joueur, display_name, rank')
      .eq('game_id', game.id)
      .eq('manche', manche);
    setPriorities((prioritiesData || []).sort((a, b) => a.rank - b.rank));

    // Fetch shop offer for current manche
    const { data: shopOfferData } = await supabase
      .from('game_shop_offers')
      .select('id, item_ids')
      .eq('game_id', game.id)
      .eq('manche', manche)
      .maybeSingle();
    
    setShopOffer(shopOfferData);

    // item_ids contains item NAMES, not IDs - fetch by name + prices
    if (shopOfferData?.item_ids && shopOfferData.item_ids.length > 0) {
      const [itemsRes, pricesRes] = await Promise.all([
        supabase
          .from('item_catalog')
          .select('id, name, category, detailed_description, base_damage, base_heal')
          .in('name', shopOfferData.item_ids),
        supabase
          .from('shop_prices')
          .select('item_name, cost_normal, cost_akila')
          .in('item_name', shopOfferData.item_ids),
      ]);
      setShopItems(itemsRes.data || []);
      setShopPrices(pricesRes.data || []);
      console.log('[Presentation] Shop items fetched:', itemsRes.data?.length, 'prices:', pricesRes.data?.length);
    } else {
      setShopItems([]);
      setShopPrices([]);
    }

    // Fetch shop requests for current manche
    const { data: shopRequestsData } = await supabase
      .from('shop_requests')
      .select('player_id, player_num')
      .eq('game_id', game.id)
      .eq('manche', manche);
    setShopRequests(shopRequestsData || []);

    // Check for new kills (coup de grâce) - only when in combat resolution
    if (sessionGameId) {
      const { data: combatResults } = await supabase
        .from('combat_results')
        .select('kills')
        .eq('game_id', game.id)
        .eq('session_game_id', sessionGameId);
      
      if (combatResults) {
        const allKills = combatResults.flatMap(r => {
          const kills = r.kills as unknown as { killerName: string; monsterName: string; reward: number }[];
          return kills || [];
        });
        
        // If we have more kills than before, show animation for the latest kill
        if (allKills.length > previousKillsCountRef.current && allKills.length > 0) {
          const latestKill = allKills[allKills.length - 1];
          triggerCoupDeGrace(latestKill);
        }
        previousKillsCountRef.current = allKills.length;
      }
    }

    setLastUpdate(new Date());
    setLoading(false);
    setIsRefreshing(false);
  }, [game.id, game.manche_active, game.current_session_game_id, game.phase]);

  const triggerPhaseTransition = (newPhase: string) => {
    const phaseNames: Record<string, string> = {
      'PHASE1_MISES': 'Phase des Mises',
      'PHASE2_POSITIONS': 'Phase des Actions',
      'PHASE3_SHOP': 'Phase Boutique',
      'SHOP': 'Phase Boutique',
      'PHASE4_COMBAT': 'Résolution du Combat',
      'RESOLUTION': 'Résolution du Combat',
    };
    setPhaseTransitionText(phaseNames[newPhase] || newPhase);
    setShowPhaseTransition(true);
    setTimeout(() => setShowPhaseTransition(false), 2500);
  };

  const triggerCoupDeGrace = (killInfo: CoupDeGraceInfo) => {
    setCoupDeGraceInfo(killInfo);
    setShowCoupDeGrace(true);
    setTimeout(() => setShowCoupDeGrace(false), 3500);
  };
  
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
  };

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel(`presentation-${game.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_state_monsters', filter: `game_id=eq.${game.id}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${game.id}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'round_bets', filter: `game_id=eq.${game.id}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'actions', filter: `game_id=eq.${game.id}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'positions_finales', filter: `game_id=eq.${game.id}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'priority_rankings', filter: `game_id=eq.${game.id}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_shop_offers', filter: `game_id=eq.${game.id}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_requests', filter: `game_id=eq.${game.id}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${game.id}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'combat_results', filter: `game_id=eq.${game.id}` }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [game.id, fetchData]);

  // Handle keyboard escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const getMonsterPvMax = (m: MonsterState) => m.config?.pv_max_override ?? m.catalog?.pv_max_default ?? 10;
  const getMonsterReward = (m: MonsterState) => m.config?.reward_override ?? m.catalog?.reward_default ?? 10;
  const getMonsterName = (m: MonsterState) => m.catalog?.name ?? `Monstre #${m.monster_id}`;
  const getMonsterType = (m: MonsterState) => m.catalog?.type ?? null;

  const battlefieldMonsters = monsters.filter(m => m.status === 'EN_BATAILLE');
  const queueMonsters = monsters.filter(m => m.status === 'EN_FILE');

  const totalPvCurrent = monsters.reduce((sum, m) => sum + m.pv_current, 0);
  const totalPvMax = monsters.reduce((sum, m) => sum + getMonsterPvMax(m), 0);
  const globalProgress = totalPvMax > 0 ? (totalPvCurrent / totalPvMax) * 100 : 0;

  // Build teams for ranking
  const buildTeams = (): Team[] => {
    const teams: Team[] = [];
    const processedPlayers = new Set<number>();

    // First pass: build all teams
    for (const player of players) {
      if (processedPlayers.has(player.player_number)) continue;

      const teammates: Player[] = [player];
      processedPlayers.add(player.player_number);

      if (player.mate_num) {
        const mate = players.find(p => p.player_number === player.mate_num);
        if (mate && !processedPlayers.has(mate.player_number)) {
          teammates.push(mate);
          processedPlayers.add(mate.player_number);
        }
      }

      const reverseMatches = players.filter(
        p => p.mate_num === player.player_number && !processedPlayers.has(p.player_number)
      );
      for (const rm of reverseMatches) {
        teammates.push(rm);
        processedPlayers.add(rm.player_number);
      }

      const rawScore = teammates.reduce((sum, p) => sum + p.recompenses, 0);
      const teamName = teammates.length === 1 ? teammates[0].display_name : teammates.map(t => t.display_name).join(' & ');

      teams.push({ members: teammates, teamScore: rawScore, teamName });
    }

    // Check if there's at least one real team (2+ members) in the game
    const hasRealTeams = teams.some(t => t.members.length > 1);

    // Only double solo scores if there are real teams to compete against
    if (hasRealTeams) {
      for (const team of teams) {
        if (team.members.length === 1) {
          team.teamScore = team.teamScore * 2;
        }
      }
    }

    return teams.sort((a, b) => b.teamScore - a.teamScore);
  };

  const teams = buildTeams();

  // Determine phase displays
  const isPhase1 = game.phase === 'PHASE1_MISES';
  const isPhase2 = game.phase === 'PHASE2_POSITIONS';
  const isPhase3 = game.phase === 'PHASE3_SHOP' || game.phase === 'SHOP';
  const isPhase4 = game.phase === 'PHASE4_COMBAT' || game.phase === 'RESOLUTION';
  const hasPositions = positions.length > 0;

  // Helper function to get clan emoji
  const getClanEmoji = (clan: string | null): string => {
    if (!clan) return '';
    const clanEmojis: Record<string, string> = {
      'Royaux': '👑',
      'Zoulous': '💰',
      'Keryndes': '🧭',
      'Akandé': '⚔️',
      'Aseyra': '📜',
      'Akila': '🔬',
      'Ezkar': '💥',
    };
    return clanEmojis[clan] || '';
  };

  // Actions validated / pending - use player numbers
  const submittedBetPlayerNums = new Set(bets.map(b => b.num_joueur));
  const submittedActionPlayerNums = new Set(actions.map(a => a.num_joueur));
  const submittedShopPlayerNums = new Set(shopRequests.map(r => r.player_num));

  let validatedPlayers: Player[] = [];
  let pendingPlayers: Player[] = [];

  if (isPhase1) {
    validatedPlayers = players.filter(p => submittedBetPlayerNums.has(p.player_number));
    pendingPlayers = players.filter(p => !submittedBetPlayerNums.has(p.player_number));
  } else if (isPhase2 && !hasPositions) {
    validatedPlayers = players.filter(p => submittedActionPlayerNums.has(p.player_number));
    pendingPlayers = players.filter(p => !submittedActionPlayerNums.has(p.player_number));
  } else if (isPhase3) {
    validatedPlayers = players.filter(p => submittedShopPlayerNums.has(p.player_number));
    pendingPlayers = players.filter(p => !submittedShopPlayerNums.has(p.player_number));
  }

  // Loading screen with animation
  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] bg-gradient-to-b from-background to-secondary flex flex-col items-center justify-center gap-6">
        {/* Animated logo */}
        <div className="relative">
          <img 
            src={logoNdogmoabeng} 
            alt="Village de Ndogmoabeng" 
            className="w-32 h-32 md:w-48 md:h-48 animate-pulse"
            style={{
              animation: 'logoFloat 2s ease-in-out infinite, logoPulse 1.5s ease-in-out infinite',
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent rounded-full animate-ping opacity-30" />
        </div>
        
        {/* Loading message */}
        <div className="text-center space-y-2">
          <p className="text-lg md:text-xl font-semibold text-foreground animate-pulse">
            Un instant, on range la salle...
          </p>
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
        
        <style>{`
          @keyframes logoFloat {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-10px) rotate(2deg); }
          }
          @keyframes logoPulse {
            0%, 100% { filter: drop-shadow(0 0 10px hsl(var(--primary) / 0.3)); }
            50% { filter: drop-shadow(0 0 25px hsl(var(--primary) / 0.6)); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 z-[100] bg-gradient-to-b from-background to-secondary text-foreground overflow-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Phase Transition Animation Overlay */}
      {showPhaseTransition && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/90 backdrop-blur-md animate-fade-in">
          <div className="text-center space-y-4">
            <div className="relative">
              <Sparkles className="w-16 h-16 md:w-24 md:h-24 text-primary mx-auto animate-pulse" />
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl animate-ping" />
            </div>
            <h2 
              className="text-2xl md:text-4xl font-bold text-primary"
              style={{
                animation: 'phaseSlideIn 0.5s ease-out forwards',
              }}
            >
              {phaseTransitionText}
            </h2>
            <div className="flex justify-center gap-1">
              {[0, 1, 2, 3, 4].map(i => (
                <div 
                  key={i}
                  className="w-3 h-3 bg-primary rounded-full"
                  style={{
                    animation: 'phaseDot 0.6s ease-in-out infinite',
                    animationDelay: `${i * 100}ms`,
                  }}
                />
              ))}
            </div>
          </div>
          <style>{`
            @keyframes phaseSlideIn {
              from { opacity: 0; transform: translateY(20px) scale(0.9); }
              to { opacity: 1; transform: translateY(0) scale(1); }
            }
            @keyframes phaseDot {
              0%, 100% { transform: scale(1); opacity: 0.5; }
              50% { transform: scale(1.5); opacity: 1; }
            }
          `}</style>
        </div>
      )}

      {/* Coup de Grâce Animation Overlay */}
      {showCoupDeGrace && coupDeGraceInfo && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none">
          <div 
            className="text-center space-y-4 p-8 rounded-3xl"
            style={{
              background: 'radial-gradient(circle, hsl(var(--destructive) / 0.3) 0%, transparent 70%)',
              animation: 'coupDeGraceIn 0.3s ease-out forwards',
            }}
          >
            {/* Skull animation */}
            <div className="relative inline-block">
              <Skull 
                className="w-20 h-20 md:w-32 md:h-32 text-destructive mx-auto"
                style={{
                  animation: 'skullPulse 0.5s ease-out forwards, skullGlow 1s ease-in-out infinite',
                }}
              />
              {/* Blood splatter effect */}
              <div className="absolute inset-0">
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-3 h-3 bg-destructive rounded-full"
                    style={{
                      top: '50%',
                      left: '50%',
                      animation: `bloodSplatter 0.8s ease-out forwards`,
                      animationDelay: `${i * 50}ms`,
                      transform: `rotate(${i * 45}deg)`,
                    }}
                  />
                ))}
              </div>
            </div>
            
            {/* Kill info */}
            <div className="space-y-2">
              <h3 
                className="text-xl md:text-3xl font-black text-destructive uppercase tracking-wider"
                style={{ animation: 'textFlash 0.5s ease-out' }}
              >
                Coup de Grâce !
              </h3>
              <p className="text-lg md:text-xl text-foreground font-semibold">
                <span className="text-primary">{coupDeGraceInfo.killerName}</span>
                <span className="text-muted-foreground"> élimine </span>
                <span className="text-destructive">{coupDeGraceInfo.monsterName}</span>
              </p>
              <div className="flex items-center justify-center gap-2 text-amber-500 text-xl md:text-2xl font-bold">
                <Trophy className="w-6 h-6 md:w-8 md:h-8" />
                <span>+{coupDeGraceInfo.reward}</span>
              </div>
            </div>
          </div>
          <style>{`
            @keyframes coupDeGraceIn {
              from { opacity: 0; transform: scale(0.5); }
              to { opacity: 1; transform: scale(1); }
            }
            @keyframes skullPulse {
              0% { transform: scale(0); }
              50% { transform: scale(1.3); }
              100% { transform: scale(1); }
            }
            @keyframes skullGlow {
              0%, 100% { filter: drop-shadow(0 0 10px hsl(var(--destructive))); }
              50% { filter: drop-shadow(0 0 30px hsl(var(--destructive))) drop-shadow(0 0 60px hsl(var(--destructive) / 0.5)); }
            }
            @keyframes bloodSplatter {
              0% { transform: rotate(var(--rotation, 0deg)) translateX(0) scale(1); opacity: 1; }
              100% { transform: rotate(var(--rotation, 0deg)) translateX(80px) scale(0); opacity: 0; }
            }
            @keyframes textFlash {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.5; }
            }
          `}</style>
        </div>
      )}

      {/* Close hint + Last update indicator + Manual refresh button + History */}
      <div className="absolute top-2 md:top-4 right-2 md:right-4 flex items-center gap-2 md:gap-3 text-xs text-muted-foreground z-10">
        <CombatHistorySummarySheet gameId={game.id} sessionGameId={game.current_session_game_id} />
        <Button
          variant="outline"
          size="sm"
          onClick={handleManualRefresh}
          disabled={isRefreshing}
          className="h-6 md:h-7 px-2 gap-1 md:gap-1.5 bg-card/50 border-border hover:bg-card"
        >
          <RefreshCw className={`h-3 md:h-3.5 w-3 md:w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Actualiser</span>
        </Button>
        <div className="hidden sm:flex items-center gap-1.5 bg-card/50 px-2 py-1 rounded-md border border-border">
          <RefreshCw className="h-3 w-3 text-primary animate-pulse" />
          <span>Sync : {format(lastUpdate, 'HH:mm:ss', { locale: fr })}</span>
        </div>
        <span className="hidden md:inline">ESC pour fermer</span>
      </div>

      {/* Centered Logo with link to home */}
      <div className="absolute top-2 md:top-4 left-1/2 transform -translate-x-1/2 z-10">
        <a href="/" className="block">
          <img 
            src={logoNdogmoabeng} 
            alt="Ndogmoabeng" 
            className="h-10 md:h-14 w-auto object-contain hover:scale-105 transition-transform cursor-pointer"
          />
        </a>
      </div>

      {/* Header with phase info */}
      <div className="absolute top-2 md:top-4 left-2 md:left-4 z-10 flex flex-wrap items-center gap-1 md:gap-2">
        <Badge className="bg-primary/80 text-primary-foreground text-xs md:text-lg px-2 md:px-4 py-1 md:py-2">
          {game.name} — M{game.manche_active}
        </Badge>
        <Badge className="bg-amber-600/80 text-white px-2 md:px-3 py-0.5 md:py-1 text-xs">
          {game.phase.replace('PHASE', 'P').replace('_', ':')}
        </Badge>
      </div>

      <div className="min-h-full flex flex-col p-3 md:p-6 pt-14 md:pt-20 pb-6">
        {/* Global HP Bar - TOP CENTER */}
        <div className="flex justify-center mb-3 md:mb-6">
          <div className="w-full max-w-2xl">
            <div className="flex items-center justify-between text-xs md:text-sm mb-1 md:mb-2">
              <span className="flex items-center gap-1 md:gap-2">
                <Heart className="h-4 md:h-5 w-4 md:w-5 text-destructive" />
                <span className="text-muted-foreground hidden sm:inline">Santé Globale de la Forêt</span>
                <span className="text-muted-foreground sm:hidden">PV Forêt</span>
              </span>
              <span className="font-mono text-sm md:text-lg font-bold text-destructive">
                {totalPvCurrent}/{totalPvMax} ({Math.round(globalProgress)}%)
              </span>
            </div>
            <Progress value={globalProgress} className="h-2 md:h-4" />
          </div>
        </div>

        {/* Main content grid - Phase 3 specific compact layout */}
        {isPhase3 ? (
          <div className="flex flex-col md:grid md:grid-cols-12 gap-3 md:flex-1 md:overflow-hidden">
            {/* Left: Battlefield compact + Validation status */}
            <div className="md:col-span-4 flex flex-col gap-3">
              {/* Battlefield compact */}
              <div className="bg-card/50 rounded-xl border border-border p-2 md:p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Swords className="h-4 w-4 text-destructive" />
                  <h2 className="text-sm font-bold">Champ de Bataille</h2>
                </div>
                <div className="grid grid-cols-3 gap-1 md:gap-2">
                  {[1, 2, 3].map(slot => {
                    const monster = battlefieldMonsters.find(m => m.battlefield_slot === slot);
                    return (
                      <div key={slot} className="flex flex-col items-center p-1.5 md:p-2 rounded-lg bg-secondary/50 border border-border">
                        <div className="text-[10px] text-muted-foreground">Slot {slot}</div>
                        {monster ? (
                          <>
                            <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg overflow-hidden my-1 bg-secondary/50">
                              {monster.status === 'MORT' ? (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Skull className="h-5 md:h-6 w-5 md:w-6 text-muted-foreground" />
                                </div>
                              ) : getMonsterImage(monster.monster_id) ? (
                                <img 
                                  src={getMonsterImage(monster.monster_id)} 
                                  alt={getMonsterName(monster)}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-xl md:text-2xl">🐉</div>
                              )}
                            </div>
                            {getMonsterType(monster) && (
                              <div className="text-[8px] md:text-[10px] text-muted-foreground">{getMonsterType(monster)}</div>
                            )}
                            <div className="text-[10px] md:text-xs font-bold text-center truncate w-full">{getMonsterName(monster)}</div>
                            <div className="flex items-center gap-1 text-[8px] md:text-[10px] mt-0.5">
                              <Heart className="h-2.5 md:h-3 w-2.5 md:w-3 text-destructive" />
                              {getMonsterPvMax(monster)}
                              <Trophy className="h-2.5 md:h-3 w-2.5 md:w-3 text-amber-500 ml-1" />
                              {getMonsterReward(monster)}
                            </div>
                          </>
                        ) : (
                          <span className="text-muted-foreground text-xs py-4">Vide</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Queue compact */}
              {queueMonsters.length > 0 && (
                <div className="bg-card/50 rounded-lg border border-amber-600/50 p-2">
                  <div className="flex items-center gap-1 mb-1">
                    <Users className="h-3 w-3 text-amber-500" />
                    <span className="text-xs font-semibold text-amber-500">File ({queueMonsters.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {queueMonsters.slice(0, 4).map(m => (
                      <div key={m.id} className="flex items-center gap-1 text-[10px] md:text-xs bg-amber-500/10 px-1.5 md:px-2 py-0.5 rounded">
                        <div className="w-4 h-4 md:w-5 md:h-5 rounded overflow-hidden flex-shrink-0">
                          {getMonsterImage(m.monster_id) ? (
                            <img src={getMonsterImage(m.monster_id)} alt={getMonsterName(m)} className="w-full h-full object-cover" />
                          ) : (
                            <span>🐉</span>
                          )}
                        </div>
                        <span className="hidden sm:inline">{getMonsterName(m)}</span>
                        <span className="sm:hidden">{getMonsterName(m).slice(0, 6)}</span>
                      </div>
                    ))}
                    {queueMonsters.length > 4 && <span className="text-[10px] md:text-xs text-amber-500">+{queueMonsters.length - 4}</span>}
                  </div>
                </div>
              )}

              {/* Validation status */}
              <div className="flex-1 flex flex-col gap-2">
                <div className="bg-green-500/10 rounded-lg border border-green-600/30 p-2 flex-1">
                  <div className="flex items-center gap-1.5 mb-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-semibold text-green-500">Validés ({validatedPlayers.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {validatedPlayers.map(p => (
                      <Badge key={p.id} className="bg-green-600/50 text-green-100 text-xs py-0.5">
                        {p.display_name}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="bg-orange-500/10 rounded-lg border border-orange-600/30 p-2 flex-1">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Clock className="h-4 w-4 text-orange-500" />
                    <span className="text-sm font-semibold text-orange-500">En attente ({pendingPlayers.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {pendingPlayers.map(p => (
                      <Badge key={p.id} className="bg-orange-600/50 text-orange-100 text-xs py-0.5">
                        {p.display_name}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Middle: Shop items */}
            <div className="md:col-span-5 flex flex-col gap-3">
              <div className="bg-purple-500/10 rounded-xl border border-purple-600/30 p-2 md:p-3 flex-1 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Store className="h-4 md:h-5 w-4 md:w-5 text-purple-500" />
                    <h3 className="font-semibold text-purple-500 text-sm md:text-base">Boutique</h3>
                  </div>
                  <Badge className="bg-purple-600/50 text-purple-100 text-[10px] md:text-xs">
                    {submittedShopPlayerNums.size}/{players.length} soumis
                  </Badge>
                </div>
                <ScrollArea className="flex-1 max-h-[200px] md:max-h-none">
                  <div className="grid grid-cols-2 gap-1.5 md:gap-2 pr-2">
                    {shopItems.map(item => {
                      const price = shopPrices.find(p => p.item_name === item.name);
                      return (
                        <div key={item.id} className="bg-purple-500/20 rounded-lg p-1.5 md:p-2 border border-purple-600/40">
                          <div className="font-bold text-[11px] md:text-sm mb-0.5 md:mb-1">{item.name}</div>
                          <p className="text-[10px] md:text-xs text-muted-foreground line-clamp-1 md:line-clamp-2 mb-0.5 md:mb-1">
                            {item.detailed_description || item.category}
                          </p>
                          <div className="flex items-center justify-between text-[10px] md:text-xs">
                            <div className="flex items-center gap-1 md:gap-2">
                              {item.base_damage && item.base_damage > 0 && (
                                <span className="text-destructive flex items-center gap-0.5">
                                  <Swords className="h-2.5 md:h-3 w-2.5 md:w-3" />
                                  {item.base_damage}
                                </span>
                              )}
                              {item.base_heal && item.base_heal > 0 && (
                                <span className="text-green-500 flex items-center gap-0.5">
                                  <Heart className="h-2.5 md:h-3 w-2.5 md:w-3" />
                                  {item.base_heal}
                                </span>
                              )}
                            </div>
                            {price && (
                              <div className="flex items-center gap-1 md:gap-2 text-[9px] md:text-[10px]">
                                <span className="flex items-center gap-0.5 text-amber-400">
                                  <Coins className="h-2.5 md:h-3 w-2.5 md:w-3" />
                                  {price.cost_normal}
                                </span>
                                <span className="text-muted-foreground">/</span>
                                <span className="text-cyan-400">{price.cost_akila}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            </div>

            {/* Right: Rankings + Priority */}
            <div className="md:col-span-3 flex flex-col gap-3 md:overflow-hidden">
              {/* Priority order */}
              {priorities.length > 0 && (
                <div className="bg-blue-500/10 rounded-lg border border-blue-600/30 p-2">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Target className="h-3.5 md:h-4 w-3.5 md:w-4 text-blue-500" />
                    <span className="text-xs md:text-sm font-semibold text-blue-500">Priorité (mises)</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {priorities.map((pr, index) => {
                      const player = players.find(p => p.player_number === pr.num_joueur);
                      return (
                        <div key={pr.player_id} className="flex items-center gap-0.5 md:gap-1">
                          <Avatar className={`h-5 md:h-6 w-5 md:w-6 border ${index === 0 ? 'border-blue-500' : 'border-blue-500/50'}`}>
                            <AvatarImage src={player?.avatar_url || undefined} alt={pr.display_name} />
                            <AvatarFallback className={`${index === 0 ? 'bg-blue-600' : 'bg-blue-600/50'} text-white text-[8px] md:text-[10px]`}>
                              {pr.display_name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-[10px] md:text-xs">#{pr.rank}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Team ranking */}
              <div className="bg-amber-500/10 rounded-xl border border-amber-600/30 p-2 flex-1 overflow-hidden flex flex-col">
                <div className="flex items-center gap-1.5 mb-2">
                  <Trophy className="h-3.5 md:h-4 w-3.5 md:w-4 text-amber-500" />
                  <span className="text-xs md:text-sm font-semibold text-amber-500">Classement</span>
                </div>
                <ScrollArea className="flex-1 max-h-[150px] md:max-h-none">
                  <div className="space-y-1">
                    {teams.map((team, index) => (
                      <div 
                        key={team.teamName}
                        className={`flex items-center justify-between p-1 md:p-1.5 rounded-lg text-xs md:text-sm ${
                          index === 0 ? 'bg-amber-500/30 border border-amber-500' :
                          index === 1 ? 'bg-secondary border border-border' :
                          index === 2 ? 'bg-amber-700/30 border border-amber-700' :
                          'bg-secondary/50'
                        }`}
                      >
                        <div className="flex items-center gap-1 md:gap-1.5 min-w-0">
                          <span className="text-sm md:text-base flex-shrink-0">
                            {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                          </span>
                          {team.members.length === 1 && team.members[0].clan && (
                            <span className="text-[10px] flex-shrink-0" title={team.members[0].clan}>{getClanEmoji(team.members[0].clan)}</span>
                          )}
                          <span className="font-medium truncate max-w-[60px] md:max-w-[100px]">{team.teamName}</span>
                        </div>
                        <span className="font-bold text-amber-500">{team.teamScore}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </div>
        ) : (
          /* Default layout for other phases */
          <div className="flex flex-col md:grid md:grid-cols-12 gap-3 md:gap-4 md:flex-1 md:overflow-hidden">
            {/* Left section: Battlefield + Queue */}
            <div className="md:col-span-7 flex flex-col gap-3 md:gap-4">
              {/* Battlefield monsters */}
              <div className="flex-1 bg-card/50 rounded-xl border border-border p-3 md:p-4">
                <div className="flex items-center gap-2 mb-3 md:mb-4">
                  <Swords className="h-4 md:h-5 w-4 md:w-5 text-destructive" />
                  <h2 className="text-base md:text-lg font-bold">Champ de Bataille</h2>
                </div>
                <div className="grid grid-cols-3 gap-2 md:gap-6">
                  {[1, 2, 3].map(slot => {
                    const monster = battlefieldMonsters.find(m => m.battlefield_slot === slot);
                    return (
                      <div 
                        key={slot}
                        className="flex flex-col items-center justify-center p-2 md:p-4 rounded-xl bg-secondary/50 border border-border"
                      >
                        <div className="text-[10px] md:text-xs text-muted-foreground mb-1 md:mb-2">Slot {slot}</div>
                        {monster ? (
                          <>
                            <div className="w-14 h-14 md:w-24 md:h-24 rounded-lg md:rounded-xl overflow-hidden mb-1 md:mb-3 bg-secondary">
                              {monster.status === 'MORT' ? (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Skull className="h-8 md:h-16 w-8 md:w-16 text-muted-foreground" />
                                </div>
                              ) : getMonsterImage(monster.monster_id) ? (
                                <img 
                                  src={getMonsterImage(monster.monster_id)} 
                                  alt={getMonsterName(monster)}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-3xl md:text-6xl">🐉</div>
                              )}
                            </div>
                            {getMonsterType(monster) && (
                              <div className="text-[10px] md:text-xs text-muted-foreground">{getMonsterType(monster)}</div>
                            )}
                            <div className="text-xs md:text-lg font-bold text-center mb-1 md:mb-2 truncate w-full">{getMonsterName(monster)}</div>
                            <div className="flex items-center gap-2 md:gap-4 text-[10px] md:text-sm">
                              <span className="flex items-center gap-0.5 md:gap-1 text-destructive">
                                <Heart className="h-3 md:h-4 w-3 md:w-4" />
                                {getMonsterPvMax(monster)}
                              </span>
                              <span className="flex items-center gap-0.5 md:gap-1 text-amber-500">
                                <Trophy className="h-3 md:h-4 w-3 md:w-4" />
                                {getMonsterReward(monster)}
                              </span>
                            </div>
                          </>
                        ) : (
                          <span className="text-muted-foreground text-xs md:text-sm">Vide</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Queue monsters */}
              {queueMonsters.length > 0 && (
                <div className="bg-card/50 rounded-xl border border-amber-600/50 p-2 md:p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-3.5 md:h-4 w-3.5 md:w-4 text-amber-500" />
                    <h3 className="text-xs md:text-sm font-semibold text-amber-500">File d'attente ({queueMonsters.length})</h3>
                  </div>
                  <div className="flex flex-wrap gap-1.5 md:gap-2">
                    {queueMonsters.map(m => (
                      <div key={m.id} className="flex items-center gap-1.5 md:gap-2 bg-amber-500/10 px-2 md:px-3 py-1 md:py-1.5 rounded-lg border border-amber-500/30">
                        <div className="w-6 h-6 md:w-8 md:h-8 rounded overflow-hidden flex-shrink-0">
                          {getMonsterImage(m.monster_id) ? (
                            <img src={getMonsterImage(m.monster_id)} alt={getMonsterName(m)} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-lg md:text-2xl">🐉</span>
                          )}
                        </div>
                        <div className="flex flex-col">
                          {getMonsterType(m) && (
                            <span className="text-[8px] md:text-[10px] text-muted-foreground">{getMonsterType(m)}</span>
                          )}
                          <span className="text-xs md:text-sm font-medium">{getMonsterName(m)}</span>
                          <div className="flex items-center gap-1 md:gap-2 text-[9px] md:text-xs">
                            <span className="flex items-center gap-0.5 text-destructive">
                              <Heart className="h-2.5 md:h-3 w-2.5 md:w-3" />
                              {getMonsterPvMax(m)}
                            </span>
                            <span className="flex items-center gap-0.5 text-amber-500">
                              <Trophy className="h-2.5 md:h-3 w-2.5 md:w-3" />
                              {getMonsterReward(m)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right section: Status + Rankings */}
            <div className="md:col-span-5 flex flex-col gap-3 md:gap-4 md:overflow-hidden">
              {/* Validation status for Phase 1 or Phase 2 before positions */}
              {(isPhase1 || (isPhase2 && !hasPositions)) && (
                <div className="grid grid-cols-2 gap-2 md:gap-3">
                  <div className="bg-green-500/10 rounded-xl border border-green-600/30 p-2 md:p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <CheckCircle className="h-3.5 md:h-4 w-3.5 md:w-4 text-green-500" />
                      <span className="text-xs md:text-sm font-semibold text-green-500">Validés ({validatedPlayers.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {validatedPlayers.map(p => (
                        <Badge key={p.id} className="bg-green-600/50 text-green-100 text-xs py-0.5">
                          {p.display_name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="bg-orange-500/10 rounded-xl border border-orange-600/30 p-2 md:p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Clock className="h-3.5 md:h-4 w-3.5 md:w-4 text-orange-500" />
                      <span className="text-xs md:text-sm font-semibold text-orange-500">En attente ({pendingPlayers.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {pendingPlayers.map(p => (
                        <Badge key={p.id} className="bg-orange-600/50 text-orange-100 text-xs py-0.5">
                          {p.display_name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Priority order in Phase 2 after positions are assigned or in combat */}
              {((isPhase2 && hasPositions) || isPhase4) && priorities.length > 0 && (
                <div className="bg-blue-500/10 rounded-xl border border-blue-600/30 p-2 md:p-4">
                  <div className="flex items-center gap-2 mb-2 md:mb-3">
                    <Target className="h-4 md:h-5 w-4 md:w-5 text-blue-500" />
                    <h3 className="text-sm md:text-base font-semibold text-blue-500">Ordre d'attaque (mises)</h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                    {priorities.map((pr, index) => {
                      const player = players.find(p => p.player_number === pr.num_joueur);
                      return (
                        <div 
                          key={pr.player_id} 
                          className={`flex items-center gap-1 md:gap-1.5 px-1.5 md:px-2 py-0.5 md:py-1 rounded-lg ${
                            index === 0 ? 'bg-blue-600/40 border border-blue-500' : 'bg-blue-500/20'
                          }`}
                        >
                          <Avatar className={`h-5 md:h-7 w-5 md:w-7 border-2 ${index === 0 ? 'border-blue-400' : 'border-blue-500/50'}`}>
                            <AvatarImage src={player?.avatar_url || undefined} alt={pr.display_name} />
                            <AvatarFallback className={`${index === 0 ? 'bg-blue-600' : 'bg-blue-600/50'} text-white text-[9px] md:text-xs`}>
                              {pr.display_name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs md:text-sm font-medium">{pr.display_name}</span>
                          <span className="text-[10px] md:text-xs text-blue-400">#{pr.rank}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Team Ranking */}
              <div className="flex-1 bg-amber-500/10 rounded-xl border border-amber-600/30 p-2 md:p-4 overflow-hidden flex flex-col">
                <div className="flex items-center gap-2 mb-2 md:mb-3">
                  <Trophy className="h-4 md:h-5 w-4 md:w-5 text-amber-500" />
                  <h3 className="text-sm md:text-base font-semibold text-amber-500">Classement des équipes</h3>
                </div>
                <ScrollArea className="flex-1">
                  <div className="space-y-1 md:space-y-2 pr-3">
                    {teams.map((team, index) => (
                      <div 
                        key={team.teamName}
                        className={`flex items-center justify-between p-1.5 md:p-2 rounded-lg ${
                          index === 0 ? 'bg-amber-500/30 border border-amber-500' :
                          index === 1 ? 'bg-secondary border border-border' :
                          index === 2 ? 'bg-amber-700/30 border border-amber-700' :
                          'bg-secondary/50'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 md:gap-2 min-w-0">
                          <span className="text-lg md:text-2xl flex-shrink-0">
                            {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                          </span>
                          <div className="flex items-center gap-1 md:gap-2">
                            {team.members.map((member, mi) => (
                              <div key={member.id} className="flex items-center">
                                <Avatar className={`h-5 md:h-8 w-5 md:w-8 border-2 ${mi > 0 ? '-ml-2 md:-ml-3' : ''} ${index === 0 ? 'border-amber-400' : 'border-border'}`}>
                                  <AvatarImage src={member.avatar_url || undefined} alt={member.display_name} />
                                  <AvatarFallback className="bg-secondary text-foreground text-[9px] md:text-xs">
                                    {member.display_name.charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                              </div>
                            ))}
                          </div>
                          {team.members.length === 1 && team.members[0].clan && (
                            <span className="text-sm md:text-base flex-shrink-0" title={team.members[0].clan}>{getClanEmoji(team.members[0].clan)}</span>
                          )}
                          <span className="font-medium text-xs md:text-base truncate max-w-[80px] md:max-w-[150px]">{team.teamName}</span>
                        </div>
                        <span className="font-bold text-amber-500 text-sm md:text-xl">{team.teamScore}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
