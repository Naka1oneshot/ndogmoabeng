import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { generateSuggestedDanger, calculateDangerRange } from '@/lib/rivieresDangerCalculator';

interface RiverSessionState {
  id: string;
  manche_active: number;
  niveau_active: number;
  cagnotte_manche: number;
  danger_raw: number | null;
  danger_effectif: number | null;
  status: string;
  auto_mode: boolean;
  auto_countdown_ends_at: string | null;
  auto_countdown_active: boolean;
  auto_last_step: string | null;
}

interface RiverDecision {
  id: string;
  player_id: string;
  player_num: number;
  decision: string;
  status: string;
}

interface GamePlayer {
  id: string;
  is_bot: boolean;
  display_name: string;
  player_number: number | null;
}

interface AutoControllerState {
  autoMode: boolean;
  countdownActive: boolean;
  countdownEndsAt: Date | null;
  currentStep: string | null;
  remainingSeconds: number;
}

interface UseRivieresAutoControllerResult {
  state: AutoControllerState;
  toggleAutoMode: () => Promise<void>;
  isActionInFlight: boolean;
}

const COUNTDOWN_DURATION_MS = 15000; // 15 seconds

export function useRivieresAutoController(
  gameId: string,
  sessionGameId: string,
  onLockAnimationComplete?: () => void,
  onResolveAnimationComplete?: () => void
): UseRivieresAutoControllerResult {
  const [sessionState, setSessionState] = useState<RiverSessionState | null>(null);
  const [decisions, setDecisions] = useState<RiverDecision[]>([]);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [enBateauCount, setEnBateauCount] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  
  const actionInFlightRef = useRef(false);
  const cancelledRef = useRef(false);
  const lockAnimationCompleteRef = useRef<(() => void) | null>(null);
  const resolveAnimationCompleteRef = useRef<(() => void) | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch initial data
  const fetchData = useCallback(async () => {
    if (!sessionGameId) return;

    const [stateResult, decisionsResult, playersResult, statsResult] = await Promise.all([
      supabase
        .from('river_session_state')
        .select('*')
        .eq('session_game_id', sessionGameId)
        .single(),
      supabase
        .from('river_decisions')
        .select('id, player_id, player_num, decision, status')
        .eq('session_game_id', sessionGameId),
      supabase
        .from('game_players')
        .select('id, is_bot, display_name, player_number')
        .eq('game_id', gameId)
        .eq('status', 'ACTIVE')
        .eq('is_host', false),
      supabase
        .from('river_player_stats')
        .select('player_id')
        .eq('session_game_id', sessionGameId)
        .eq('current_round_status', 'EN_BATEAU'),
    ]);

    if (stateResult.data) setSessionState(stateResult.data as RiverSessionState);
    if (decisionsResult.data) setDecisions(decisionsResult.data);
    if (playersResult.data) setPlayers(playersResult.data);
    if (statsResult.data) setEnBateauCount(statsResult.data.length);
  }, [gameId, sessionGameId]);

  // Setup realtime subscriptions
  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel(`auto-controller-${sessionGameId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'river_session_state', 
        filter: `session_game_id=eq.${sessionGameId}` 
      }, (payload) => {
        if (payload.new) {
          setSessionState(payload.new as RiverSessionState);
        }
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'river_decisions', 
        filter: `session_game_id=eq.${sessionGameId}` 
      }, () => fetchData())
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'river_player_stats', 
        filter: `session_game_id=eq.${sessionGameId}` 
      }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionGameId, fetchData]);

  // Countdown timer
  useEffect(() => {
    if (!sessionState?.auto_countdown_active || !sessionState.auto_countdown_ends_at) {
      setRemainingSeconds(0);
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      return;
    }

    const updateCountdown = () => {
      const endsAt = new Date(sessionState.auto_countdown_ends_at!).getTime();
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000));
      setRemainingSeconds(remaining);
    };

    updateCountdown();
    countdownTimerRef.current = setInterval(updateCountdown, 100);

    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    };
  }, [sessionState?.auto_countdown_active, sessionState?.auto_countdown_ends_at]);

  // Toggle auto mode
  const toggleAutoMode = useCallback(async () => {
    if (!sessionState) return;

    const newAutoMode = !sessionState.auto_mode;

    await supabase
      .from('river_session_state')
      .update({
        auto_mode: newAutoMode,
        auto_countdown_active: newAutoMode ? sessionState.auto_countdown_active : false,
        auto_countdown_ends_at: newAutoMode ? sessionState.auto_countdown_ends_at : null,
        auto_last_step: newAutoMode ? 'ENABLED' : null,
        auto_updated_at: new Date().toISOString(),
      })
      .eq('id', sessionState.id);

    if (!newAutoMode) {
      cancelledRef.current = true;
    } else {
      cancelledRef.current = false;
    }
  }, [sessionState]);

  // FSM Stepper - Main automation logic
  useEffect(() => {
    if (!sessionState?.auto_mode || actionInFlightRef.current || cancelledRef.current) {
      return;
    }

    const runStep = async () => {
      if (cancelledRef.current || !sessionState.auto_mode) return;

      const currentManche = sessionState.manche_active;
      const currentNiveau = sessionState.niveau_active;

      // Filter decisions for current level
      const currentDecisions = decisions.filter(
        d => d.status === 'DRAFT' || d.status === 'LOCKED'
      );
      const lockedDecisions = currentDecisions.filter(d => d.status === 'LOCKED');
      const allLocked = lockedDecisions.length > 0 && lockedDecisions.length >= enBateauCount;

      // Get human players count
      const humanPlayers = players.filter(p => !p.display_name.includes('🤖'));
      const humanDecisions = currentDecisions.filter(d => 
        humanPlayers.some(hp => hp.id === d.player_id)
      );
      const majorityThreshold = Math.ceil(humanPlayers.length / 2);
      const humansMajorityValidated = humanDecisions.length >= majorityThreshold;
      const allHumansValidated = humanDecisions.length >= humanPlayers.length;

      // S1: NEED_DANGER - Generate danger if not set
      if (sessionState.danger_raw === null && sessionState.status === 'RUNNING') {
        console.log('[AutoController] Step: NEED_DANGER');
        actionInFlightRef.current = true;
        
        try {
          const dangerRange = calculateDangerRange(enBateauCount, currentManche, currentNiveau);
          const suggestedDanger = Math.floor(
            Math.random() * (dangerRange.range.max - dangerRange.range.min + 1)
          ) + dangerRange.range.min;

          await supabase.functions.invoke('rivieres-set-danger', {
            body: { 
              session_game_id: sessionGameId, 
              mode: 'MANUAL', 
              danger_value: suggestedDanger 
            },
          });

          await supabase
            .from('river_session_state')
            .update({ 
              auto_last_step: 'DANGER_SET',
              auto_updated_at: new Date().toISOString(),
            })
            .eq('id', sessionState.id);

        } catch (error) {
          console.error('[AutoController] Error setting danger:', error);
        } finally {
          actionInFlightRef.current = false;
        }
        return;
      }

      // S2: WAIT_DECISIONS - Validate bot decisions if needed
      if (sessionState.danger_raw !== null && !allLocked && sessionState.status === 'RUNNING') {
        // First, ensure bots have made decisions
        const botPlayers = players.filter(p => p.display_name.includes('🤖'));
        const botDecisions = currentDecisions.filter(d => 
          botPlayers.some(bp => bp.id === d.player_id)
        );

        if (botDecisions.length < botPlayers.length) {
          console.log('[AutoController] Step: BOT_DECISIONS');
          actionInFlightRef.current = true;

          try {
            await supabase.functions.invoke('rivieres-bot-decisions', {
              body: { session_game_id: sessionGameId },
            });

            await supabase
              .from('river_session_state')
              .update({ 
                auto_last_step: 'BOTS_VALIDATED',
                auto_updated_at: new Date().toISOString(),
              })
              .eq('id', sessionState.id);

          } catch (error) {
            console.error('[AutoController] Error with bot decisions:', error);
          } finally {
            actionInFlightRef.current = false;
          }
          return;
        }

        // Check if we need to start countdown (majority humans validated)
        if (humansMajorityValidated && !sessionState.auto_countdown_active && humanPlayers.length > 0) {
          console.log('[AutoController] Step: START_COUNTDOWN');
          actionInFlightRef.current = true;

          try {
            const countdownEndsAt = new Date(Date.now() + COUNTDOWN_DURATION_MS).toISOString();
            
            await supabase
              .from('river_session_state')
              .update({
                auto_countdown_active: true,
                auto_countdown_ends_at: countdownEndsAt,
                auto_last_step: 'COUNTDOWN_STARTED',
                auto_updated_at: new Date().toISOString(),
              })
              .eq('id', sessionState.id);

          } catch (error) {
            console.error('[AutoController] Error starting countdown:', error);
          } finally {
            actionInFlightRef.current = false;
          }
          return;
        }

        // Check if all humans validated - skip countdown and lock immediately
        if (allHumansValidated && humanPlayers.length > 0) {
          console.log('[AutoController] Step: ALL_HUMANS_VALIDATED - Immediate lock');
          actionInFlightRef.current = true;

          try {
            await supabase
              .from('river_session_state')
              .update({
                auto_countdown_active: false,
                auto_countdown_ends_at: null,
                auto_last_step: 'LOCKING',
                auto_updated_at: new Date().toISOString(),
              })
              .eq('id', sessionState.id);

            await supabase.functions.invoke('rivieres-lock-decisions', {
              body: { session_game_id: sessionGameId },
            });

          } catch (error) {
            console.error('[AutoController] Error locking decisions:', error);
          } finally {
            actionInFlightRef.current = false;
          }
          return;
        }

        // S3: COUNTDOWN_ACTIVE - Check if countdown expired
        if (sessionState.auto_countdown_active && sessionState.auto_countdown_ends_at) {
          const endsAt = new Date(sessionState.auto_countdown_ends_at).getTime();
          const now = Date.now();

          if (now >= endsAt) {
            console.log('[AutoController] Step: COUNTDOWN_EXPIRED - Locking');
            actionInFlightRef.current = true;

            try {
              await supabase
                .from('river_session_state')
                .update({
                  auto_countdown_active: false,
                  auto_countdown_ends_at: null,
                  auto_last_step: 'LOCKING',
                  auto_updated_at: new Date().toISOString(),
                })
                .eq('id', sessionState.id);

              const { data } = await supabase.functions.invoke('rivieres-lock-decisions', {
                body: { session_game_id: sessionGameId },
              });

              // Handle missing players if needed
              if (data?.needs_mj_decision) {
                const defaultActions = data.missing_players.map((mp: any) => ({
                  player_id: mp.player_id,
                  action: 'RESTE_ZERO' as const,
                }));
                await supabase.functions.invoke('rivieres-lock-decisions', {
                  body: { session_game_id: sessionGameId, missing_players_action: defaultActions },
                });
              }

            } catch (error) {
              console.error('[AutoController] Error locking decisions:', error);
            } finally {
              actionInFlightRef.current = false;
            }
            return;
          }
        }

        // Full bot game - no countdown needed, lock immediately when all bots decided
        if (humanPlayers.length === 0 && botDecisions.length >= botPlayers.length) {
          console.log('[AutoController] Step: FULL_BOT_GAME - Immediate lock');
          actionInFlightRef.current = true;

          try {
            await supabase
              .from('river_session_state')
              .update({
                auto_last_step: 'LOCKING',
                auto_updated_at: new Date().toISOString(),
              })
              .eq('id', sessionState.id);

            await supabase.functions.invoke('rivieres-lock-decisions', {
              body: { session_game_id: sessionGameId },
            });

          } catch (error) {
            console.error('[AutoController] Error locking decisions:', error);
          } finally {
            actionInFlightRef.current = false;
          }
          return;
        }
      }

      // S4: LOCKED_WAIT_ANIM - All locked, wait for lock animation then resolve
      if (allLocked && sessionState.auto_last_step !== 'RESOLVING' && sessionState.status === 'RUNNING') {
        console.log('[AutoController] Step: LOCKED_WAIT_ANIM - Waiting then resolving');
        actionInFlightRef.current = true;

        try {
          // Wait for lock animation (the animation component will call back)
          // For now, use a reasonable delay that matches animation duration
          await new Promise(resolve => setTimeout(resolve, 5500)); // Lock animation duration

          if (cancelledRef.current) {
            actionInFlightRef.current = false;
            return;
          }

          await supabase
            .from('river_session_state')
            .update({
              auto_last_step: 'RESOLVING',
              auto_updated_at: new Date().toISOString(),
            })
            .eq('id', sessionState.id);

          await supabase.functions.invoke('rivieres-resolve-level', {
            body: { session_game_id: sessionGameId },
          });

          // Wait for resolve animation
          await new Promise(resolve => setTimeout(resolve, 6000)); // Resolve animation duration

          if (cancelledRef.current) {
            actionInFlightRef.current = false;
            return;
          }

          await supabase
            .from('river_session_state')
            .update({
              auto_last_step: 'LEVEL_COMPLETE',
              auto_updated_at: new Date().toISOString(),
            })
            .eq('id', sessionState.id);

        } catch (error) {
          console.error('[AutoController] Error resolving level:', error);
        } finally {
          actionInFlightRef.current = false;
        }
        return;
      }
    };

    // Run step with debounce
    const timeoutId = setTimeout(runStep, 500);
    return () => clearTimeout(timeoutId);

  }, [
    sessionState?.auto_mode,
    sessionState?.danger_raw,
    sessionState?.status,
    sessionState?.auto_countdown_active,
    sessionState?.auto_countdown_ends_at,
    sessionState?.auto_last_step,
    sessionState?.manche_active,
    sessionState?.niveau_active,
    decisions,
    players,
    enBateauCount,
    sessionGameId,
  ]);

  // Reset cancelled flag when auto mode is enabled
  useEffect(() => {
    if (sessionState?.auto_mode) {
      cancelledRef.current = false;
    }
  }, [sessionState?.auto_mode]);

  return {
    state: {
      autoMode: sessionState?.auto_mode ?? false,
      countdownActive: sessionState?.auto_countdown_active ?? false,
      countdownEndsAt: sessionState?.auto_countdown_ends_at 
        ? new Date(sessionState.auto_countdown_ends_at) 
        : null,
      currentStep: sessionState?.auto_last_step ?? null,
      remainingSeconds,
    },
    toggleAutoMode,
    isActionInFlight: actionInFlightRef.current,
  };
}
