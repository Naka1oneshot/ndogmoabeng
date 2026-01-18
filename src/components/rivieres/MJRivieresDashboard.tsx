import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ForestButton } from '@/components/ui/ForestButton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Loader2, Dice6, Lock, Play, Users, History, 
  AlertTriangle, CheckCircle, XCircle, Anchor
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  rivieresCardStyle, 
  getStatusDisplay, 
  getDecisionDisplay, 
  getKeryndesDisplay 
} from './RivieresTheme';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface RiverSessionState {
  id: string;
  manche_active: number;
  niveau_active: number;
  cagnotte_manche: number;
  danger_dice_count: number | null;
  danger_raw: number | null;
  danger_effectif: number | null;
  status: string;
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
  player_number: number;
  clan: string | null;
  jetons: number;
}

interface MJRivieresDashboardProps {
  gameId: string;
  sessionGameId: string;
}

export function MJRivieresDashboard({ gameId, sessionGameId }: MJRivieresDashboardProps) {
  const [state, setState] = useState<RiverSessionState | null>(null);
  const [playerStats, setPlayerStats] = useState<RiverPlayerStats[]>([]);
  const [decisions, setDecisions] = useState<RiverDecision[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Danger form
  const [diceCount, setDiceCount] = useState(3);
  const [manualDanger, setManualDanger] = useState(0);

  // Missing players dialog
  const [missingPlayersDialog, setMissingPlayersDialog] = useState(false);
  const [missingPlayers, setMissingPlayers] = useState<{ player_id: string; display_name: string }[]>([]);
  const [missingActions, setMissingActions] = useState<{ [key: string]: 'DESCENDS' | 'RESTE_ZERO' }>({});

  // Logs
  const [logs, setLogs] = useState<{ id: string; action: string; details: string; manche: number }[]>([]);

  useEffect(() => {
    fetchData();
    const channel = setupRealtime();
    return () => { supabase.removeChannel(channel); };
  }, [sessionGameId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch state
      const { data: stateData } = await supabase
        .from('river_session_state')
        .select('*')
        .eq('session_game_id', sessionGameId)
        .single();

      if (stateData) setState(stateData);

      // Fetch player stats
      const { data: statsData } = await supabase
        .from('river_player_stats')
        .select('*')
        .eq('session_game_id', sessionGameId)
        .order('player_num');

      if (statsData) setPlayerStats(statsData);

      // Fetch players
      const { data: playersData } = await supabase
        .from('game_players')
        .select('id, display_name, player_number, clan, jetons')
        .eq('game_id', gameId)
        .eq('status', 'ACTIVE')
        .order('player_number');

      if (playersData) setPlayers(playersData);

      // Fetch current level decisions
      if (stateData) {
        const { data: decisionsData } = await supabase
          .from('river_decisions')
          .select('*')
          .eq('session_game_id', sessionGameId)
          .eq('manche', stateData.manche_active)
          .eq('niveau', stateData.niveau_active);

        if (decisionsData) setDecisions(decisionsData);
      }

      // Fetch logs
      const { data: logsData } = await supabase
        .from('logs_mj')
        .select('id, action, details, manche')
        .eq('session_game_id', sessionGameId)
        .order('timestamp', { ascending: false })
        .limit(50);

      if (logsData) setLogs(logsData);

    } catch (error) {
      console.error('Error fetching RIVIERES data:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtime = () => {
    return supabase
      .channel(`mj-rivieres-${sessionGameId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'river_session_state', filter: `session_game_id=eq.${sessionGameId}` }, 
        (payload) => { if (payload.new) setState(payload.new as RiverSessionState); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'river_player_stats', filter: `session_game_id=eq.${sessionGameId}` },
        () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'river_decisions', filter: `session_game_id=eq.${sessionGameId}` },
        () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${gameId}` },
        () => fetchData())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'logs_mj', filter: `session_game_id=eq.${sessionGameId}` },
        () => fetchData())
      .subscribe();
  };

  const handleRollDanger = async () => {
    setActionLoading('roll');
    try {
      const { data, error } = await supabase.functions.invoke('rivieres-set-danger', {
        body: { session_game_id: sessionGameId, mode: 'ROLL', dice_count: diceCount },
      });
      if (error) throw error;
      toast.success(`Danger lancé: ${data.danger_raw} (${diceCount} dés)`);
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors du lancer');
    } finally {
      setActionLoading(null);
    }
  };

  const handleManualDanger = async () => {
    setActionLoading('manual');
    try {
      const { data, error } = await supabase.functions.invoke('rivieres-set-danger', {
        body: { session_game_id: sessionGameId, mode: 'MANUAL', danger_value: manualDanger, dice_count: diceCount },
      });
      if (error) throw error;
      toast.success(`Danger défini: ${data.danger_raw}`);
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la définition');
    } finally {
      setActionLoading(null);
    }
  };

  const handleLockDecisions = async () => {
    setActionLoading('lock');
    try {
      const { data, error } = await supabase.functions.invoke('rivieres-lock-decisions', {
        body: { session_game_id: sessionGameId },
      });

      if (error) throw error;

      if (data.needs_mj_decision) {
        setMissingPlayers(data.missing_players);
        setMissingActions({});
        setMissingPlayersDialog(true);
      } else {
        toast.success('Décisions verrouillées');
      }
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors du verrouillage');
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirmMissingPlayers = async () => {
    setActionLoading('lock');
    try {
      const actions = Object.entries(missingActions).map(([player_id, action]) => ({
        player_id,
        action,
      }));

      const { data, error } = await supabase.functions.invoke('rivieres-lock-decisions', {
        body: { session_game_id: sessionGameId, missing_players_action: actions },
      });

      if (error) throw error;
      toast.success('Décisions verrouillées');
      setMissingPlayersDialog(false);
    } catch (error: any) {
      toast.error(error.message || 'Erreur');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResolveLevel = async () => {
    setActionLoading('resolve');
    try {
      const { data, error } = await supabase.functions.invoke('rivieres-resolve-level', {
        body: { session_game_id: sessionGameId },
      });

      if (error) throw error;

      if (data.outcome === 'SUCCESS') {
        toast.success('✅ Niveau réussi !');
      } else {
        toast.error('⛵ Le bateau chavire !');
      }
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la résolution');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
      </div>
    );
  }

  if (!state) {
    return (
      <div className={`${rivieresCardStyle} p-6 text-center`}>
        <AlertTriangle className="h-12 w-12 text-amber-400 mx-auto mb-4" />
        <p className="text-[#E8E8E8]">Session RIVIERES non initialisée</p>
        <ForestButton 
          className="mt-4 bg-[#D4AF37] hover:bg-[#D4AF37]/80 text-black"
          onClick={async () => {
            setActionLoading('init');
            try {
              await supabase.functions.invoke('rivieres-init', {
                body: { session_game_id: sessionGameId },
              });
              toast.success('Session initialisée');
              fetchData();
            } catch (error: any) {
              toast.error(error.message || 'Erreur');
            } finally {
              setActionLoading(null);
            }
          }}
          disabled={actionLoading === 'init'}
        >
          {actionLoading === 'init' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Initialiser RIVIERES'}
        </ForestButton>
      </div>
    );
  }

  const enBateauPlayers = playerStats.filter(s => s.current_round_status === 'EN_BATEAU');
  const submittedDecisions = decisions.filter(d => d.status === 'DRAFT' || d.status === 'LOCKED');
  const lockedDecisions = decisions.filter(d => d.status === 'LOCKED');
  const totalMises = lockedDecisions.reduce((sum, d) => d.decision === 'RESTE' ? sum + d.mise_demandee : sum, 0);
  const allLocked = lockedDecisions.length > 0 && lockedDecisions.length >= enBateauPlayers.length;
  const dangerSet = state.danger_raw !== null;
  const canResolve = dangerSet && allLocked;

  const getPlayerById = (id: string) => players.find(p => p.id === id);
  const getStatsByPlayerId = (id: string) => playerStats.find(s => s.player_id === id);

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className={`${rivieresCardStyle} p-3 text-center`}>
          <div className="text-[#9CA3AF] text-xs">Manche</div>
          <div className="text-2xl font-bold text-[#D4AF37]">{state.manche_active}/3</div>
        </div>
        <div className={`${rivieresCardStyle} p-3 text-center`}>
          <div className="text-[#9CA3AF] text-xs">Niveau</div>
          <div className="text-2xl font-bold text-[#E8E8E8]">{state.niveau_active}/5</div>
        </div>
        <div className={`${rivieresCardStyle} p-3 text-center`}>
          <div className="text-[#9CA3AF] text-xs">Cagnotte</div>
          <div className="text-2xl font-bold text-[#4ADE80]">{state.cagnotte_manche}💎</div>
        </div>
        <div className={`${rivieresCardStyle} p-3 text-center`}>
          <div className="text-[#9CA3AF] text-xs">Danger</div>
          <div className={`text-2xl font-bold ${state.danger_effectif !== null ? 'text-[#FF6B6B]' : 'text-[#9CA3AF]'}`}>
            {state.danger_effectif ?? '—'}
          </div>
        </div>
        <div className={`${rivieresCardStyle} p-3 text-center`}>
          <div className="text-[#9CA3AF] text-xs">Statut</div>
          <Badge className={state.status === 'RUNNING' ? 'bg-green-600' : 'bg-gray-600'}>
            {state.status}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="actions" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-[#20232A]">
          <TabsTrigger value="actions" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black">
            <Play className="h-4 w-4 mr-1" /> Actions
          </TabsTrigger>
          <TabsTrigger value="players" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black">
            <Users className="h-4 w-4 mr-1" /> Joueurs
          </TabsTrigger>
          <TabsTrigger value="decisions" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black">
            <Anchor className="h-4 w-4 mr-1" /> Décisions
          </TabsTrigger>
          <TabsTrigger value="logs" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black">
            <History className="h-4 w-4 mr-1" /> Logs
          </TabsTrigger>
        </TabsList>

        {/* Actions Tab */}
        <TabsContent value="actions" className="space-y-4 mt-4">
          {/* Danger Section */}
          <div className={`${rivieresCardStyle} p-4`}>
            <h3 className="font-bold text-[#D4AF37] mb-3 flex items-center gap-2">
              <Dice6 className="h-5 w-5" /> Définir le Danger
            </h3>
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="text-xs text-[#9CA3AF]">Nb dés</label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={diceCount}
                  onChange={(e) => setDiceCount(Number(e.target.value))}
                  className="w-20 bg-[#0B1020] border-[#D4AF37]/30 text-white"
                />
              </div>
              <ForestButton
                onClick={handleRollDanger}
                disabled={actionLoading === 'roll'}
                className="bg-[#D4AF37] hover:bg-[#D4AF37]/80 text-black"
              >
                {actionLoading === 'roll' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Dice6 className="h-4 w-4 mr-1" />}
                Lancer
              </ForestButton>
              <div className="text-[#9CA3AF]">ou</div>
              <div>
                <label className="text-xs text-[#9CA3AF]">Danger manuel</label>
                <Input
                  type="number"
                  min={0}
                  value={manualDanger}
                  onChange={(e) => setManualDanger(Number(e.target.value))}
                  className="w-24 bg-[#0B1020] border-[#D4AF37]/30 text-white"
                />
              </div>
              <ForestButton
                onClick={handleManualDanger}
                disabled={actionLoading === 'manual'}
                variant="outline"
                className="border-[#D4AF37] text-[#D4AF37]"
              >
                {actionLoading === 'manual' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Définir'}
              </ForestButton>
            </div>
            {state.danger_raw !== null && (
              <div className="mt-3 flex gap-4 text-sm">
                <span className="text-[#9CA3AF]">Danger brut: <strong className="text-[#FF6B6B]">{state.danger_raw}</strong></span>
                {state.danger_effectif !== state.danger_raw && (
                  <span className="text-[#9CA3AF]">Effectif: <strong className="text-[#FF6B6B]">{state.danger_effectif}</strong></span>
                )}
              </div>
            )}
          </div>

          {/* Lock & Resolve Section */}
          <div className={`${rivieresCardStyle} p-4`}>
            <h3 className="font-bold text-[#D4AF37] mb-3 flex items-center gap-2">
              <Lock className="h-5 w-5" /> Actions MJ
            </h3>
            <div className="flex gap-3 flex-wrap">
              <ForestButton
                onClick={handleLockDecisions}
                disabled={actionLoading === 'lock' || allLocked}
                className="bg-amber-600 hover:bg-amber-700"
              >
                {actionLoading === 'lock' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4 mr-1" />}
                Clôturer décisions
              </ForestButton>

              <ForestButton
                onClick={handleResolveLevel}
                disabled={actionLoading === 'resolve' || !canResolve}
                className={canResolve ? 'bg-[#1B4D3E] hover:bg-[#1B4D3E]/80' : 'bg-gray-600'}
              >
                {actionLoading === 'resolve' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
                Résoudre le niveau
              </ForestButton>
            </div>

            {!canResolve && (
              <div className="mt-3 text-sm text-amber-400 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {!dangerSet && 'Danger non défini. '}
                {!allLocked && 'Décisions non verrouillées.'}
              </div>
            )}

            {canResolve && (
              <div className="mt-3 text-sm text-[#4ADE80] flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Total mises: {totalMises}💎 vs Danger: {state.danger_effectif}
                {totalMises > (state.danger_effectif || 0) ? ' → SUCCÈS' : ' → ÉCHEC'}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Players Tab */}
        <TabsContent value="players" className="mt-4">
          <div className={`${rivieresCardStyle} overflow-hidden`}>
            <table className="w-full text-sm">
              <thead className="bg-[#0B1020]">
                <tr>
                  <th className="p-2 text-left text-[#9CA3AF]">#</th>
                  <th className="p-2 text-left text-[#9CA3AF]">Nom</th>
                  <th className="p-2 text-left text-[#9CA3AF]">Clan</th>
                  <th className="p-2 text-right text-[#9CA3AF]">Jetons</th>
                  <th className="p-2 text-center text-[#9CA3AF]">Statut</th>
                  <th className="p-2 text-center text-[#9CA3AF]">Niveaux</th>
                  <th className="p-2 text-center text-[#9CA3AF]">Keryndes</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p) => {
                  const stats = getStatsByPlayerId(p.id);
                  const statusDisplay = stats ? getStatusDisplay(stats.current_round_status) : null;
                  return (
                    <tr key={p.id} className="border-t border-[#D4AF37]/10">
                      <td className="p-2 text-[#D4AF37] font-bold">{p.player_number}</td>
                      <td className="p-2 text-[#E8E8E8]">{p.display_name}</td>
                      <td className="p-2 text-[#9CA3AF]">{p.clan || '-'}</td>
                      <td className="p-2 text-right text-[#4ADE80] font-mono">{p.jetons}</td>
                      <td className="p-2 text-center">
                        {statusDisplay && (
                          <Badge className={statusDisplay.className}>{statusDisplay.label}</Badge>
                        )}
                      </td>
                      <td className="p-2 text-center text-[#E8E8E8]">{stats?.validated_levels ?? 0}/15</td>
                      <td className="p-2 text-center">
                        {p.clan === 'Keryndes' ? (
                          stats?.keryndes_available ? (
                            <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Dispo</Badge>
                          ) : (
                            <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">Utilisé</Badge>
                          )
                        ) : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Decisions Tab */}
        <TabsContent value="decisions" className="mt-4">
          <div className={`${rivieresCardStyle} p-4`}>
            <h3 className="font-bold text-[#D4AF37] mb-3">
              Décisions Niveau {state.niveau_active} - Manche {state.manche_active}
            </h3>
            <div className="space-y-2">
              {enBateauPlayers.map((stats) => {
                const player = getPlayerById(stats.player_id);
                const decision = decisions.find(d => d.player_id === stats.player_id);
                const decDisplay = decision ? getDecisionDisplay(decision.decision) : null;
                const kerDisplay = decision ? getKeryndesDisplay(decision.keryndes_choice) : null;

                return (
                  <div key={stats.id} className="flex items-center justify-between p-3 bg-[#0B1020] rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-[#D4AF37] font-bold">#{stats.player_num}</span>
                      <span className="text-[#E8E8E8]">{player?.display_name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      {decision ? (
                        <>
                          <span className={decDisplay?.className}>{decDisplay?.label}</span>
                          {decision.decision === 'RESTE' && (
                            <span className="text-[#4ADE80] font-mono">{decision.mise_demandee}💎</span>
                          )}
                          {decision.keryndes_choice !== 'NONE' && (
                            <span className={kerDisplay?.className}>{kerDisplay?.label}</span>
                          )}
                          <Badge className={decision.status === 'LOCKED' ? 'bg-green-600' : 'bg-amber-600'}>
                            {decision.status === 'LOCKED' ? <Lock className="h-3 w-3" /> : '⏳'}
                          </Badge>
                        </>
                      ) : (
                        <span className="text-[#9CA3AF]">En attente...</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="mt-4">
          <div className={`${rivieresCardStyle} p-4 max-h-96 overflow-y-auto`}>
            <h3 className="font-bold text-[#D4AF37] mb-3">Logs MJ</h3>
            <div className="space-y-2 text-sm">
              {logs.map((log) => (
                <div key={log.id} className="p-2 bg-[#0B1020] rounded flex gap-3">
                  <span className="text-[#9CA3AF]">M{log.manche}</span>
                  <span className="text-[#D4AF37] font-mono">{log.action}</span>
                  <span className="text-[#E8E8E8] flex-1">{log.details}</span>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Missing Players Dialog */}
      <AlertDialog open={missingPlayersDialog} onOpenChange={setMissingPlayersDialog}>
        <AlertDialogContent className="bg-[#20232A] border-[#D4AF37]/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#D4AF37]">Joueurs sans décision</AlertDialogTitle>
            <AlertDialogDescription className="text-[#9CA3AF]">
              Ces joueurs n'ont pas soumis de décision. Choisissez leur action :
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-4">
            {missingPlayers.map((mp) => (
              <div key={mp.player_id} className="flex items-center justify-between p-3 bg-[#0B1020] rounded-lg">
                <span className="text-[#E8E8E8]">{mp.display_name}</span>
                <div className="flex gap-2">
                  <ForestButton
                    size="sm"
                    variant={missingActions[mp.player_id] === 'DESCENDS' ? 'primary' : 'outline'}
                    onClick={() => setMissingActions(prev => ({ ...prev, [mp.player_id]: 'DESCENDS' }))}
                    className={missingActions[mp.player_id] === 'DESCENDS' ? 'bg-amber-600' : 'border-amber-600 text-amber-400'}
                  >
                    Descend
                  </ForestButton>
                  <ForestButton
                    size="sm"
                    variant={missingActions[mp.player_id] === 'RESTE_ZERO' ? 'primary' : 'outline'}
                    onClick={() => setMissingActions(prev => ({ ...prev, [mp.player_id]: 'RESTE_ZERO' }))}
                    className={missingActions[mp.player_id] === 'RESTE_ZERO' ? 'bg-blue-600' : 'border-blue-600 text-blue-400'}
                  >
                    Reste (0💎)
                  </ForestButton>
                </div>
              </div>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#9CA3AF] text-[#9CA3AF]">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmMissingPlayers}
              disabled={Object.keys(missingActions).length !== missingPlayers.length}
              className="bg-[#D4AF37] text-black hover:bg-[#D4AF37]/80"
            >
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
