import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { 
  Shield, Coins, Star, Swords, Check, Loader2, 
  AlertTriangle, Eye, EyeOff, Clock, Trophy
} from 'lucide-react';
import { getSheriffThemeClasses, VISA_OPTIONS, TOKEN_OPTIONS, SHERIFF_COLORS } from './SheriffTheme';
import { toast } from 'sonner';

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
}

interface RoundState {
  id: string;
  phase: string;
  current_duel_order: number | null;
  total_duels: number;
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
  const [tokenChoice, setTokenChoice] = useState<string>('');
  const [submittingChoice, setSubmittingChoice] = useState(false);
  
  // Duel decision state
  const [duelDecision, setDuelDecision] = useState<boolean | null>(null);
  const [submittingDuel, setSubmittingDuel] = useState(false);

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

    // Fetch round state
    const { data: stateData } = await supabase
      .from('sheriff_round_state')
      .select('*')
      .eq('session_game_id', game.current_session_game_id)
      .maybeSingle();

    if (stateData) setRoundState(stateData);

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
        setTokenChoice(choiceData.tokens_entering === 30 ? 'ILLEGAL' : 'LEGAL');
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

  const handleSubmitChoice = async () => {
    if (!visaChoice || !tokenChoice) {
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
          tokensEntering: tokenChoice === 'ILLEGAL' ? 30 : 20,
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

  const getPlayerName = (num: number) => {
    const p = allPlayers.find(pl => pl.player_number === num);
    return p?.display_name || `Joueur ${num}`;
  };

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
                  {Object.entries(VISA_OPTIONS).map(([key, opt]) => (
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
              <CardContent>
                <RadioGroup value={tokenChoice} onValueChange={setTokenChoice} className="space-y-3">
                  <div className={`flex items-center space-x-3 p-3 rounded-lg border ${tokenChoice === 'LEGAL' ? 'border-green-500 bg-green-500/10' : 'border-[#D4AF37]/20'} ${theme.cardHover}`}>
                    <RadioGroupItem value="LEGAL" id="legal" className="border-green-500" />
                    <Label htmlFor="legal" className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Check className="h-5 w-5 text-green-500" />
                        <span className="font-medium">{TOKEN_OPTIONS.LEGAL.label}</span>
                      </div>
                      <p className="text-sm text-[#9CA3AF] mt-1">{TOKEN_OPTIONS.LEGAL.description}</p>
                      <p className="text-xs text-green-500 mt-1">{TOKEN_OPTIONS.LEGAL.risk}</p>
                    </Label>
                  </div>
                  <div className={`flex items-center space-x-3 p-3 rounded-lg border ${tokenChoice === 'ILLEGAL' ? 'border-red-500 bg-red-500/10' : 'border-[#D4AF37]/20'} ${theme.cardHover}`}>
                    <RadioGroupItem value="ILLEGAL" id="illegal" className="border-red-500" />
                    <Label htmlFor="illegal" className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                        <span className="font-medium">{TOKEN_OPTIONS.ILLEGAL.label}</span>
                      </div>
                      <p className="text-sm text-[#9CA3AF] mt-1">{TOKEN_OPTIONS.ILLEGAL.description}</p>
                      <p className="text-xs text-red-500 mt-1">{TOKEN_OPTIONS.ILLEGAL.risk}</p>
                    </Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>

            {/* Submit Button */}
            <Button 
              onClick={handleSubmitChoice} 
              disabled={!visaChoice || !tokenChoice || submittingChoice}
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
              <p>Visa: {myChoice.visa_choice === 'VICTORY_POINTS' ? '⭐ Points de Victoire' : '💰 Cagnotte'}</p>
              <p>Jetons: {myChoice.tokens_entering}💎 {myChoice.has_illegal_tokens && '(avec contrebande)'}</p>
            </div>
            <p className="mt-4 text-[#F59E0B]">En attente des autres joueurs...</p>
          </div>
        )}

        {/* Active Duel - My Turn */}
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
                  <p><strong>Fouiller:</strong> Si légal → vous perdez 10% PV. Si illégal → vous gagnez X% PV.</p>
                  <p><strong>Laisser passer:</strong> Pas de risque, mais l'adversaire peut passer avec de la contrebande.</p>
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
