import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Heart, Trophy, Users, Target, Store, CheckCircle, Clock, Skull, Swords } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

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

export function PresentationModeView({ game, onClose }: PresentationModeViewProps) {
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

  const fetchData = useCallback(async () => {
    const manche = game.manche_active;
    const sessionGameId = game.current_session_game_id;

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
    }

    // Fetch players
    const { data: playersData } = await supabase
      .from('game_players')
      .select('id, display_name, player_number, jetons, recompenses, mate_num, is_host')
      .eq('game_id', game.id)
      .is('removed_at', null)
      .eq('is_host', false)
      .order('player_number');

    if (playersData) {
      setPlayers(playersData.map(p => ({
        ...p,
        jetons: p.jetons ?? 0,
        recompenses: p.recompenses ?? 0,
      })));
    }

    // Fetch bets for current manche
    let betsQuery = supabase.from('round_bets').select('num_joueur, manche, mise, status').eq('game_id', game.id).eq('manche', manche);
    if (sessionGameId) betsQuery = betsQuery.eq('session_game_id', sessionGameId);
    const { data: betsData } = await betsQuery;
    setBets(betsData || []);

    // Fetch actions for current manche
    let actionsQuery = supabase.from('actions').select('num_joueur, manche').eq('game_id', game.id).eq('manche', manche);
    if (sessionGameId) actionsQuery = actionsQuery.eq('session_game_id', sessionGameId);
    const { data: actionsData } = await actionsQuery;
    setActions(actionsData || []);

    // Fetch positions for current manche
    let positionsQuery = supabase.from('positions_finales').select('num_joueur, nom, position_finale').eq('game_id', game.id).eq('manche', manche);
    if (sessionGameId) positionsQuery = positionsQuery.eq('session_game_id', sessionGameId);
    const { data: positionsData } = await positionsQuery;
    setPositions((positionsData || []).sort((a, b) => a.position_finale - b.position_finale));

    // Fetch priority rankings for current manche
    let prioritiesQuery = supabase.from('priority_rankings').select('player_id, num_joueur, display_name, rank').eq('game_id', game.id).eq('manche', manche);
    if (sessionGameId) prioritiesQuery = prioritiesQuery.eq('session_game_id', sessionGameId);
    const { data: prioritiesData } = await prioritiesQuery;
    setPriorities((prioritiesData || []).sort((a, b) => a.rank - b.rank));

    // Fetch shop offer for current manche
    const { data: shopOfferData } = await supabase
      .from('game_shop_offers')
      .select('id, item_ids')
      .eq('game_id', game.id)
      .eq('manche', manche)
      .maybeSingle();
    
    setShopOffer(shopOfferData);

    if (shopOfferData?.item_ids && shopOfferData.item_ids.length > 0) {
      const { data: itemsData } = await supabase
        .from('item_catalog')
        .select('id, name, category, detailed_description, base_damage, base_heal')
        .in('id', shopOfferData.item_ids);
      setShopItems(itemsData || []);
    }

    // Fetch shop requests for current manche
    const { data: shopRequestsData } = await supabase
      .from('shop_requests')
      .select('player_id, player_num')
      .eq('game_id', game.id)
      .eq('manche', manche);
    setShopRequests(shopRequestsData || []);

    setLoading(false);
  }, [game.id, game.manche_active, game.current_session_game_id]);

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
      const teamScore = teammates.length === 1 ? rawScore * 2 : rawScore;
      const teamName = teammates.length === 1 ? teammates[0].display_name : teammates.map(t => t.display_name).join(' & ');

      teams.push({ members: teammates, teamScore, teamName });
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
      {/* Close hint */}
      <div className="absolute top-4 right-4 text-xs text-muted-foreground z-10">
        Appuyez sur ESC ou cliquez à l'extérieur pour fermer
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

        {/* Main content grid */}
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
                          <div className="text-6xl mb-3">
                            {monster.status === 'MORT' ? <Skull className="h-16 w-16 text-muted-foreground" /> : '🐉'}
                          </div>
                          <div className="text-lg font-bold text-center mb-2">{getMonsterName(monster)}</div>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="flex items-center gap-1 text-destructive">
                              <Heart className="h-4 w-4" />
                              {monster.pv_current}/{getMonsterPvMax(monster)}
                            </span>
                            <span className="flex items-center gap-1 text-amber-500">
                              <Trophy className="h-4 w-4" />
                              {getMonsterReward(monster)}
                            </span>
                          </div>
                          <Progress 
                            value={(monster.pv_current / getMonsterPvMax(monster)) * 100} 
                            className="w-full h-2 mt-3" 
                          />
                        </>
                      ) : (
                        <span className="text-muted-foreground text-sm">Vide</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Queue monsters - smaller */}
            {queueMonsters.length > 0 && (
              <div className="bg-card/50 rounded-xl border border-amber-600/50 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-amber-500" />
                  <h3 className="text-sm font-semibold text-amber-500">File d'attente ({queueMonsters.length})</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {queueMonsters.map(m => (
                    <div key={m.id} className="flex items-center gap-2 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/30">
                      <span>🐉</span>
                      <span className="text-sm">{getMonsterName(m)}</span>
                      <span className="text-xs text-amber-500/70">PV: {getMonsterPvMax(m)} • 💰{getMonsterReward(m)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Phase-specific bottom content */}
            {(isPhase1 || (isPhase2 && !hasPositions) || isPhase3) && (
              <div className="grid grid-cols-2 gap-4">
                {/* Validated actions */}
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

                {/* Pending actions */}
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
            {isPhase2 && hasPositions && (
              <div className="bg-blue-500/10 rounded-xl border border-blue-600/30 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Target className="h-5 w-5 text-blue-500" />
                  <h3 className="font-semibold text-blue-500">Ordre d'attaque validé</h3>
                </div>
                <div className="flex items-center justify-center gap-3 flex-wrap">
                  {positions.map((pos) => {
                    return (
                      <div key={pos.num_joueur} className="flex flex-col items-center">
                        <div className="text-xs text-blue-400 mb-1">#{pos.position_finale}</div>
                        <Avatar className="h-14 w-14 border-2 border-blue-500">
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

            {/* Phase 3: Shop items */}
            {isPhase3 && shopOffer && shopItems.length > 0 && (
              <div className="bg-purple-500/10 rounded-xl border border-purple-600/30 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Store className="h-5 w-5 text-purple-500" />
                  <h3 className="font-semibold text-purple-500">Boutique - Objets disponibles</h3>
                </div>
                <div className="grid grid-cols-5 gap-3">
                  {shopItems.slice(0, 5).map(item => (
                    <div key={item.id} className="bg-purple-500/20 rounded-lg p-3 border border-purple-600/40">
                      <div className="font-medium text-sm mb-1">{item.name}</div>
                      <div className="text-xs text-muted-foreground mb-2 line-clamp-2">{item.detailed_description || item.category}</div>
                      <div className="flex items-center gap-2 text-xs">
                        {item.base_damage && item.base_damage > 0 && (
                          <span className="text-destructive">⚔️ {item.base_damage}</span>
                        )}
                        {item.base_heal && item.base_heal > 0 && (
                          <span className="text-green-500">💚 {item.base_heal}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  Soumissions : {submittedShopPlayerNums.size} / {players.length}
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
            {/* Team/Player ranking - Coup de grâce */}
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

            {/* Priority ranking - only in Phase 2 before positions */}
            {isPhase2 && !hasPositions && priorities.length > 0 && (
              <div className="bg-blue-500/10 rounded-xl border border-blue-600/30 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="h-5 w-5 text-blue-500" />
                  <h3 className="font-semibold text-blue-500">Ordre de priorité (mises)</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {priorities.map((pr, index) => (
                    <Badge 
                      key={pr.player_id} 
                      className={`${index === 0 ? 'bg-blue-600' : 'bg-blue-600/50'} text-white text-sm py-1`}
                    >
                      #{pr.rank} {pr.display_name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
