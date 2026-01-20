import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Heart, Trophy, Users, Target, Store, CheckCircle, Clock, Skull, Swords, RefreshCw } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getMonsterImage } from '@/lib/monsterImages';

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

interface ShopRequest {
  player_id: string;
  player_num: number;
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
  const [shopRequests, setShopRequests] = useState<ShopRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    console.log('[Presentation] Fetching data for game', game.id, 'manche', game.manche_active, 'phase', game.phase);
    
    // First, fetch latest game state to ensure we have current phase/manche
    const { data: latestGame } = await supabase
      .from('games')
      .select('id, name, manche_active, phase, phase_locked, current_session_game_id')
      .eq('id', game.id)
      .single();
    
    if (latestGame) {
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
        supabase.from('monster_catalog').select('id, name, pv_max_default, reward_default').in('id', monsterIds),
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
      .select('id, display_name, player_number, jetons, recompenses, mate_num, is_host, user_id')
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

    // item_ids contains item NAMES, not IDs - fetch by name
    if (shopOfferData?.item_ids && shopOfferData.item_ids.length > 0) {
      const { data: itemsData } = await supabase
        .from('item_catalog')
        .select('id, name, category, detailed_description, base_damage, base_heal')
        .in('name', shopOfferData.item_ids);
      setShopItems(itemsData || []);
      console.log('[Presentation] Shop items fetched:', itemsData?.length, 'for names:', shopOfferData.item_ids);
    } else {
      setShopItems([]);
    }

    // Fetch shop requests for current manche
    const { data: shopRequestsData } = await supabase
      .from('shop_requests')
      .select('player_id, player_num')
      .eq('game_id', game.id)
      .eq('manche', manche);
    setShopRequests(shopRequestsData || []);

    setLastUpdate(new Date());
    setLoading(false);
    setIsRefreshing(false);
  }, [game.id, game.manche_active, game.current_session_game_id, game.phase]);
  
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

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] bg-background flex items-center justify-center">
        <div className="text-foreground text-xl">Chargement...</div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 z-[100] bg-gradient-to-b from-background to-secondary text-foreground overflow-hidden"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Close hint + Last update indicator + Manual refresh button */}
      <div className="absolute top-4 right-4 flex items-center gap-3 text-xs text-muted-foreground z-10">
        <Button
          variant="outline"
          size="sm"
          onClick={handleManualRefresh}
          disabled={isRefreshing}
          className="h-7 px-2 gap-1.5 bg-card/50 border-border hover:bg-card"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>Actualiser</span>
        </Button>
        <div className="flex items-center gap-1.5 bg-card/50 px-2 py-1 rounded-md border border-border">
          <RefreshCw className="h-3 w-3 text-primary animate-pulse" />
          <span>Sync : {format(lastUpdate, 'HH:mm:ss', { locale: fr })}</span>
        </div>
        <span>ESC pour fermer</span>
      </div>

      {/* Header with phase info */}
      <div className="absolute top-4 left-4 z-10">
        <Badge className="bg-primary/80 text-primary-foreground text-lg px-4 py-2">
          {game.name} — Manche {game.manche_active}
        </Badge>
        <Badge className="ml-2 bg-amber-600/80 text-white px-3 py-1">
          {game.phase.replace('PHASE', 'Phase ').replace('_', ' : ')}
        </Badge>
      </div>

      <div className="h-full flex flex-col p-6 pt-20">
        {/* Global HP Bar - TOP CENTER */}
        <div className="flex justify-center mb-6">
          <div className="w-full max-w-2xl">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-destructive" />
                <span className="text-muted-foreground">Santé Globale de la Forêt</span>
              </span>
              <span className="font-mono text-lg font-bold text-destructive">
                {totalPvCurrent} / {totalPvMax} PV ({Math.round(globalProgress)}%)
              </span>
            </div>
            <Progress value={globalProgress} className="h-4" />
          </div>
        </div>

        {/* Main content grid - Phase 3 specific compact layout */}
        {isPhase3 ? (
          <div className="flex-1 grid grid-cols-12 gap-3 overflow-hidden">
            {/* Left: Battlefield compact + Validation status */}
            <div className="col-span-4 flex flex-col gap-3">
              {/* Battlefield compact */}
              <div className="bg-card/50 rounded-xl border border-border p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Swords className="h-4 w-4 text-destructive" />
                  <h2 className="text-sm font-bold">Champ de Bataille</h2>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map(slot => {
                    const monster = battlefieldMonsters.find(m => m.battlefield_slot === slot);
                    return (
                      <div key={slot} className="flex flex-col items-center p-2 rounded-lg bg-secondary/50 border border-border">
                        <div className="text-[10px] text-muted-foreground">Slot {slot}</div>
                        {monster ? (
                          <>
                            <div className="w-12 h-12 rounded-lg overflow-hidden my-1 bg-secondary/50">
                              {monster.status === 'MORT' ? (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Skull className="h-6 w-6 text-muted-foreground" />
                                </div>
                              ) : getMonsterImage(monster.monster_id) ? (
                                <img 
                                  src={getMonsterImage(monster.monster_id)} 
                                  alt={getMonsterName(monster)}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-2xl">🐉</div>
                              )}
                            </div>
                            <div className="text-xs font-bold text-center truncate w-full">{getMonsterName(monster)}</div>
                            <div className="flex items-center gap-1 text-[10px] mt-1">
                              <Heart className="h-3 w-3 text-destructive" />
                              {getMonsterPvMax(monster)}
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
                      <div key={m.id} className="flex items-center gap-1 text-xs bg-amber-500/10 px-2 py-0.5 rounded">
                        <div className="w-5 h-5 rounded overflow-hidden flex-shrink-0">
                          {getMonsterImage(m.monster_id) ? (
                            <img src={getMonsterImage(m.monster_id)} alt={getMonsterName(m)} className="w-full h-full object-cover" />
                          ) : (
                            <span>🐉</span>
                          )}
                        </div>
                        <span>{getMonsterName(m)}</span>
                      </div>
                    ))}
                    {queueMonsters.length > 4 && <span className="text-xs text-amber-500">+{queueMonsters.length - 4}</span>}
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
            <div className="col-span-5 flex flex-col gap-3">
              <div className="bg-purple-500/10 rounded-xl border border-purple-600/30 p-3 flex-1 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Store className="h-5 w-5 text-purple-500" />
                    <h3 className="font-semibold text-purple-500">Boutique</h3>
                  </div>
                  <Badge className="bg-purple-600/50 text-purple-100 text-xs">
                    {submittedShopPlayerNums.size}/{players.length} soumis
                  </Badge>
                </div>
                <ScrollArea className="flex-1">
                  <div className="grid grid-cols-2 gap-2 pr-2">
                    {shopItems.map(item => (
                      <div key={item.id} className="bg-purple-500/20 rounded-lg p-2 border border-purple-600/40">
                        <div className="font-bold text-sm mb-1">{item.name}</div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-1">
                          {item.detailed_description || item.category}
                        </p>
                        <div className="flex items-center gap-2 text-xs">
                          {item.base_damage && item.base_damage > 0 && (
                            <span className="text-destructive flex items-center gap-0.5">
                              <Swords className="h-3 w-3" />
                              {item.base_damage}
                            </span>
                          )}
                          {item.base_heal && item.base_heal > 0 && (
                            <span className="text-green-500 flex items-center gap-0.5">
                              <Heart className="h-3 w-3" />
                              {item.base_heal}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>

            {/* Right: Rankings + Priority */}
            <div className="col-span-3 flex flex-col gap-3 overflow-hidden">
              {/* Priority order */}
              {priorities.length > 0 && (
                <div className="bg-blue-500/10 rounded-lg border border-blue-600/30 p-2">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Target className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-semibold text-blue-500">Priorité (mises)</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {priorities.map((pr, index) => {
                      const player = players.find(p => p.player_number === pr.num_joueur);
                      return (
                        <div key={pr.player_id} className="flex items-center gap-1">
                          <Avatar className={`h-6 w-6 border ${index === 0 ? 'border-blue-500' : 'border-blue-500/50'}`}>
                            <AvatarImage src={player?.avatar_url || undefined} alt={pr.display_name} />
                            <AvatarFallback className={`${index === 0 ? 'bg-blue-600' : 'bg-blue-600/50'} text-white text-[10px]`}>
                              {pr.display_name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs">#{pr.rank}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Team ranking */}
              <div className="bg-amber-500/10 rounded-xl border border-amber-600/30 p-2 flex-1 overflow-hidden flex flex-col">
                <div className="flex items-center gap-1.5 mb-2">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-semibold text-amber-500">Classement</span>
                </div>
                <ScrollArea className="flex-1">
                  <div className="space-y-1">
                    {teams.map((team, index) => (
                      <div 
                        key={team.teamName}
                        className={`flex items-center justify-between p-1.5 rounded-lg text-sm ${
                          index === 0 ? 'bg-amber-500/30 border border-amber-500' :
                          index === 1 ? 'bg-secondary border border-border' :
                          index === 2 ? 'bg-amber-700/30 border border-amber-700' :
                          'bg-secondary/50'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-base">
                            {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                          </span>
                          <span className="font-medium truncate max-w-[100px]">{team.teamName}</span>
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
          <div className="flex-1 grid grid-cols-12 gap-4 overflow-hidden">
            {/* Left section: Battlefield + Queue */}
            <div className="col-span-7 flex flex-col gap-4">
              {/* Battlefield monsters */}
              <div className="flex-1 bg-card/50 rounded-xl border border-border p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Swords className="h-5 w-5 text-destructive" />
                  <h2 className="text-lg font-bold">Champ de Bataille</h2>
                </div>
                <div className="grid grid-cols-3 gap-6 h-[calc(100%-40px)]">
                  {[1, 2, 3].map(slot => {
                    const monster = battlefieldMonsters.find(m => m.battlefield_slot === slot);
                    return (
                      <div 
                        key={slot}
                        className="flex flex-col items-center justify-center p-4 rounded-xl bg-secondary/50 border border-border"
                      >
                        <div className="text-xs text-muted-foreground mb-2">Slot {slot}</div>
                        {monster ? (
                          <>
                            <div className="w-24 h-24 rounded-xl overflow-hidden mb-3 bg-secondary">
                              {monster.status === 'MORT' ? (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Skull className="h-16 w-16 text-muted-foreground" />
                                </div>
                              ) : getMonsterImage(monster.monster_id) ? (
                                <img 
                                  src={getMonsterImage(monster.monster_id)} 
                                  alt={getMonsterName(monster)}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-6xl">🐉</div>
                              )}
                            </div>
                            <div className="text-lg font-bold text-center mb-2">{getMonsterName(monster)}</div>
                            <div className="flex items-center gap-4 text-sm">
                              <span className="flex items-center gap-1 text-destructive">
                                <Heart className="h-4 w-4" />
                                {getMonsterPvMax(monster)} PV
                              </span>
                              <span className="flex items-center gap-1 text-amber-500">
                                <Trophy className="h-4 w-4" />
                                {getMonsterReward(monster)}
                              </span>
                            </div>
                          </>
                        ) : (
                          <span className="text-muted-foreground text-sm">Vide</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Queue monsters */}
              {queueMonsters.length > 0 && (
                <div className="bg-card/50 rounded-xl border border-amber-600/50 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-amber-500" />
                    <h3 className="text-sm font-semibold text-amber-500">File d'attente ({queueMonsters.length})</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {queueMonsters.map(m => (
                      <div key={m.id} className="flex items-center gap-2 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/30">
                        <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0">
                          {getMonsterImage(m.monster_id) ? (
                            <img src={getMonsterImage(m.monster_id)} alt={getMonsterName(m)} className="w-full h-full object-cover" />
                          ) : (
                            <span className="flex items-center justify-center w-full h-full">🐉</span>
                          )}
                        </div>
                        <span className="text-sm">{getMonsterName(m)}</span>
                        <span className="text-xs text-amber-500/70">{getMonsterPvMax(m)} PV • 💰{getMonsterReward(m)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Phase 1 & 2 validation */}
              {(isPhase1 || (isPhase2 && !hasPositions)) && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-500/10 rounded-xl border border-green-600/30 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <h3 className="font-semibold text-green-500">
                        Actions validées ({validatedPlayers.length})
                      </h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {validatedPlayers.map(p => (
                        <Badge key={p.id} className="bg-green-600/50 text-green-100">
                          {p.display_name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="bg-orange-500/10 rounded-xl border border-orange-600/30 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Clock className="h-5 w-5 text-orange-500" />
                      <h3 className="font-semibold text-orange-500">
                        Actions en attente ({pendingPlayers.length})
                      </h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {pendingPlayers.map(p => (
                        <Badge key={p.id} className="bg-orange-600/50 text-orange-100">
                          {p.display_name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Phase 2 after positions: Player attack order */}
              {(isPhase2 || isPhase4) && hasPositions && (
                <div className="bg-blue-500/10 rounded-xl border border-blue-600/30 p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Target className="h-5 w-5 text-blue-500" />
                    <h3 className="font-semibold text-blue-500">Ordre d'attaque validé</h3>
                  </div>
                  <div className="flex items-center justify-center gap-3 flex-wrap">
                    {positions.map((pos) => {
                      const player = players.find(p => p.player_number === pos.num_joueur);
                      return (
                        <div key={pos.num_joueur} className="flex flex-col items-center">
                          <div className="text-xs text-blue-400 mb-1">#{pos.position_finale}</div>
                          <Avatar className="h-14 w-14 border-2 border-blue-500">
                            <AvatarImage src={player?.avatar_url || undefined} alt={pos.nom} />
                            <AvatarFallback className="bg-blue-600 text-white text-lg">
                              {pos.nom.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="text-xs mt-1 text-center max-w-[80px] truncate">{pos.nom}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Phase 4: Combat info */}
              {isPhase4 && (
                <div className="bg-destructive/10 rounded-xl border border-destructive/30 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Swords className="h-5 w-5 text-destructive" />
                    <h3 className="font-semibold text-destructive">Phase de Combat en cours</h3>
                  </div>
                  <p className="text-muted-foreground text-sm">Les joueurs affrontent les monstres selon leur ordre d'attaque.</p>
                </div>
              )}
            </div>

            {/* Right section: Rankings */}
            <div className="col-span-5 flex flex-col gap-4 overflow-hidden">
              {/* Team/Player ranking */}
              <div className="bg-amber-500/10 rounded-xl border border-amber-600/30 p-4 flex-1 overflow-hidden flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                  <Trophy className="h-5 w-5 text-amber-500" />
                  <h3 className="font-semibold text-amber-500">Classement Général (Coup de grâce)</h3>
                </div>
                <ScrollArea className="flex-1">
                  <div className="space-y-2">
                    {teams.map((team, index) => (
                      <div 
                        key={team.teamName}
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          index === 0 ? 'bg-amber-500/30 border border-amber-500' :
                          index === 1 ? 'bg-secondary border border-border' :
                          index === 2 ? 'bg-amber-700/30 border border-amber-700' :
                          'bg-secondary/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">
                            {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                          </span>
                          <div>
                            <div className="font-medium">{team.teamName}</div>
                            {team.members.length > 1 && (
                              <div className="text-xs text-muted-foreground">
                                {team.members.map(m => `${m.display_name}: ${m.jetons + m.recompenses}`).join(' | ')}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-xl font-bold text-amber-500">{team.teamScore}</div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Priority ranking - shown in Phase 2 */}
              {isPhase2 && priorities.length > 0 && (
                <div className="bg-blue-500/10 rounded-xl border border-blue-600/30 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="h-5 w-5 text-blue-500" />
                    <h3 className="font-semibold text-blue-500">Ordre de priorité (mises)</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {priorities.map((pr, index) => {
                      const player = players.find(p => p.player_number === pr.num_joueur);
                      return (
                        <div key={pr.player_id} className="flex items-center gap-2">
                          <Avatar className={`h-8 w-8 border-2 ${index === 0 ? 'border-blue-500' : 'border-blue-500/50'}`}>
                            <AvatarImage src={player?.avatar_url || undefined} alt={pr.display_name} />
                            <AvatarFallback className={`${index === 0 ? 'bg-blue-600' : 'bg-blue-600/50'} text-white text-xs`}>
                              {pr.display_name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">#{pr.rank} {pr.display_name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
