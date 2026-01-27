import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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
  auto_runner_user_id: string | null;
  auto_runner_lease_until: string | null;
  auto_fail_set_danger: number;
  auto_fail_bot_decisions: number;
  auto_fail_lock: number;
  auto_fail_resolve: number;
  auto_last_error: string | null;
  auto_waiting_for: string | null;
  auto_anim_ack_at: string | null;
}

interface RiverDecision {
  id: string;
  player_id: string;
  player_num: number;
  decision: string | null;
  status: string;
  manche: number;
  niveau: number;
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
  isRunner: boolean;
  runnerStatus: 'YOU' | 'OTHER' | 'NONE';
  lastError: string | null;
  failCounts: {
    setDanger: number;
    botDecisions: number;
    lock: number;
    resolve: number;
  };
  isAuthenticated: boolean;
}

interface UseRivieresAutoControllerResult {
  state: AutoControllerState;
  toggleAutoMode: () => Promise<void>;
  resetFailCounters: () => Promise<void>;
  isActionInFlight: boolean;
}

const COUNTDOWN_DURATION_MS = 15000; // 15 seconds
const LEASE_DURATION_MS = 20000; // 20 seconds
const LEASE_RENEW_INTERVAL_MS = 10000; // 10 seconds
const MAX_FAIL_COUNT = 5;
const ANIMATION_ACK_TIMEOUT_MS = 20000; // 20 seconds fallback

export function useRivieresAutoController(
  gameId: string,
  sessionGameId: string
): UseRivieresAutoControllerResult {
  const [sessionState, setSessionState] = useState<RiverSessionState | null>(null);
  const [decisions, setDecisions] = useState<RiverDecision[]>([]);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [enBateauCount, setEnBateauCount] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  const actionInFlightRef = useRef(false);
  const cancelledRef = useRef(false);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const leaseRenewIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const animAckResolverRef = useRef<(() => void) | null>(null);

  // Get current user - use onAuthStateChange for reliable tracking
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data }) => {
      setCurrentUserId(data.session?.user?.id ?? null);
    });
    
    // Subscribe to auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUserId(session?.user?.id ?? null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

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
        .select('id, player_id, player_num, decision, status, manche, niveau')
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

  // Setup realtime subscriptions with animation ACK detection
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
          const newState = payload.new as RiverSessionState;
          setSessionState(newState);
          
          // Check for animation ACK via realtime instead of polling
          if (newState.auto_anim_ack_at && animAckResolverRef.current) {
            animAckResolverRef.current();
            animAckResolverRef.current = null;
          }
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

  // Countdown timer - reduced interval to 250ms for less CPU usage
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
    countdownTimerRef.current = setInterval(updateCountdown, 250);

    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    };
  }, [sessionState?.auto_countdown_active, sessionState?.auto_countdown_ends_at]);

  // Determine if current user is the runner
  const isRunner = useCallback(() => {
    if (!sessionState || !currentUserId) return false;
    if (!sessionState.auto_runner_user_id) return false;
    if (sessionState.auto_runner_user_id !== currentUserId) return false;
    if (!sessionState.auto_runner_lease_until) return false;
    return new Date(sessionState.auto_runner_lease_until).getTime() > Date.now();
  }, [sessionState, currentUserId]);

  const getRunnerStatus = useCallback((): 'YOU' | 'OTHER' | 'NONE' => {
    if (!sessionState) return 'NONE';
    if (!sessionState.auto_runner_user_id || !sessionState.auto_runner_lease_until) return 'NONE';
    if (new Date(sessionState.auto_runner_lease_until).getTime() <= Date.now()) return 'NONE';
    if (sessionState.auto_runner_user_id === currentUserId) return 'YOU';
    return 'OTHER';
  }, [sessionState, currentUserId]);

  // Acquire lease using atomic RPC
  const acquireLease = useCallback(async (): Promise<boolean> => {
    if (!sessionState || !currentUserId) return false;

    const { data, error } = await supabase.rpc('acquire_river_auto_lease', {
      p_session_id: sessionState.id,
      p_user_id: currentUserId,
      p_lease_ms: LEASE_DURATION_MS,
    });

    if (error) {
      console.error('[AutoController] Error acquiring lease:', error);
      return false;
    }

    return data === true;
  }, [sessionState, currentUserId]);

  // Release lease using atomic RPC
  const releaseLease = useCallback(async () => {
    if (!sessionState || !currentUserId) return;

    await supabase.rpc('release_river_auto_lease', {
      p_session_id: sessionState.id,
      p_user_id: currentUserId,
    });
  }, [sessionState, currentUserId]);

  // Renew lease periodically using RPC
  useEffect(() => {
    if (!sessionState?.auto_mode || !isRunner()) {
      if (leaseRenewIntervalRef.current) {
        clearInterval(leaseRenewIntervalRef.current);
        leaseRenewIntervalRef.current = null;
      }
      return;
    }

    const renewLease = async () => {
      if (!sessionState || !currentUserId) return;
      await supabase.rpc('acquire_river_auto_lease', {
        p_session_id: sessionState.id,
        p_user_id: currentUserId,
        p_lease_ms: LEASE_DURATION_MS,
      });
    };

    leaseRenewIntervalRef.current = setInterval(renewLease, LEASE_RENEW_INTERVAL_MS);

    return () => {
      if (leaseRenewIntervalRef.current) {
        clearInterval(leaseRenewIntervalRef.current);
        leaseRenewIntervalRef.current = null;
      }
    };
  }, [sessionState?.auto_mode, sessionState?.id, currentUserId, isRunner]);

  // Toggle auto mode
  const toggleAutoMode = useCallback(async () => {
    if (!sessionState) return;

    const newAutoMode = !sessionState.auto_mode;

    if (newAutoMode) {
      // Check if user is authenticated before activating
      if (!currentUserId) {
        toast.error("Connexion requise", {
          description: "Connecte-toi avec ton compte pour activer le mode auto (auth.uid manquant).",
          duration: 5000,
        });
        console.warn('[AutoController] Cannot activate auto mode - currentUserId is null');
        return;
      }
      
      // Activating - try to acquire lease atomically
      const acquired = await acquireLease();
      if (!acquired) {
        toast.warning("Mode Auto déjà actif", {
          description: "Un autre MJ pilote actuellement le mode automatique.",
        });
        console.warn('[AutoController] Could not acquire lease - another MJ is running');
        return;
      }
      cancelledRef.current = false;
    } else {
      // Deactivating - release lease
      await releaseLease();
      cancelledRef.current = true;
    }

    await supabase
      .from('river_session_state')
      .update({
        auto_mode: newAutoMode,
        auto_countdown_active: newAutoMode ? sessionState.auto_countdown_active : false,
        auto_countdown_ends_at: newAutoMode ? sessionState.auto_countdown_ends_at : null,
        auto_last_step: newAutoMode ? 'ENABLED' : null,
        auto_updated_at: new Date().toISOString(),
        auto_waiting_for: null,
        auto_anim_ack_at: null,
      })
      .eq('id', sessionState.id);
  }, [sessionState, acquireLease, releaseLease]);

  // Reset fail counters
  const resetFailCounters = useCallback(async () => {
    if (!sessionState) return;
    
    // Check if user is authenticated
    if (!currentUserId) {
      toast.error("Connexion requise", {
        description: "Connecte-toi avec ton compte pour cette action.",
      });
      return;
    }

    await supabase
      .from('river_session_state')
      .update({
        auto_fail_set_danger: 0,
        auto_fail_bot_decisions: 0,
        auto_fail_lock: 0,
        auto_fail_resolve: 0,
        auto_last_error: null,
        auto_last_step: sessionState.auto_mode ? 'ENABLED' : null,
      })
      .eq('id', sessionState.id);
  }, [sessionState]);

  // Handle action failure with backoff
  const handleActionFailure = useCallback(async (
    actionType: 'set_danger' | 'bot_decisions' | 'lock' | 'resolve',
    error: any
  ): Promise<number> => {
    if (!sessionState) return 0;

    const fieldMap = {
      set_danger: 'auto_fail_set_danger',
      bot_decisions: 'auto_fail_bot_decisions',
      lock: 'auto_fail_lock',
      resolve: 'auto_fail_resolve',
    };

    const currentCount = sessionState[fieldMap[actionType] as keyof RiverSessionState] as number || 0;
    const newCount = currentCount + 1;

    const updates: any = {
      [fieldMap[actionType]]: newCount,
      auto_last_error: `${actionType} failed: ${error?.message || 'Unknown error'}`,
    };

    // Stop auto mode if max failures reached
    if (newCount >= MAX_FAIL_COUNT) {
      updates.auto_mode = false;
      updates.auto_countdown_active = false;
      updates.auto_countdown_ends_at = null;
      updates.auto_last_step = 'STOPPED_MAX_FAILURES';
      updates.auto_runner_user_id = null;
      updates.auto_runner_lease_until = null;
      cancelledRef.current = true;
      console.error(`[AutoController] Stopping auto mode after ${newCount} failures on ${actionType}`);
    }

    await supabase
      .from('river_session_state')
      .update(updates)
      .eq('id', sessionState.id);

    // Calculate backoff delay
    return Math.min(20000, 1000 * Math.pow(2, newCount));
  }, [sessionState]);

  // Reset fail counter on success
  const handleActionSuccess = useCallback(async (
    actionType: 'set_danger' | 'bot_decisions' | 'lock' | 'resolve'
  ) => {
    if (!sessionState) return;

    const fieldMap = {
      set_danger: 'auto_fail_set_danger',
      bot_decisions: 'auto_fail_bot_decisions',
      lock: 'auto_fail_lock',
      resolve: 'auto_fail_resolve',
    };

    const currentCount = sessionState[fieldMap[actionType] as keyof RiverSessionState] as number || 0;
    if (currentCount > 0) {
      await supabase
        .from('river_session_state')
        .update({ [fieldMap[actionType]]: 0 })
        .eq('id', sessionState.id);
    }
  }, [sessionState]);

  // Wait for animation ACK using realtime subscription (not polling)
  const waitForAnimationAck = useCallback(async (waitType: 'LOCK_ANIM' | 'RESOLVE_ANIM'): Promise<boolean> => {
    if (!sessionState) return false;

    // Set waiting state
    await supabase
      .from('river_session_state')
      .update({
        auto_waiting_for: waitType,
        auto_anim_ack_at: null,
      })
      .eq('id', sessionState.id);

    // Wait for ACK via realtime subscription or timeout
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        animAckResolverRef.current = null;
        
        // Timeout - stop auto mode
        console.error(`[AutoController] Animation ACK timeout for ${waitType}`);
        supabase
          .from('river_session_state')
          .update({
            auto_mode: false,
            auto_waiting_for: null,
            auto_last_step: 'STOPPED_ANIM_TIMEOUT',
            auto_last_error: `Animation ${waitType} did not complete in time`,
            auto_runner_user_id: null,
            auto_runner_lease_until: null,
          })
          .eq('id', sessionState.id)
          .then(() => {
            cancelledRef.current = true;
            resolve(false);
          });
      }, ANIMATION_ACK_TIMEOUT_MS);

      animAckResolverRef.current = () => {
        clearTimeout(timeoutId);
        supabase
          .from('river_session_state')
          .update({ auto_waiting_for: null })
          .eq('id', sessionState.id)
          .then(() => resolve(true));
      };
    });
  }, [sessionState]);

  // Idempotence check: verify if level was already resolved
  const isLevelAlreadyResolved = useCallback(async (): Promise<boolean> => {
    if (!sessionState) return false;
    
    const { data } = await supabase
      .from('river_level_history')
      .select('id')
      .eq('session_game_id', sessionGameId)
      .eq('manche', sessionState.manche_active)
      .eq('niveau', sessionState.niveau_active)
      .limit(1);
    
    return (data?.length ?? 0) > 0;
  }, [sessionState, sessionGameId]);

  // Idempotence check: verify if all decisions are locked
  const areAllDecisionsLocked = useCallback(async (): Promise<boolean> => {
    if (!sessionState) return false;
    
    const { data } = await supabase
      .from('river_decisions')
      .select('id')
      .eq('session_game_id', sessionGameId)
      .eq('manche', sessionState.manche_active)
      .eq('niveau', sessionState.niveau_active)
      .eq('status', 'DRAFT');
    
    // If there are no DRAFT decisions, all are locked
    return (data?.length ?? 0) === 0;
  }, [sessionState, sessionGameId]);

  // FSM Stepper - Main automation logic
  useEffect(() => {
    if (!sessionState?.auto_mode || actionInFlightRef.current || cancelledRef.current) {
      return;
    }

    // Only the runner should execute actions
    if (!isRunner()) {
      return;
    }

    const runStep = async () => {
      if (cancelledRef.current || !sessionState.auto_mode || !isRunner()) return;

      const currentManche = sessionState.manche_active;
      const currentNiveau = sessionState.niveau_active;

      // Filter decisions for current level with REAL decisions (not just placeholder DRAFT)
      // A real decision must have an actual decision value (RESTE or DESCENDS), not just a row
      const currentDecisions = decisions.filter(
        d => d.manche === currentManche && 
             d.niveau === currentNiveau &&
             (d.status === 'DRAFT' || d.status === 'LOCKED') &&
             d.decision !== null // Must have an actual decision value
      );
      const lockedDecisions = currentDecisions.filter(d => d.status === 'LOCKED');
      const allLocked = lockedDecisions.length > 0 && lockedDecisions.length >= enBateauCount;

      // Get human/bot players using is_bot field (NOT display_name)
      const botPlayers = players.filter(p => p.is_bot === true);
      const humanPlayers = players.filter(p => p.is_bot !== true);
      
      // Get human decisions (with real decision value)
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

          const { error } = await supabase.functions.invoke('rivieres-set-danger', {
            body: { 
              session_game_id: sessionGameId, 
              mode: 'MANUAL', 
              danger_value: suggestedDanger 
            },
          });

          if (error) throw error;

          await handleActionSuccess('set_danger');
          await supabase
            .from('river_session_state')
            .update({ 
              auto_last_step: 'DANGER_SET',
              auto_updated_at: new Date().toISOString(),
            })
            .eq('id', sessionState.id);

        } catch (error) {
          console.error('[AutoController] Error setting danger:', error);
          const backoff = await handleActionFailure('set_danger', error);
          if (backoff > 0 && !cancelledRef.current) {
            await new Promise(resolve => setTimeout(resolve, backoff));
          }
        } finally {
          actionInFlightRef.current = false;
        }
        return;
      }

      // S2: WAIT_DECISIONS - Validate bot decisions if needed
      if (sessionState.danger_raw !== null && !allLocked && sessionState.status === 'RUNNING') {
        // First, ensure bots have made decisions
        const botDecisions = currentDecisions.filter(d => 
          botPlayers.some(bp => bp.id === d.player_id)
        );

        if (botDecisions.length < botPlayers.length && botPlayers.length > 0) {
          console.log('[AutoController] Step: BOT_DECISIONS');
          actionInFlightRef.current = true;

          try {
            const { error } = await supabase.functions.invoke('rivieres-bot-decisions', {
              body: { session_game_id: sessionGameId },
            });

            if (error) throw error;

            await handleActionSuccess('bot_decisions');
            await supabase
              .from('river_session_state')
              .update({ 
                auto_last_step: 'BOTS_VALIDATED',
                auto_updated_at: new Date().toISOString(),
              })
              .eq('id', sessionState.id);

          } catch (error) {
            console.error('[AutoController] Error with bot decisions:', error);
            const backoff = await handleActionFailure('bot_decisions', error);
            if (backoff > 0 && !cancelledRef.current) {
              await new Promise(resolve => setTimeout(resolve, backoff));
            }
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
          // Idempotence check before locking
          const alreadyLocked = await areAllDecisionsLocked();
          if (alreadyLocked) {
            console.log('[AutoController] Decisions already locked, skipping');
            return;
          }

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

            const { error } = await supabase.functions.invoke('rivieres-lock-decisions', {
              body: { session_game_id: sessionGameId },
            });

            if (error) throw error;
            await handleActionSuccess('lock');

          } catch (error) {
            console.error('[AutoController] Error locking decisions:', error);
            const backoff = await handleActionFailure('lock', error);
            if (backoff > 0 && !cancelledRef.current) {
              await new Promise(resolve => setTimeout(resolve, backoff));
            }
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
            // Idempotence check before locking
            const alreadyLocked = await areAllDecisionsLocked();
            if (alreadyLocked) {
              console.log('[AutoController] Decisions already locked, skipping');
              await supabase
                .from('river_session_state')
                .update({
                  auto_countdown_active: false,
                  auto_countdown_ends_at: null,
                })
                .eq('id', sessionState.id);
              return;
            }

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

              const { data, error } = await supabase.functions.invoke('rivieres-lock-decisions', {
                body: { session_game_id: sessionGameId },
              });

              if (error) throw error;

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

              await handleActionSuccess('lock');

            } catch (error) {
              console.error('[AutoController] Error locking decisions:', error);
              const backoff = await handleActionFailure('lock', error);
              if (backoff > 0 && !cancelledRef.current) {
                await new Promise(resolve => setTimeout(resolve, backoff));
              }
            } finally {
              actionInFlightRef.current = false;
            }
            return;
          }
        }

        // Full bot game - no countdown needed, lock immediately when all bots decided
        if (humanPlayers.length === 0 && botDecisions.length >= botPlayers.length && botPlayers.length > 0) {
          console.log('[AutoController] Step: FULL_BOT_GAME - Immediate lock');
          actionInFlightRef.current = true;

          // Safety throttle: 1 cycle per second max for 100% bot games
          await new Promise(resolve => setTimeout(resolve, 1000));

          try {
            await supabase
              .from('river_session_state')
              .update({
                auto_last_step: 'LOCKING',
                auto_updated_at: new Date().toISOString(),
              })
              .eq('id', sessionState.id);

            const { error } = await supabase.functions.invoke('rivieres-lock-decisions', {
              body: { session_game_id: sessionGameId },
            });

            if (error) throw error;
            await handleActionSuccess('lock');

          } catch (error) {
            console.error('[AutoController] Error locking decisions:', error);
            const backoff = await handleActionFailure('lock', error);
            if (backoff > 0 && !cancelledRef.current) {
              await new Promise(resolve => setTimeout(resolve, backoff));
            }
          } finally {
            actionInFlightRef.current = false;
          }
          return;
        }
      }

      // S4: LOCKED_WAIT_ANIM - All locked, wait for lock animation then resolve
      if (allLocked && sessionState.auto_last_step !== 'RESOLVING' && sessionState.status === 'RUNNING') {
        // Idempotence check: don't resolve if already resolved
        const alreadyResolved = await isLevelAlreadyResolved();
        if (alreadyResolved) {
          console.log('[AutoController] Level already resolved, skipping');
          await supabase
            .from('river_session_state')
            .update({ auto_last_step: 'LEVEL_COMPLETE' })
            .eq('id', sessionState.id);
          return;
        }

        console.log('[AutoController] Step: LOCKED_WAIT_ANIM - Waiting for animation ACK');
        actionInFlightRef.current = true;

        try {
          // Wait for lock animation ACK
          const lockAckReceived = await waitForAnimationAck('LOCK_ANIM');
          
          if (!lockAckReceived || cancelledRef.current) {
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

          const { error } = await supabase.functions.invoke('rivieres-resolve-level', {
            body: { session_game_id: sessionGameId },
          });

          if (error) throw error;
          await handleActionSuccess('resolve');

          // Wait for resolve animation ACK
          const resolveAckReceived = await waitForAnimationAck('RESOLVE_ANIM');

          if (!resolveAckReceived || cancelledRef.current) {
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
          const backoff = await handleActionFailure('resolve', error);
          if (backoff > 0 && !cancelledRef.current) {
            await new Promise(resolve => setTimeout(resolve, backoff));
          }
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
    isRunner,
    handleActionFailure,
    handleActionSuccess,
    waitForAnimationAck,
    areAllDecisionsLocked,
    isLevelAlreadyResolved,
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
      isRunner: isRunner(),
      runnerStatus: getRunnerStatus(),
      lastError: sessionState?.auto_last_error ?? null,
      failCounts: {
        setDanger: sessionState?.auto_fail_set_danger ?? 0,
        botDecisions: sessionState?.auto_fail_bot_decisions ?? 0,
        lock: sessionState?.auto_fail_lock ?? 0,
        resolve: sessionState?.auto_fail_resolve ?? 0,
      },
      isAuthenticated: currentUserId !== null,
    },
    toggleAutoMode,
    resetFailCounters,
    isActionInFlight: actionInFlightRef.current,
  };
}
