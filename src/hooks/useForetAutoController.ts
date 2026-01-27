import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SessionGameState {
  id: string;
  game_type_code: string;
  manche_active: number;
  phase: string | null;
  status: string;
  auto_mode: boolean;
  auto_countdown_type: string | null;
  auto_countdown_ends_at: string | null;
  auto_last_step: string | null;
}

interface Player {
  id: string;
  player_number: number;
  display_name: string;
  jetons: number;
  is_bot: boolean;
}

interface AutoControllerState {
  autoMode: boolean;
  countdownType: string | null;
  countdownEndsAt: Date | null;
  currentStep: string | null;
  remainingSeconds: number;
}

interface UseForetAutoControllerResult {
  state: AutoControllerState;
  toggleAutoMode: () => Promise<void>;
  isActionInFlight: boolean;
}

// Countdown durations
const PHASE_COUNTDOWN_MS = 30000; // 30 seconds for bets, actions, shop
const POSITIONS_WAIT_MS = 15000; // 15 seconds after positions published

export function useForetAutoController(
  gameId: string,
  sessionGameId: string | null,
  callbacks?: {
    onPriorityAnimationComplete?: () => void;
    onPositionsAnimationComplete?: () => void;
    onCombatResolutionAnimationComplete?: () => void;
    onShopResolutionAnimationComplete?: () => void;
  }
): UseForetAutoControllerResult {
  const [sessionState, setSessionState] = useState<SessionGameState | null>(null);
  const [gamePhase, setGamePhase] = useState<string>('PHASE1_MISES');
  const [players, setPlayers] = useState<Player[]>([]);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  
  const actionInFlightRef = useRef(false);
  const cancelledRef = useRef(false);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch initial data
  const fetchData = useCallback(async () => {
    if (!sessionGameId) return;

    const [sessionResult, gameResult, playersResult] = await Promise.all([
      supabase
        .from('session_games')
        .select('id, game_type_code, manche_active, phase, status, auto_mode, auto_countdown_type, auto_countdown_ends_at, auto_last_step')
        .eq('id', sessionGameId)
        .single(),
      supabase
        .from('games')
        .select('phase, manche_active')
        .eq('id', gameId)
        .single(),
      supabase
        .from('game_players')
        .select('id, player_number, display_name, jetons, is_bot')
        .eq('game_id', gameId)
        .eq('status', 'ACTIVE')
        .eq('is_host', false),
    ]);

    if (sessionResult.data) {
      setSessionState(sessionResult.data as SessionGameState);
    }
    if (gameResult.data) {
      setGamePhase(gameResult.data.phase);
    }
    if (playersResult.data) {
      setPlayers(playersResult.data);
    }
  }, [gameId, sessionGameId]);

  // Setup realtime subscriptions
  useEffect(() => {
    if (!sessionGameId) return;
    
    fetchData();

    const channel = supabase
      .channel(`foret-auto-controller-${sessionGameId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'session_games', 
        filter: `id=eq.${sessionGameId}` 
      }, (payload) => {
        if (payload.new) {
          setSessionState(payload.new as SessionGameState);
        }
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'games', 
        filter: `id=eq.${gameId}` 
      }, (payload) => {
        if (payload.new) {
          const newGame = payload.new as { phase: string; manche_active: number };
          setGamePhase(newGame.phase);
        }
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'round_bets', 
        filter: `game_id=eq.${gameId}` 
      }, () => fetchData())
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'actions', 
        filter: `game_id=eq.${gameId}` 
      }, () => fetchData())
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'shop_requests', 
        filter: `game_id=eq.${gameId}` 
      }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionGameId, gameId, fetchData]);

  // Countdown timer
  useEffect(() => {
    if (!sessionState?.auto_countdown_ends_at) {
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
  }, [sessionState?.auto_countdown_ends_at]);

  // Toggle auto mode
  const toggleAutoMode = useCallback(async () => {
    if (!sessionGameId) return;

    const newAutoMode = !sessionState?.auto_mode;

    await supabase
      .from('session_games')
      .update({
        auto_mode: newAutoMode,
        auto_countdown_type: newAutoMode ? sessionState?.auto_countdown_type : null,
        auto_countdown_ends_at: newAutoMode ? sessionState?.auto_countdown_ends_at : null,
        auto_last_step: newAutoMode ? 'ENABLED' : null,
        auto_updated_at: new Date().toISOString(),
      })
      .eq('id', sessionGameId);

    if (!newAutoMode) {
      cancelledRef.current = true;
    } else {
      cancelledRef.current = false;
    }
  }, [sessionGameId, sessionState]);

  // Helper: Start countdown
  const startCountdown = useCallback(async (type: string, durationMs: number) => {
    if (!sessionGameId) return;
    
    const endsAt = new Date(Date.now() + durationMs).toISOString();
    
    await supabase
      .from('session_games')
      .update({
        auto_countdown_type: type,
        auto_countdown_ends_at: endsAt,
        auto_last_step: `COUNTDOWN_${type}`,
        auto_updated_at: new Date().toISOString(),
      })
      .eq('id', sessionGameId);
  }, [sessionGameId]);

  // Helper: Clear countdown
  const clearCountdown = useCallback(async () => {
    if (!sessionGameId) return;
    
    await supabase
      .from('session_games')
      .update({
        auto_countdown_type: null,
        auto_countdown_ends_at: null,
        auto_updated_at: new Date().toISOString(),
      })
      .eq('id', sessionGameId);
  }, [sessionGameId]);

  // Helper: Update last step
  const updateLastStep = useCallback(async (step: string) => {
    if (!sessionGameId) return;
    
    await supabase
      .from('session_games')
      .update({
        auto_last_step: step,
        auto_updated_at: new Date().toISOString(),
      })
      .eq('id', sessionGameId);
  }, [sessionGameId]);

  // Check validation counts
  const getValidationCounts = useCallback(async (phase: string, manche: number) => {
    const humanPlayers = players.filter(p => !p.is_bot);
    const totalHumans = humanPlayers.length;
    const majorityThreshold = Math.ceil(totalHumans / 2);

    let validatedCount = 0;

    if (phase === 'PHASE1_MISES') {
      const { data: bets } = await supabase
        .from('round_bets')
        .select('num_joueur, status')
        .eq('game_id', gameId)
        .eq('manche', manche)
        .in('status', ['SUBMITTED', 'LOCKED']);
      
      const betPlayerNums = new Set((bets || []).map(b => b.num_joueur));
      validatedCount = humanPlayers.filter(p => betPlayerNums.has(p.player_number)).length;
    } else if (phase === 'PHASE2_POSITIONS') {
      const { data: actions } = await supabase
        .from('actions')
        .select('num_joueur')
        .eq('game_id', gameId)
        .eq('manche', manche);
      
      const actionPlayerNums = new Set((actions || []).map(a => a.num_joueur));
      validatedCount = humanPlayers.filter(p => actionPlayerNums.has(p.player_number)).length;
    } else if (phase === 'PHASE3_SHOP') {
      const { data: requests } = await supabase
        .from('shop_requests')
        .select('player_num')
        .eq('game_id', gameId)
        .eq('manche', manche);
      
      const requestPlayerNums = new Set((requests || []).map(r => r.player_num));
      validatedCount = humanPlayers.filter(p => requestPlayerNums.has(p.player_number)).length;
    }

    return {
      totalHumans,
      validatedCount,
      majorityThreshold,
      majorityReached: validatedCount >= majorityThreshold,
      allValidated: validatedCount >= totalHumans,
    };
  }, [gameId, players]);

  // FSM Stepper - Main automation logic
  useEffect(() => {
    if (!sessionState?.auto_mode || actionInFlightRef.current || cancelledRef.current || !sessionGameId) {
      return;
    }

    const runStep = async () => {
      if (cancelledRef.current || !sessionState.auto_mode) return;

      const manche = sessionState.manche_active;
      const countdownType = sessionState.auto_countdown_type;
      const countdownEndsAt = sessionState.auto_countdown_ends_at;
      const now = Date.now();
      const countdownExpired = countdownEndsAt && now >= new Date(countdownEndsAt).getTime();

      // PHASE 1: BETS
      if (gamePhase === 'PHASE1_MISES') {
        const { majorityReached, allValidated, totalHumans } = await getValidationCounts('PHASE1_MISES', manche);

        // Start countdown if majority reached and no countdown active
        if (majorityReached && !countdownType && totalHumans > 0) {
          console.log('[ForetAutoController] BETS: Majority reached, starting countdown');
          actionInFlightRef.current = true;
          await startCountdown('BETS', PHASE_COUNTDOWN_MS);
          actionInFlightRef.current = false;
          return;
        }

        // Close bets if all validated or countdown expired
        if (allValidated || (countdownType === 'BETS' && countdownExpired)) {
          console.log('[ForetAutoController] BETS: Closing bets');
          actionInFlightRef.current = true;

          try {
            await clearCountdown();
            await updateLastStep('CLOSING_BETS');

            // Call close-phase1-bets edge function
            const { error } = await supabase.functions.invoke('close-phase1-bets', {
              body: { gameId },
            });

            if (error) {
              console.error('[ForetAutoController] Error closing bets:', error);
            } else {
              await updateLastStep('BETS_CLOSED');
              // Wait for priority animation (fallback timeout)
              await new Promise(resolve => setTimeout(resolve, 3000));
            }
          } catch (error) {
            console.error('[ForetAutoController] Error in BETS phase:', error);
          } finally {
            actionInFlightRef.current = false;
          }
          return;
        }

        // Full bot game - skip countdown, close immediately
        if (totalHumans === 0) {
          console.log('[ForetAutoController] BETS: Full bot game, closing immediately');
          actionInFlightRef.current = true;

          try {
            await updateLastStep('CLOSING_BETS');
            const { error } = await supabase.functions.invoke('close-phase1-bets', {
              body: { gameId },
            });
            if (!error) {
              await updateLastStep('BETS_CLOSED');
              await new Promise(resolve => setTimeout(resolve, 3000));
            }
          } catch (error) {
            console.error('[ForetAutoController] Error in BETS (bot game):', error);
          } finally {
            actionInFlightRef.current = false;
          }
          return;
        }
      }

      // PHASE 2: COMBAT ACTIONS
      if (gamePhase === 'PHASE2_POSITIONS') {
        const { majorityReached, allValidated, totalHumans } = await getValidationCounts('PHASE2_POSITIONS', manche);

        // Start countdown if majority reached
        if (majorityReached && countdownType !== 'COMBAT_SUBMIT' && countdownType !== 'COMBAT_POSITIONS_WAIT' && totalHumans > 0) {
          console.log('[ForetAutoController] COMBAT: Majority reached, starting countdown');
          actionInFlightRef.current = true;
          await startCountdown('COMBAT_SUBMIT', PHASE_COUNTDOWN_MS);
          actionInFlightRef.current = false;
          return;
        }

        // Publish positions if all validated or countdown expired
        if ((allValidated || (countdownType === 'COMBAT_SUBMIT' && countdownExpired)) && countdownType !== 'COMBAT_POSITIONS_WAIT') {
          console.log('[ForetAutoController] COMBAT: Publishing positions');
          actionInFlightRef.current = true;

          try {
            await clearCountdown();
            await updateLastStep('PUBLISHING_POSITIONS');

            // Call publish-positions edge function
            const { error } = await supabase.functions.invoke('publish-positions', {
              body: { gameId },
            });

            if (error) {
              console.error('[ForetAutoController] Error publishing positions:', error);
            } else {
              await updateLastStep('POSITIONS_PUBLISHED');
              // Wait for positions animation
              await new Promise(resolve => setTimeout(resolve, 3000));
              // Start 15s countdown before combat resolution
              await startCountdown('COMBAT_POSITIONS_WAIT', POSITIONS_WAIT_MS);
            }
          } catch (error) {
            console.error('[ForetAutoController] Error publishing positions:', error);
          } finally {
            actionInFlightRef.current = false;
          }
          return;
        }

        // Resolve combat after positions wait countdown
        if (countdownType === 'COMBAT_POSITIONS_WAIT' && countdownExpired) {
          console.log('[ForetAutoController] COMBAT: Resolving combat');
          actionInFlightRef.current = true;

          try {
            await clearCountdown();
            await updateLastStep('RESOLVING_COMBAT');

            const { error } = await supabase.functions.invoke('resolve-combat', {
              body: { gameId },
            });

            if (error) {
              console.error('[ForetAutoController] Error resolving combat:', error);
            } else {
              await updateLastStep('COMBAT_RESOLVED');
              // Wait for combat resolution animation
              await new Promise(resolve => setTimeout(resolve, 5000));
            }
          } catch (error) {
            console.error('[ForetAutoController] Error resolving combat:', error);
          } finally {
            actionInFlightRef.current = false;
          }
          return;
        }

        // Full bot game
        if (totalHumans === 0 && countdownType !== 'COMBAT_POSITIONS_WAIT') {
          console.log('[ForetAutoController] COMBAT: Full bot game, publishing positions');
          actionInFlightRef.current = true;

          try {
            await updateLastStep('PUBLISHING_POSITIONS');
            const { error } = await supabase.functions.invoke('publish-positions', {
              body: { gameId },
            });
            if (!error) {
              await updateLastStep('POSITIONS_PUBLISHED');
              await new Promise(resolve => setTimeout(resolve, 3000));
              await startCountdown('COMBAT_POSITIONS_WAIT', POSITIONS_WAIT_MS);
            }
          } catch (error) {
            console.error('[ForetAutoController] Error in COMBAT (bot game):', error);
          } finally {
            actionInFlightRef.current = false;
          }
          return;
        }
      }

      // PHASE 3: SHOP
      if (gamePhase === 'PHASE3_SHOP') {
        const { majorityReached, allValidated, totalHumans } = await getValidationCounts('PHASE3_SHOP', manche);

        // Start countdown if majority reached
        if (majorityReached && !countdownType && totalHumans > 0) {
          console.log('[ForetAutoController] SHOP: Majority reached, starting countdown');
          actionInFlightRef.current = true;
          await startCountdown('SHOP', PHASE_COUNTDOWN_MS);
          actionInFlightRef.current = false;
          return;
        }

        // Resolve shop if all validated or countdown expired
        if (allValidated || (countdownType === 'SHOP' && countdownExpired)) {
          console.log('[ForetAutoController] SHOP: Resolving shop');
          actionInFlightRef.current = true;

          try {
            await clearCountdown();
            await updateLastStep('RESOLVING_SHOP');

            const { error } = await supabase.functions.invoke('resolve-shop', {
              body: { gameId },
            });

            if (error) {
              console.error('[ForetAutoController] Error resolving shop:', error);
            } else {
              await updateLastStep('SHOP_RESOLVED');
              // Wait for shop animation
              await new Promise(resolve => setTimeout(resolve, 3000));
              
              // Advance to next round
              await updateLastStep('ADVANCING_ROUND');
              await supabase.functions.invoke('manage-phase', {
                body: { gameId, action: 'next_round' },
              });
              await updateLastStep('ROUND_ADVANCED');
            }
          } catch (error) {
            console.error('[ForetAutoController] Error resolving shop:', error);
          } finally {
            actionInFlightRef.current = false;
          }
          return;
        }

        // Full bot game
        if (totalHumans === 0) {
          console.log('[ForetAutoController] SHOP: Full bot game, resolving immediately');
          actionInFlightRef.current = true;

          try {
            await updateLastStep('RESOLVING_SHOP');
            const { error } = await supabase.functions.invoke('resolve-shop', {
              body: { gameId },
            });
            if (!error) {
              await updateLastStep('SHOP_RESOLVED');
              await new Promise(resolve => setTimeout(resolve, 3000));
              await supabase.functions.invoke('manage-phase', {
                body: { gameId, action: 'next_round' },
              });
              await updateLastStep('ROUND_ADVANCED');
            }
          } catch (error) {
            console.error('[ForetAutoController] Error in SHOP (bot game):', error);
          } finally {
            actionInFlightRef.current = false;
          }
          return;
        }
      }
    };

    // Run step with debounce
    const timeoutId = setTimeout(runStep, 500);
    return () => clearTimeout(timeoutId);

  }, [
    sessionState?.auto_mode,
    sessionState?.auto_countdown_type,
    sessionState?.auto_countdown_ends_at,
    sessionState?.auto_last_step,
    sessionState?.manche_active,
    gamePhase,
    sessionGameId,
    gameId,
    players,
    getValidationCounts,
    startCountdown,
    clearCountdown,
    updateLastStep,
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
      countdownType: sessionState?.auto_countdown_type ?? null,
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
