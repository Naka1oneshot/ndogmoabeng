import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { 
  Shield, Coins, Star, Swords, Check, Loader2, 
  AlertTriangle, Eye, EyeOff, Clock, Trophy
} from 'lucide-react';
import { 
  getSheriffThemeClasses, 
  getVisaOptions, 
  getTokenOptions,
  getDuelRulesText,
  SHERIFF_COLORS,
  SheriffBotConfig,
  DEFAULT_SHERIFF_CONFIG
} from './SheriffTheme';
import { toast } from 'sonner';
import { 
  SheriffPhaseChangeAnimation, 
  SheriffDuelStartPlayerAnimation, 
  SheriffDuelResultPlayerAnimation 
} from './SheriffPlayerAnimations';

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
  mate_num: number | null;
  jetons: number | null;
  pvic: number | null;
}

interface PlayerChoice {
  id: string;
  visa_choice: string | null;
  tokens_entering: number | null;
  tokens_entering_final: number | null;
  tokens_entering_final_confirmed: boolean;
  has_illegal_tokens: boolean;
  victory_points_delta: number;
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
  is_final?: boolean;
}

interface RoundState {
  id: string;
  phase: string;
  current_duel_order: number | null;
  total_duels: number;
  bot_config?: SheriffBotConfig | null;
  unpaired_player_num?: number | null;
  final_duel_challenger_num?: number | null;
  final_duel_status?: string | null;
  final_duel_id?: string | null;
}

interface PlayerSheriffDashboardProps {
  game: Game;
  player: Player;
  onLeave?: () => void;
}

export function PlayerSheriffDashboard({ game, player, onLeave }: PlayerSheriffDashboardProps) {
  const theme = getSheriffThemeClasses();
  
  const [roundState, setRoundState] = useState<RoundState | null>(null);
  const [myChoice, setMyChoice] = useState<PlayerChoice | null>(null);
  const [duels, setDuels] = useState<Duel[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  
  // Form state
  const [visaChoice, setVisaChoice] = useState<string>('');
  const [tokenMode, setTokenMode] = useState<'LEGAL' | 'ILLEGAL'>('LEGAL');
  const [tokensEntering, setTokensEntering] = useState<number>(20);
  const [submittingChoice, setSubmittingChoice] = useState(false);
  
  // Duel decision state
  const [duelDecision, setDuelDecision] = useState<boolean | null>(null);
  const [submittingDuel, setSubmittingDuel] = useState(false);
  
  // Final duel re-choice state
  const [finalTokens, setFinalTokens] = useState<number>(25);
  const [submittingFinalTokens, setSubmittingFinalTokens] = useState(false);
  
  // Animation states
  const [showPhaseAnimation, setShowPhaseAnimation] = useState(false);
  const [animationPhase, setAnimationPhase] = useState<'CHOICES' | 'DUELS' | 'COMPLETE'>('CHOICES');
  const [showDuelStartAnimation, setShowDuelStartAnimation] = useState(false);
  const [showDuelResultAnimation, setShowDuelResultAnimation] = useState(false);
  const [duelAnimationData, setDuelAnimationData] = useState<{
    opponentName: string;
    duelOrder: number;
    vpDelta: number;
    opponentSearched: boolean;
  } | null>(null);
  
  // Previous state refs for animation detection
  const prevPhaseRef = useRef<string | null>(null);
  const prevMyActiveDuelRef = useRef<string | null>(null);
  const prevMyDuelStatusRef = useRef<string | null>(null);
  const initialLoadDoneRef = useRef(false);

  // Extract config values with defaults - safely parse bot_config
  const botConfig: SheriffBotConfig = (roundState?.bot_config as SheriffBotConfig) || {};
  const visaPvicPercent = (typeof botConfig.visa_pvic_percent === 'number' ? botConfig.visa_pvic_percent : DEFAULT_SHERIFF_CONFIG.visa_pvic_percent);
  const poolCostPerPlayer = (typeof botConfig.cost_per_player === 'number' ? botConfig.cost_per_player : DEFAULT_SHERIFF_CONFIG.cost_per_player);
  
  // Dynamic options based on config
  const visaOptions = getVisaOptions({ visa_pvic_percent: visaPvicPercent, cost_per_player: poolCostPerPlayer });
  const tokenOptions = getTokenOptions(tokensEntering);
  const duelRules = getDuelRulesText(botConfig);

  useEffect(() => {
    fetchData();
    
    const channel = supabase
      .channel(`sheriff-player-${game.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${game.id}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sheriff_player_choices', filter: `game_id=eq.${game.id}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sheriff_duels', filter: `game_id=eq.${game.id}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sheriff_round_state', filter: `game_id=eq.${game.id}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${game.id}` }, fetchData)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [game.id]);

  const fetchData = async () => {
    if (!game.current_session_game_id) return;

    // Fetch all players
    const { data: playersData } = await supabase
      .from('game_players')
      .select('id, display_name, player_number, clan, mate_num, jetons, pvic')
      .eq('game_id', game.id)
      .is('removed_at', null)
      .order('player_number');

    if (playersData) setAllPlayers(playersData);

    // Fetch round state with bot_config
    const { data: stateData } = await supabase
      .from('sheriff_round_state')
      .select('*')
      .eq('session_game_id', game.current_session_game_id)
      .maybeSingle();

    if (stateData) setRoundState(stateData as RoundState);

    // Fetch my choice
    const { data: choiceData } = await supabase
      .from('sheriff_player_choices')
      .select('*')
      .eq('session_game_id', game.current_session_game_id)
      .eq('player_number', player.player_number)
      .maybeSingle();

    if (choiceData) {
      setMyChoice(choiceData);
      if (choiceData.visa_choice) setVisaChoice(choiceData.visa_choice);
      if (choiceData.tokens_entering) {
        const tokens = choiceData.tokens_entering;
        setTokensEntering(tokens);
        setTokenMode(tokens <= 20 ? 'LEGAL' : 'ILLEGAL');
      }
    }

    // Fetch duels
    const { data: duelsData } = await supabase
      .from('sheriff_duels')
      .select('*')
      .eq('session_game_id', game.current_session_game_id)
      .order('duel_order');

    if (duelsData) setDuels(duelsData);
  };

  // Handle token mode change
  const handleTokenModeChange = (mode: string) => {
    const newMode = mode as 'LEGAL' | 'ILLEGAL';
    setTokenMode(newMode);
    if (newMode === 'LEGAL') {
      setTokensEntering(20);
    } else {
      // Default to 25 when switching to illegal (middle of range)
      setTokensEntering(25);
    }
  };

  const handleSubmitChoice = async () => {
    if (!visaChoice || !tokenMode) {
      toast.error('Veuillez faire tous vos choix');
      return;
    }

    setSubmittingChoice(true);
    try {
      const { data, error } = await supabase.functions.invoke('sheriff-submit-choice', {
        body: {
          gameId: game.id,
          sessionGameId: game.current_session_game_id,
          playerNumber: player.player_number,
          visaChoice,
          tokensEntering: tokensEntering,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erreur');

      toast.success('Choix enregistré !');
      fetchData();
    } catch (err: any) {
      console.error('Submit choice error:', err);
      toast.error(err.message || 'Erreur lors de la soumission');
    } finally {
      setSubmittingChoice(false);
    }
  };

  const handleSubmitDuelDecision = async (duelId: string, searches: boolean) => {
    setSubmittingDuel(true);
    try {
      const { data, error } = await supabase.functions.invoke('sheriff-submit-duel-decision', {
        body: {
          gameId: game.id,
          sessionGameId: game.current_session_game_id,
          duelId,
          playerNumber: player.player_number,
          searches,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erreur');

      toast.success(searches ? 'Vous avez décidé de fouiller !' : 'Vous laissez passer');
      setDuelDecision(searches);
      fetchData();
    } catch (err: any) {
      console.error('Submit duel decision error:', err);
      toast.error(err.message || 'Erreur lors de la soumission');
    } finally {
      setSubmittingDuel(false);
    }
  };

  // Submit final tokens for re-choice (final duel)
  const handleSubmitFinalTokens = async () => {
    if (finalTokens < 21 || finalTokens > 30) {
      toast.error('Les jetons doivent être entre 21 et 30');
      return;
    }

    setSubmittingFinalTokens(true);
    try {
      const { data, error } = await supabase.functions.invoke('sheriff-submit-final-tokens', {
        body: {
          gameId: game.id,
          sessionGameId: game.current_session_game_id,
          playerNumber: player.player_number,
          tokensEnteringFinal: finalTokens,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erreur');

      toast.success(`Vous entrerez avec ${finalTokens} jetons (${finalTokens - 20} illégaux) !`);
      fetchData();
    } catch (err: any) {
      console.error('Submit final tokens error:', err);
      toast.error(err.message || 'Erreur lors de la soumission');
    } finally {
      setSubmittingFinalTokens(false);
    }
  };

  const getPlayerName = useCallback((num: number) => {
    const p = allPlayers.find(pl => pl.player_number === num);
    return p?.display_name || `Joueur ${num}`;
  }, [allPlayers]);

  const myActiveDuel = duels.find(d => 
    d.status === 'ACTIVE' && 
    (d.player1_number === player.player_number || d.player2_number === player.player_number)
  );

  const myResolvedDuels = duels.filter(d => 
    d.status === 'RESOLVED' && 
    (d.player1_number === player.player_number || d.player2_number === player.player_number)
  );

  const amPlayer1 = myActiveDuel?.player1_number === player.player_number;
  const myDecisionMade = myActiveDuel && (
    (amPlayer1 && myActiveDuel.player1_searches !== null) ||
    (!amPlayer1 && myActiveDuel.player2_searches !== null)
  );

  // Animation detection effects
  useEffect(() => {
    if (!roundState) return;
    
    // Skip animations on initial load
    if (!initialLoadDoneRef.current) {
      initialLoadDoneRef.current = true;
      prevPhaseRef.current = roundState.phase;
      return;
    }
    
    // Phase change detection
    if (prevPhaseRef.current !== roundState.phase) {
      const newPhase = roundState.phase as 'CHOICES' | 'DUELS' | 'COMPLETE';
      setAnimationPhase(newPhase);
      setShowPhaseAnimation(true);
      prevPhaseRef.current = roundState.phase;
    }
  }, [roundState?.phase]);
  
  // Duel animations
  useEffect(() => {
    if (!roundState || roundState.phase !== 'DUELS') return;
    
    // My new active duel detection
    if (myActiveDuel) {
      const duelId = myActiveDuel.id;
      const prevDuelId = prevMyActiveDuelRef.current;
      
      // New duel started for me
      if (prevDuelId !== duelId) {
        const opponentNum = amPlayer1 ? myActiveDuel.player2_number : myActiveDuel.player1_number;
        setDuelAnimationData({
          opponentName: getPlayerName(opponentNum),
          duelOrder: myActiveDuel.duel_order,
          vpDelta: 0,
          opponentSearched: false,
        });
        setShowDuelStartAnimation(true);
        prevMyActiveDuelRef.current = duelId;
        prevMyDuelStatusRef.current = 'ACTIVE';
      }
    }
    
    // My duel just resolved
    const justResolvedMyDuel = duels.find(d => 
      d.status === 'RESOLVED' && 
      d.id === prevMyActiveDuelRef.current &&
      prevMyDuelStatusRef.current === 'ACTIVE' &&
      (d.player1_number === player.player_number || d.player2_number === player.player_number)
    );
    
    if (justResolvedMyDuel) {
      const isP1 = justResolvedMyDuel.player1_number === player.player_number;
      const opponentNum = isP1 ? justResolvedMyDuel.player2_number : justResolvedMyDuel.player1_number;
      const myVpDelta = isP1 ? justResolvedMyDuel.player1_vp_delta : justResolvedMyDuel.player2_vp_delta;
      const opponentSearched = isP1 ? justResolvedMyDuel.player2_searches : justResolvedMyDuel.player1_searches;
      
      setDuelAnimationData({
        opponentName: getPlayerName(opponentNum),
        duelOrder: justResolvedMyDuel.duel_order,
        vpDelta: myVpDelta,
        opponentSearched: opponentSearched ?? false,
      });
      setShowDuelResultAnimation(true);
      prevMyDuelStatusRef.current = 'RESOLVED';
    }
  }, [duels, roundState?.phase, myActiveDuel, amPlayer1, player.player_number, getPlayerName]);

  // Lobby
  if (game.status === 'LOBBY') {
    return (
      <div className={theme.container}>
        <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
          <Shield className="h-16 w-16 text-[#D4AF37] mb-6 animate-pulse" />
          <h1 className="text-2xl font-bold text-[#D4AF37] mb-2">Le Shérif de Ndogmoabeng</h1>
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
  if (game.status === 'ENDED' || roundState?.phase === 'COMPLETE') {
    return (
      <div className={theme.container}>
        <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
          <Trophy className="h-16 w-16 text-[#D4AF37] mb-6" />
          <h1 className="text-2xl font-bold text-[#D4AF37] mb-4">Contrôle Terminé</h1>
          
          <div className={theme.card + ' p-6 max-w-md w-full'}>
            <h2 className="text-lg font-bold mb-4">Votre Bilan</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Jetons finaux:</span>
                <span className="font-bold text-[#D4AF37]">{player.jetons}💎</span>
              </div>
              {myChoice && (
                <>
                  <div className="flex justify-between">
                    <span className="text-[#9CA3AF]">Visa payé:</span>
                    <span>{myChoice.visa_choice === 'VICTORY_POINTS' ? '⭐ Points de Victoire' : '💰 Cagnotte'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#9CA3AF]">Variation PV:</span>
                    <span className={myChoice.victory_points_delta >= 0 ? 'text-green-500' : 'text-red-500'}>
                      {myChoice.victory_points_delta > 0 ? '+' : ''}{myChoice.victory_points_delta.toFixed(1)}%
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {myResolvedDuels.length > 0 && (
            <div className={theme.card + ' p-4 mt-4 max-w-md w-full'}>
              <h3 className="text-sm font-medium text-[#D4AF37] mb-3">Vos Duels</h3>
              {myResolvedDuels.map(duel => {
                const isP1 = duel.player1_number === player.player_number;
                const opponent = isP1 ? duel.player2_number : duel.player1_number;
                const myDelta = isP1 ? duel.player1_vp_delta : duel.player2_vp_delta;
                
                return (
                  <div key={duel.id} className="flex justify-between p-2 bg-[#1A1510] rounded mb-2">
                    <span>vs {getPlayerName(opponent)}</span>
                    <Badge className={myDelta >= 0 ? theme.badgeLegal : theme.badgeIllegal}>
                      {myDelta > 0 ? '+' : ''}{myDelta.toFixed(1)}%
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`${theme.container} flex flex-col min-h-screen`}>
      {/* Animations */}
      {showPhaseAnimation && (
        <SheriffPhaseChangeAnimation
          phase={animationPhase}
          onComplete={() => setShowPhaseAnimation(false)}
        />
      )}
      
      {showDuelStartAnimation && duelAnimationData && (
        <SheriffDuelStartPlayerAnimation
          opponentName={duelAnimationData.opponentName}
          duelOrder={duelAnimationData.duelOrder}
          onComplete={() => setShowDuelStartAnimation(false)}
        />
      )}
      
      {showDuelResultAnimation && duelAnimationData && (
        <SheriffDuelResultPlayerAnimation
          won={duelAnimationData.vpDelta >= 0}
          vpDelta={duelAnimationData.vpDelta}
          opponentName={duelAnimationData.opponentName}
          opponentSearched={duelAnimationData.opponentSearched}
          onComplete={() => setShowDuelResultAnimation(false)}
        />
      )}
      
      {/* Header */}
      <div className={`${theme.header} p-4`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-[#D4AF37]">Contrôle d'Entrée</h1>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-[#9CA3AF]">{player.display_name}</span>
              <Badge variant="outline">#{player.player_number}</Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-[#2A2215] border-[#D4AF37]/30 text-[#D4AF37]">💎 {player.jetons || 0}</Badge>
            <Badge className="bg-[#2A2215] border-[#CD853F]/30 text-[#CD853F]">⭐ {player.pvic || 0}</Badge>
          </div>
        </div>
        
        {roundState && (
          <Badge className={`mt-2 ${roundState.phase === 'CHOICES' ? 'bg-[#F59E0B]/20 text-[#F59E0B]' : 'bg-[#D4AF37]/20 text-[#D4AF37]'}`}>
            {roundState.phase === 'CHOICES' ? '📝 Phase de Choix' : `⚔️ Duels (${roundState.current_duel_order || 0}/${roundState.total_duels})`}
          </Badge>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 p-4 space-y-4 overflow-auto">
        
        {/* Phase CHOICES */}
        {roundState?.phase === 'CHOICES' && !myChoice?.visa_choice && (
          <div className="space-y-4">
            {/* Visa Choice */}
            <Card className={theme.card}>
              <CardHeader>
                <CardTitle className="text-[#D4AF37] flex items-center gap-2">
                  <Coins className="h-5 w-5" />
                  Paiement du Visa
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup value={visaChoice} onValueChange={setVisaChoice} className="space-y-3">
                  {Object.entries(visaOptions).map(([key, opt]) => (
                    <div key={key} className={`flex items-center space-x-3 p-3 rounded-lg border ${visaChoice === key ? 'border-[#D4AF37] bg-[#D4AF37]/10' : 'border-[#D4AF37]/20'} ${theme.cardHover}`}>
                      <RadioGroupItem value={key} id={key} className="border-[#D4AF37]" />
                      <Label htmlFor={key} className="flex-1 cursor-pointer">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{opt.icon}</span>
                          <span className="font-medium">{opt.label}</span>
                          <Badge variant="outline" className="ml-auto">{opt.cost}</Badge>
                        </div>
                        <p className="text-sm text-[#9CA3AF] mt-1">{opt.description}</p>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </CardContent>
            </Card>

            {/* Token Choice */}
            <Card className={theme.card}>
              <CardHeader>
                <CardTitle className="text-[#D4AF37] flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  Jetons à l'Entrée
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <RadioGroup value={tokenMode} onValueChange={handleTokenModeChange} className="space-y-3">
                  {/* Legal option */}
                  <div className={`flex items-center space-x-3 p-3 rounded-lg border ${tokenMode === 'LEGAL' ? 'border-green-500 bg-green-500/10' : 'border-[#D4AF37]/20'} ${theme.cardHover}`}>
                    <RadioGroupItem value="LEGAL" id="legal" className="border-green-500" />
                    <Label htmlFor="legal" className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Check className="h-5 w-5 text-green-500" />
                        <span className="font-medium">20 Jetons (Légal)</span>
                      </div>
                      <p className="text-sm text-[#9CA3AF] mt-1">Entrer légalement avec le maximum autorisé</p>
                      <p className="text-xs text-green-500 mt-1">Aucun risque</p>
                    </Label>
                  </div>
                  
                  {/* Illegal option */}
                  <div className={`space-y-3 p-3 rounded-lg border ${tokenMode === 'ILLEGAL' ? 'border-red-500 bg-red-500/10' : 'border-[#D4AF37]/20'} ${theme.cardHover}`}>
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem value="ILLEGAL" id="illegal" className="border-red-500" />
                      <Label htmlFor="illegal" className="flex-1 cursor-pointer">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-red-500" />
                          <span className="font-medium">Contrebande (21-30 jetons)</span>
                        </div>
                        <p className="text-sm text-[#9CA3AF] mt-1">Tenter d'entrer avec des jetons illégaux cachés</p>
                        <p className="text-xs text-red-500 mt-1">Risque de fouille</p>
                      </Label>
                    </div>
                    
                    {/* Slider for illegal token count */}
                    {tokenMode === 'ILLEGAL' && (
                      <div className="pt-2 space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-[#9CA3AF]">Nombre de jetons:</span>
                          <span className="font-bold text-red-400">
                            {tokensEntering} jetons ({tokensEntering - 20} illégaux)
                          </span>
                        </div>
                        <Slider
                          value={[tokensEntering]}
                          onValueChange={(values) => setTokensEntering(values[0])}
                          min={21}
                          max={30}
                          step={1}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-[#9CA3AF]">
                          <span>21 (1 illégal)</span>
                          <span>30 (10 illégaux)</span>
                        </div>
                      </div>
                    )}
                  </div>
                </RadioGroup>
                
                {/* Current selection summary */}
                <div className="p-3 bg-[#1A1510] rounded-lg text-center">
                  <span className="text-[#9CA3AF] text-sm">Vous entrerez avec: </span>
                  <span className={`font-bold ${tokenMode === 'LEGAL' ? 'text-green-400' : 'text-red-400'}`}>
                    {tokensEntering} jetons
                    {tokenMode === 'ILLEGAL' && ` (${tokensEntering - 20} illégaux)`}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Submit Button */}
            <Button 
              onClick={handleSubmitChoice} 
              disabled={!visaChoice || submittingChoice}
              className={`w-full ${theme.button}`}
            >
              {submittingChoice ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Confirmer mes choix
            </Button>
          </div>
        )}

        {/* Waiting for duels */}
        {roundState?.phase === 'CHOICES' && myChoice?.visa_choice && (
          <div className={theme.card + ' p-6 text-center'}>
            <Check className="h-12 w-12 mx-auto text-green-500 mb-4" />
            <h2 className="text-lg font-bold mb-2">Choix Enregistrés</h2>
            <div className="space-y-2 text-sm text-[#9CA3AF]">
              <p>Visa: {myChoice.visa_choice === 'VICTORY_POINTS' ? `⭐ Points de Victoire (-${visaPvicPercent}%)` : `💰 Cagnotte (-${poolCostPerPlayer}€)`}</p>
              <p>Jetons: {myChoice.tokens_entering}💎 {myChoice.has_illegal_tokens && `(${(myChoice.tokens_entering || 0) - 20} illégaux)`}</p>
            </div>
            <p className="mt-4 text-[#F59E0B]">En attente des autres joueurs...</p>
          </div>
        )}

        {/* Final Duel Re-Choice (I am the challenger) */}
        {roundState?.final_duel_status === 'PENDING_RECHOICE' && 
         roundState?.final_duel_challenger_num === player.player_number && 
         !myChoice?.tokens_entering_final_confirmed && (
          <Card className={`${theme.card} border-2 border-[#CD853F]`}>
            <CardHeader>
              <CardTitle className="text-[#CD853F] flex items-center gap-2">
                <Swords className="h-5 w-5" />
                🎯 Dernier Duel — Re-choix des Jetons
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-[#1A1510] rounded text-sm text-[#9CA3AF]">
                <p className="mb-2">
                  Vous avez été sélectionné pour affronter <strong className="text-[#D4AF37]">{getPlayerName(roundState.unpaired_player_num!)}</strong> dans le dernier duel.
                </p>
                <p className="text-[#F59E0B]">
                  ⚠️ Vous devez entrer avec des jetons illégaux (21-30).
                </p>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#9CA3AF]">Nombre de jetons:</span>
                  <span className="font-bold text-red-400">
                    {finalTokens} jetons ({finalTokens - 20} illégaux)
                  </span>
                </div>
                <Slider
                  value={[finalTokens]}
                  onValueChange={(values) => setFinalTokens(values[0])}
                  min={21}
                  max={30}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-[#9CA3AF]">
                  <span>21 (1 illégal)</span>
                  <span>30 (10 illégaux)</span>
                </div>
              </div>

              <Button 
                onClick={handleSubmitFinalTokens}
                disabled={submittingFinalTokens}
                className="w-full bg-[#CD853F] hover:bg-[#CD853F]/80 text-white"
              >
                {submittingFinalTokens ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Confirmer ({finalTokens} jetons)
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Waiting for final duel to be activated (I am unpaired) */}
        {roundState?.final_duel_status === 'PENDING_RECHOICE' && 
         roundState?.unpaired_player_num === player.player_number && (
          <div className={theme.card + ' p-6 text-center'}>
            <Clock className="h-12 w-12 mx-auto text-[#F59E0B] mb-4" />
            <h2 className="text-lg font-bold mb-2">Dernier Duel à Venir</h2>
            <p className="text-[#9CA3AF]">
              Votre adversaire <strong className="text-[#D4AF37]">{getPlayerName(roundState.final_duel_challenger_num!)}</strong> choisit ses jetons...
            </p>
          </div>
        )}

        {/* Final duel confirmed - waiting for MJ to activate */}
        {roundState?.final_duel_status === 'READY' && 
         (roundState?.unpaired_player_num === player.player_number || 
          roundState?.final_duel_challenger_num === player.player_number) && 
         !myActiveDuel && (
          <div className={theme.card + ' p-6 text-center'}>
            <Swords className="h-12 w-12 mx-auto text-[#D4AF37] mb-4" />
            <h2 className="text-lg font-bold mb-2 text-[#D4AF37]">Dernier Duel Prêt</h2>
            <p className="text-[#9CA3AF]">
              En attente de l'activation par le MJ...
            </p>
          </div>
        )}
        {roundState?.phase === 'DUELS' && myActiveDuel && !myDecisionMade && (
          <Card className={`${theme.card} border-2 border-[#D4AF37]`}>
            <CardHeader>
              <CardTitle className="text-[#D4AF37] flex items-center gap-2">
                <Swords className="h-5 w-5" />
                C'est votre Duel !
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <p className="text-lg mb-2">Votre adversaire:</p>
                <p className="text-2xl font-bold text-[#D4AF37]">
                  {getPlayerName(amPlayer1 ? myActiveDuel.player2_number : myActiveDuel.player1_number)}
                </p>
              </div>

              <div className="border-t border-[#D4AF37]/20 pt-4">
                <p className="text-center text-[#9CA3AF] mb-4">
                  Voulez-vous fouiller le porte-monnaie de votre adversaire ?
                </p>
                
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    onClick={() => handleSubmitDuelDecision(myActiveDuel.id, true)}
                    disabled={submittingDuel}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    {submittingDuel ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}
                    Fouiller
                  </Button>
                  <Button
                    onClick={() => handleSubmitDuelDecision(myActiveDuel.id, false)}
                    disabled={submittingDuel}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    {submittingDuel ? <Loader2 className="h-4 w-4 animate-spin" /> : <EyeOff className="h-4 w-4 mr-2" />}
                    Laisser Passer
                  </Button>
                </div>

                <div className="mt-4 p-3 bg-[#1A1510] rounded text-xs text-[#9CA3AF]">
                  <p><strong>{duelRules.searchInfo}</strong></p>
                  <p>{duelRules.passInfo}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active Duel - Waiting for opponent */}
        {roundState?.phase === 'DUELS' && myActiveDuel && myDecisionMade && (
          <div className={theme.card + ' p-6 text-center'}>
            <Check className="h-12 w-12 mx-auto text-green-500 mb-4" />
            <h2 className="text-lg font-bold mb-2">Décision Prise</h2>
            <p className="text-[#9CA3AF]">En attente de votre adversaire...</p>
          </div>
        )}

        {/* Not my turn - Watching */}
        {roundState?.phase === 'DUELS' && !myActiveDuel && (
          <div className={theme.card + ' p-6 text-center'}>
            <Clock className="h-12 w-12 mx-auto text-[#F59E0B] mb-4" />
            <h2 className="text-lg font-bold mb-2">En Attente</h2>
            <p className="text-[#9CA3AF]">Ce n'est pas encore votre tour.</p>
            
            {duels.find(d => d.status === 'ACTIVE') && (
              <div className="mt-4 p-3 bg-[#1A1510] rounded">
                <p className="text-sm">Duel en cours:</p>
                <p className="font-bold text-[#D4AF37]">
                  {getPlayerName(duels.find(d => d.status === 'ACTIVE')!.player1_number)} vs {getPlayerName(duels.find(d => d.status === 'ACTIVE')!.player2_number)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* My resolved duels */}
        {myResolvedDuels.length > 0 && (
          <Card className={theme.card}>
            <CardHeader>
              <CardTitle className="text-[#D4AF37] text-sm">Vos Duels Terminés</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {myResolvedDuels.map(duel => {
                const isP1 = duel.player1_number === player.player_number;
                const opponent = isP1 ? duel.player2_number : duel.player1_number;
                const myDelta = isP1 ? duel.player1_vp_delta : duel.player2_vp_delta;
                const iSearched = isP1 ? duel.player1_searches : duel.player2_searches;
                
                return (
                  <div key={duel.id} className="flex items-center justify-between p-3 bg-[#1A1510] rounded">
                    <div>
                      <span className="text-sm">vs {getPlayerName(opponent)}</span>
                      <p className="text-xs text-[#9CA3AF]">
                        {iSearched ? 'Vous avez fouillé' : 'Vous avez laissé passer'}
                      </p>
                    </div>
                    <Badge className={myDelta >= 0 ? theme.badgeLegal : theme.badgeIllegal}>
                      {myDelta > 0 ? '+' : ''}{myDelta.toFixed(1)}% PV
                    </Badge>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
