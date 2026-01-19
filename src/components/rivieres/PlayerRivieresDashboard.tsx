import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ForestButton } from '@/components/ui/ForestButton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Anchor, Ship, Trophy, MessageSquare, CheckCircle, AlertTriangle, Waves } from 'lucide-react';
import { toast } from 'sonner';
import { 
  rivieresCardStyle, 
  getStatusDisplay, 
  getKeryndesDisplay 
} from './RivieresTheme';

interface RiverSessionState {
  id: string;
  manche_active: number;
  niveau_active: number;
  cagnotte_manche: number;
  danger_raw: number | null;
  danger_effectif: number | null;
  status: string;
}

interface RiverPlayerStats {
  validated_levels: number;
  keryndes_available: boolean;
  current_round_status: string;
  descended_level: number | null;
}

interface RiverDecision {
  id: string;
  decision: string;
  mise_demandee: number;
  keryndes_choice: string;
  status: string;
}

interface PlayerRivieresDashboardProps {
  gameId: string;
  sessionGameId: string;
  playerId: string;
  playerNumber: number;
  playerToken: string;
  clan: string | null;
  jetons: number;
  gameStatus?: string;
  displayName?: string;
}

export function PlayerRivieresDashboard({
  gameId,
  sessionGameId,
  playerId,
  playerNumber,
  playerToken,
  clan,
  jetons,
  gameStatus = 'IN_GAME',
  displayName,
}: PlayerRivieresDashboardProps) {
  const [state, setState] = useState<RiverSessionState | null>(null);
  const [playerStats, setPlayerStats] = useState<RiverPlayerStats | null>(null);
  const [currentDecision, setCurrentDecision] = useState<RiverDecision | null>(null);
  const [logs, setLogs] = useState<{ id: string; type: string; message: string; manche: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showStartAnimation, setShowStartAnimation] = useState(false);
  const [previousGameStatus, setPreviousGameStatus] = useState<string | undefined>(undefined);

  // Form state
  const [decision, setDecision] = useState<'RESTE' | 'DESCENDS'>('RESTE');
  const [mise, setMise] = useState(0);
  const [keryndesChoice, setKeryndesChoice] = useState<'NONE' | 'AV1_CANOT' | 'AV2_REDUCE'>('NONE');

  const isKeryndes = clan === 'Keryndes';

  // Detect game start transition (LOBBY -> IN_GAME)
  useEffect(() => {
    if (previousGameStatus === 'LOBBY' && gameStatus === 'IN_GAME') {
      setShowStartAnimation(true);
      const timer = setTimeout(() => {
        setShowStartAnimation(false);
      }, 3000); // Animation duration
      return () => clearTimeout(timer);
    }
    setPreviousGameStatus(gameStatus);
  }, [gameStatus, previousGameStatus]);

  useEffect(() => {
    fetchData();
    const channel = setupRealtime();
    return () => { supabase.removeChannel(channel); };
  }, [sessionGameId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch session state
      const { data: stateData } = await supabase
        .from('river_session_state')
        .select('*')
        .eq('session_game_id', sessionGameId)
        .single();

      if (stateData) setState(stateData);

      // Fetch player stats
      const { data: statsData } = await supabase
        .from('river_player_stats')
        .select('validated_levels, keryndes_available, current_round_status, descended_level')
        .eq('session_game_id', sessionGameId)
        .eq('player_id', playerId)
        .single();

      if (statsData) setPlayerStats(statsData);

      // Fetch current decision
      if (stateData) {
        const { data: decisionData } = await supabase
          .from('river_decisions')
          .select('*')
          .eq('session_game_id', sessionGameId)
          .eq('manche', stateData.manche_active)
          .eq('niveau', stateData.niveau_active)
          .eq('player_id', playerId)
          .single();

        if (decisionData) {
          setCurrentDecision(decisionData);
          setDecision(decisionData.decision as 'RESTE' | 'DESCENDS');
          setMise(decisionData.mise_demandee);
          setKeryndesChoice(decisionData.keryndes_choice as any);
        } else {
          setCurrentDecision(null);
          setDecision('RESTE');
          setMise(0);
          setKeryndesChoice('NONE');
        }
      }

      // Fetch logs
      const { data: logsData } = await supabase
        .from('logs_joueurs')
        .select('id, type, message, manche')
        .eq('session_game_id', sessionGameId)
        .order('timestamp', { ascending: false })
        .limit(30);

      if (logsData) setLogs(logsData);

    } catch (error) {
      console.error('Error fetching RIVIERES player data:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtime = () => {
    return supabase
      .channel(`player-rivieres-${sessionGameId}-${playerId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'river_session_state', filter: `session_game_id=eq.${sessionGameId}` },
        (payload) => { if (payload.new) { setState(payload.new as RiverSessionState); fetchData(); }})
      .on('postgres_changes', { event: '*', schema: 'public', table: 'river_player_stats', filter: `session_game_id=eq.${sessionGameId}` },
        () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'river_decisions', filter: `session_game_id=eq.${sessionGameId}` },
        () => fetchData())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'logs_joueurs', filter: `session_game_id=eq.${sessionGameId}` },
        () => fetchData())
      .subscribe();
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('rivieres-submit-decision', {
        body: {
          session_game_id: sessionGameId,
          player_token: playerToken,
          decision,
          mise_demandee: decision === 'RESTE' ? mise : 0,
          keryndes_choice: keryndesChoice,
        },
      });

      if (error) throw error;
      toast.success('Décision enregistrée !');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la soumission');
    } finally {
      setSubmitting(false);
    }
  };

  // GAME START ANIMATION
  if (showStartAnimation) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-[#0B1020] via-[#151B2D] to-[#0B1020]">
        <div className="text-center">
          {/* Background waves */}
          <div className="absolute inset-0 overflow-hidden opacity-20">
            <div className="absolute top-1/4 left-0 right-0 flex justify-center gap-8">
              <Waves className="h-24 w-24 text-blue-400 animate-wave" style={{ animationDelay: '0s' }} />
              <Waves className="h-24 w-24 text-blue-400 animate-wave" style={{ animationDelay: '0.3s' }} />
              <Waves className="h-24 w-24 text-blue-400 animate-wave" style={{ animationDelay: '0.6s' }} />
            </div>
            <div className="absolute bottom-1/4 left-0 right-0 flex justify-center gap-8">
              <Waves className="h-24 w-24 text-blue-400 animate-wave" style={{ animationDelay: '0.2s' }} />
              <Waves className="h-24 w-24 text-blue-400 animate-wave" style={{ animationDelay: '0.5s' }} />
              <Waves className="h-24 w-24 text-blue-400 animate-wave" style={{ animationDelay: '0.8s' }} />
            </div>
          </div>

          {/* Main content */}
          <div className="relative z-10">
            <div className="animate-game-start-pulse">
              <Ship className="h-24 w-24 text-[#D4AF37] mx-auto mb-6" />
            </div>
            
            <h1 className="text-4xl font-bold text-[#D4AF37] mb-4 animate-slide-up-fade" style={{ animationDelay: '0.3s' }}>
              🌊 RIVIERES 🌊
            </h1>
            
            <p className="text-xl text-[#E8E8E8] mb-2 animate-slide-up-fade" style={{ animationDelay: '0.5s' }}>
              La partie commence !
            </p>
            
            <p className="text-[#9CA3AF] animate-slide-up-fade" style={{ animationDelay: '0.7s' }}>
              Préparez-vous, {displayName || `Joueur ${playerNumber}`}...
            </p>

            <div className="mt-8 animate-slide-up-fade" style={{ animationDelay: '1s' }}>
              <div className="flex items-center justify-center gap-2 text-[#4ADE80]">
                <div className="w-2 h-2 rounded-full bg-[#4ADE80] animate-pulse" />
                <span>Chargement...</span>
                <div className="w-2 h-2 rounded-full bg-[#4ADE80] animate-pulse" style={{ animationDelay: '0.2s' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
      </div>
    );
  }

  // LOBBY VIEW - Show waiting room for players
  if (gameStatus === 'LOBBY') {
    return (
      <div className={`${rivieresCardStyle} p-6`}>
        <div className="flex items-center justify-center gap-3 mb-6">
          <Anchor className="h-8 w-8 text-[#D4AF37]" />
          <h2 className="text-2xl font-bold text-[#D4AF37]">Salle d'attente</h2>
        </div>
        
        <div className="text-center mb-6">
          <div className="text-5xl mb-4">🚣</div>
          <h3 className="text-xl font-bold text-[#E8E8E8] mb-2">
            Bienvenue, {displayName || `Joueur ${playerNumber}`} !
          </h3>
          {clan && (
            <Badge className="bg-[#D4AF37]/20 text-[#D4AF37] mb-4">
              Clan {clan}
            </Badge>
          )}
          <p className="text-[#9CA3AF]">
            Préparez-vous pour l'aventure RIVIERES
          </p>
        </div>

        <div className="bg-[#0B1020] rounded-lg p-4 text-center">
          <Ship className="h-12 w-12 text-[#D4AF37] mx-auto mb-3 animate-bounce" />
          <p className="text-[#E8E8E8] font-medium mb-2">
            En attente du lancement de la partie...
          </p>
          <p className="text-[#9CA3AF] text-sm">
            Le Maître du Jeu va bientôt démarrer l'aventure.
          </p>
        </div>

        <div className="mt-6 p-4 bg-[#20232A] rounded-lg border border-[#D4AF37]/20">
          <h4 className="text-[#D4AF37] font-medium mb-2">📜 Règles rapides</h4>
          <ul className="text-sm text-[#9CA3AF] space-y-1">
            <li>• Choisissez de rester sur le bateau ou de descendre à terre</li>
            <li>• Plus vous restez longtemps, plus le risque est grand</li>
            <li>• Misez vos jetons pour influencer votre priorité</li>
            <li>• Accumulez des niveaux validés pour marquer des points</li>
          </ul>
        </div>
      </div>
    );
  }

  if (!state || !playerStats) {
    return (
      <div className={`${rivieresCardStyle} p-6 text-center`}>
        <AlertTriangle className="h-12 w-12 text-amber-400 mx-auto mb-4" />
        <p className="text-[#E8E8E8]">En attente du démarrage de la partie...</p>
      </div>
    );
  }

  const statusDisplay = getStatusDisplay(playerStats.current_round_status);
  const canSubmit = playerStats.current_round_status === 'EN_BATEAU' && 
                    (!currentDecision || currentDecision.status === 'DRAFT');
  const isLocked = currentDecision?.status === 'LOCKED';

  return (
    <div className="space-y-4 pb-6">
      {/* Status bar */}
      <div className="grid grid-cols-4 gap-2">
        <div className={`${rivieresCardStyle} p-3 text-center`}>
          <div className="text-[#9CA3AF] text-xs">Manche</div>
          <div className="text-xl font-bold text-[#D4AF37]">{state.manche_active}/3</div>
        </div>
        <div className={`${rivieresCardStyle} p-3 text-center`}>
          <div className="text-[#9CA3AF] text-xs">Niveau</div>
          <div className="text-xl font-bold text-[#E8E8E8]">{state.niveau_active}/5</div>
        </div>
        <div className={`${rivieresCardStyle} p-3 text-center`}>
          <div className="text-[#9CA3AF] text-xs">Danger</div>
          <div className="text-xl font-bold text-[#FF6B6B]">
            {state.danger_effectif !== null ? state.danger_effectif : '—'}
          </div>
        </div>
        <div className={`${rivieresCardStyle} p-3 text-center`}>
          <div className="text-[#9CA3AF] text-xs">Cagnotte</div>
          <div className="text-xl font-bold text-[#4ADE80]">{state.cagnotte_manche}💎</div>
        </div>
      </div>

      {/* Player stats */}
      <div className={`${rivieresCardStyle} p-4`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Ship className="h-5 w-5 text-[#D4AF37]" />
            <span className="font-bold text-[#E8E8E8]">Votre statut</span>
          </div>
          <Badge className={statusDisplay.className}>{statusDisplay.label}</Badge>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-[#9CA3AF] text-xs">Jetons</div>
            <div className="text-lg font-bold text-[#4ADE80]">{jetons}💎</div>
          </div>
          <div>
            <div className="text-[#9CA3AF] text-xs">Niveaux validés</div>
            <div className="text-lg font-bold text-[#E8E8E8]">{playerStats.validated_levels}/15</div>
          </div>
          {isKeryndes && (
            <div>
              <div className="text-[#9CA3AF] text-xs">Pouvoir Keryndes</div>
              <div className="text-lg font-bold">
                {playerStats.keryndes_available ? (
                  <span className="text-purple-400">✨ Disponible</span>
                ) : (
                  <span className="text-gray-400">Utilisé</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <Tabs defaultValue="decision" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-[#20232A]">
          <TabsTrigger value="decision" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black">
            <Anchor className="h-4 w-4 mr-1" /> Décision
          </TabsTrigger>
          <TabsTrigger value="events" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black">
            <MessageSquare className="h-4 w-4 mr-1" /> Événements
          </TabsTrigger>
          <TabsTrigger value="score" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black">
            <Trophy className="h-4 w-4 mr-1" /> Score
          </TabsTrigger>
        </TabsList>

        {/* Decision Tab */}
        <TabsContent value="decision" className="mt-4">
          {playerStats.current_round_status !== 'EN_BATEAU' ? (
            <div className={`${rivieresCardStyle} p-6 text-center`}>
              {playerStats.current_round_status === 'A_TERRE' ? (
                <>
                  <div className="text-4xl mb-3">🏝️</div>
                  <h3 className="font-bold text-lg text-[#4ADE80] mb-2">Vous êtes à terre !</h3>
                  <p className="text-[#9CA3AF]">
                    Vous avez quitté le bateau au niveau {playerStats.descended_level}.
                    Attendez la fin de la manche pour remonter.
                  </p>
                </>
              ) : (
                <>
                  <div className="text-4xl mb-3">💀</div>
                  <h3 className="font-bold text-lg text-[#FF6B6B] mb-2">Vous avez chaviré</h3>
                  <p className="text-[#9CA3AF]">
                    Le bateau a coulé. Attendez la prochaine manche.
                  </p>
                </>
              )}
            </div>
          ) : isLocked ? (
            <div className={`${rivieresCardStyle} p-6 text-center`}>
              <CheckCircle className="h-12 w-12 text-[#4ADE80] mx-auto mb-3" />
              <h3 className="font-bold text-lg text-[#4ADE80] mb-2">Décision verrouillée</h3>
              <p className="text-[#9CA3AF]">
                Vous avez choisi: <strong className="text-[#E8E8E8]">
                  {currentDecision?.decision === 'RESTE' ? 
                    `Je reste (${currentDecision?.mise_demandee}💎)` : 
                    'Je descends'}
                </strong>
              </p>
              {currentDecision?.keryndes_choice !== 'NONE' && (
                <p className="text-purple-400 mt-2">
                  {getKeryndesDisplay(currentDecision?.keryndes_choice || 'NONE').label}
                </p>
              )}
            </div>
          ) : (
            <div className={`${rivieresCardStyle} p-4 space-y-4`}>
              {/* Decision toggle */}
              <div className="flex items-center justify-center gap-4 p-4 bg-[#0B1020] rounded-lg">
                <ForestButton
                  size="lg"
                  onClick={() => setDecision('RESTE')}
                  className={decision === 'RESTE' 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}
                >
                  🚣 Je reste
                </ForestButton>
                <ForestButton
                  size="lg"
                  onClick={() => { setDecision('DESCENDS'); setKeryndesChoice('NONE'); }}
                  className={decision === 'DESCENDS' 
                    ? 'bg-amber-600 hover:bg-amber-700 text-white' 
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}
                >
                  🏝️ Je descends
                </ForestButton>
              </div>

              {/* Mise input (only if RESTE) */}
              {decision === 'RESTE' && (
                <div className="space-y-2">
                  <Label className="text-[#9CA3AF]">Votre mise (0 - {jetons}💎)</Label>
                  <div className="flex gap-3 items-center">
                    <Input
                      type="number"
                      min={0}
                      max={jetons}
                      value={mise}
                      onChange={(e) => setMise(Math.min(jetons, Math.max(0, Number(e.target.value))))}
                      className="text-2xl font-bold text-center bg-[#0B1020] border-[#D4AF37]/30 text-[#4ADE80]"
                    />
                    <span className="text-2xl">💎</span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {[0, 10, 25, 50].map((val) => (
                      <ForestButton
                        key={val}
                        size="sm"
                        variant="outline"
                        onClick={() => setMise(Math.min(jetons, val))}
                        className="border-[#D4AF37]/30 text-[#D4AF37]"
                      >
                        {val}
                      </ForestButton>
                    ))}
                    <ForestButton
                      size="sm"
                      variant="outline"
                      onClick={() => setMise(jetons)}
                      className="border-[#D4AF37]/30 text-[#D4AF37]"
                    >
                      MAX
                    </ForestButton>
                  </div>
                </div>
              )}

              {/* Keryndes options */}
              {isKeryndes && playerStats.keryndes_available && (
                <div className="space-y-2 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                  <Label className="text-purple-400 font-bold">Pouvoir Keryndes (usage unique)</Label>
                  <RadioGroup 
                    value={keryndesChoice} 
                    onValueChange={(v) => setKeryndesChoice(v as any)}
                    className="space-y-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="NONE" id="none" />
                      <Label htmlFor="none" className="text-[#9CA3AF]">Ne pas utiliser</Label>
                    </div>
                    {decision === 'RESTE' && (
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="AV1_CANOT" id="canot" />
                        <Label htmlFor="canot" className="text-[#E8E8E8]">
                          🛶 Canot (si échec, je ne chavire pas)
                        </Label>
                      </div>
                    )}
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="AV2_REDUCE" id="reduce" />
                      <Label htmlFor="reduce" className="text-[#E8E8E8]">
                        🌊 Réduction (danger -20)
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              )}

              {/* Submit button */}
              <ForestButton
                size="lg"
                onClick={handleSubmit}
                disabled={submitting || !canSubmit}
                className="w-full bg-[#D4AF37] hover:bg-[#D4AF37]/80 text-black text-lg py-6"
              >
                {submitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : currentDecision ? (
                  'Modifier ma décision'
                ) : (
                  'Valider ma décision'
                )}
              </ForestButton>

              {currentDecision && currentDecision.status === 'DRAFT' && (
                <p className="text-center text-amber-400 text-sm">
                  ⏳ En attente de clôture par le MJ
                </p>
              )}
            </div>
          )}
        </TabsContent>

        {/* Events Tab */}
        <TabsContent value="events" className="mt-4">
          <div className={`${rivieresCardStyle} p-4 max-h-96 overflow-y-auto`}>
            <h3 className="font-bold text-[#D4AF37] mb-3">Événements</h3>
            <div className="space-y-2 text-sm">
              {logs.map((log) => (
                <div key={log.id} className="p-3 bg-[#0B1020] rounded-lg">
                  <div className="flex gap-2 items-start">
                    <Badge className="bg-[#D4AF37]/20 text-[#D4AF37] text-xs shrink-0">M{log.manche}</Badge>
                    <p className="text-[#E8E8E8]">{log.message}</p>
                  </div>
                </div>
              ))}
              {logs.length === 0 && (
                <p className="text-[#9CA3AF] text-center py-4">Aucun événement</p>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Score Tab */}
        <TabsContent value="score" className="mt-4">
          <div className={`${rivieresCardStyle} p-6`}>
            <h3 className="font-bold text-[#D4AF37] mb-4 text-center">Votre progression</h3>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="text-center p-4 bg-[#0B1020] rounded-lg">
                <div className="text-3xl font-bold text-[#E8E8E8]">{playerStats.validated_levels}</div>
                <div className="text-[#9CA3AF] text-sm">Niveaux validés</div>
              </div>
              <div className="text-center p-4 bg-[#0B1020] rounded-lg">
                <div className="text-3xl font-bold text-[#4ADE80]">{jetons}</div>
                <div className="text-[#9CA3AF] text-sm">Jetons</div>
              </div>
            </div>

            {/* Score formula explanation */}
            <div className="p-4 bg-[#0B1020] rounded-lg space-y-2">
              <h4 className="font-bold text-[#E8E8E8]">Calcul du score final</h4>
              <p className="text-sm text-[#9CA3AF]">
                {playerStats.validated_levels >= 9 ? (
                  <>
                    ✅ Seuil de 9 niveaux atteint !<br />
                    Score = jetons = <strong className="text-[#4ADE80]">{jetons} pts</strong>
                  </>
                ) : (
                  <>
                    ⚠️ Seuil de 9 niveaux non atteint<br />
                    Score = ({playerStats.validated_levels} × {jetons}) / 9 = 
                    <strong className="text-amber-400"> ~{Math.round((playerStats.validated_levels * jetons) / 9)} pts</strong>
                    <br />
                    <span className="text-xs text-[#9CA3AF]">(pénalité appliquée)</span>
                  </>
                )}
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
