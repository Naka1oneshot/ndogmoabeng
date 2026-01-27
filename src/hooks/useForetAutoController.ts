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

// Default weapon for combat
const DEFAULT_WEAPON = 'ARME_PERMANENTE';

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

  // Generate default bets for players who haven't submitted
  const generateDefaultBets = useCallback(async (manche: number) => {
    if (!sessionGameId) return;

    const humanPlayers = players.filter(p => !p.is_bot);
    
    // Get existing bets
    const { data: existingBets } = await supabase
      .from('round_bets')
      .select('num_joueur')
      .eq('game_id', gameId)
      .eq('manche', manche)
      .in('status', ['SUBMITTED', 'LOCKED']);
    
    const bettedPlayerNums = new Set((existingBets || []).map(b => b.num_joueur));
    
    // Find players who haven't bet
    const playersWithoutBets = humanPlayers.filter(p => !bettedPlayerNums.has(p.player_number));
    
    if (playersWithoutBets.length === 0) {
      console.log('[ForetAutoController] All players have already bet');
      return;
    }

    console.log('[ForetAutoController] Generating default bets for', playersWithoutBets.length, 'players');
    
    // Insert default bets (5 if tokens available, else 0)
    for (const player of playersWithoutBets) {
      const defaultBet = player.jetons >= 5 ? 5 : 0;
      
      await supabase.from('round_bets').upsert({
        game_id: gameId,
        session_game_id: sessionGameId,
        manche: manche,
        num_joueur: player.player_number,
        mise: defaultBet,
        mise_demandee: defaultBet,
        status: 'SUBMITTED',
        note: 'Auto-generated default bet',
        submitted_at: new Date().toISOString(),
      }, {
        onConflict: 'game_id,manche,num_joueur',
      });
    }
    
    console.log('[ForetAutoController] Default bets generated');
  }, [gameId, sessionGameId, players]);

  // Generate default combat actions for players who haven't submitted
  const generateDefaultActions = useCallback(async (manche: number) => {
    if (!sessionGameId) return;

    const humanPlayers = players.filter(p => !p.is_bot);
    
    // Get existing actions
    const { data: existingActions } = await supabase
      .from('actions')
      .select('num_joueur')
      .eq('game_id', gameId)
      .eq('manche', manche);
    
    const actionPlayerNums = new Set((existingActions || []).map(a => a.num_joueur));
    
    // Find players who haven't submitted actions
    const playersWithoutActions = humanPlayers.filter(p => !actionPlayerNums.has(p.player_number));
    
    if (playersWithoutActions.length === 0) {
      console.log('[ForetAutoController] All players have already submitted actions');
      return;
    }

    // Get available battlefield slots (monsters in battle)
    const { data: activeMonsters } = await supabase
      .from('game_state_monsters')
      .select('battlefield_slot')
      .eq('game_id', gameId)
      .eq('session_game_id', sessionGameId)
      .eq('status', 'EN_BATAILLE')
      .not('battlefield_slot', 'is', null);
    
    const availableSlots = (activeMonsters || [])
      .map(m => m.battlefield_slot)
      .filter((s): s is number => s !== null);
    
    if (availableSlots.length === 0) {
      console.log('[ForetAutoController] No available slots for default actions');
      return;
    }

    // Valid positions (1-7 typically)
    const validPositions = [1, 2, 3, 4, 5, 6, 7];

    console.log('[ForetAutoController] Generating default actions for', playersWithoutActions.length, 'players');
    
    for (const player of playersWithoutActions) {
      // Random position and slot
      const randomPosition = validPositions[Math.floor(Math.random() * validPositions.length)];
      const randomSlot = availableSlots[Math.floor(Math.random() * availableSlots.length)];
      
      await supabase.from('actions').upsert({
        game_id: gameId,
        session_game_id: sessionGameId,
        manche: manche,
        num_joueur: player.player_number,
        position_souhaitee: randomPosition,
        slot_attaque: randomSlot,
        attaque1: DEFAULT_WEAPON,
        attaque2: null,
        protection_objet: null,
        slot_protection: null,
      }, {
        onConflict: 'game_id,manche,num_joueur',
      });
    }
    
    console.log('[ForetAutoController] Default actions generated');
  }, [gameId, sessionGameId, players]);

  // Generate default shop requests (no purchase) for players who haven't submitted
  const generateDefaultShopRequests = useCallback(async (manche: number) => {
    if (!sessionGameId) return;

    const humanPlayers = players.filter(p => !p.is_bot);
    
    // Get existing shop requests
    const { data: existingRequests } = await supabase
      .from('shop_requests')
      .select('player_num')
      .eq('game_id', gameId)
      .eq('manche', manche);
    
    const requestPlayerNums = new Set((existingRequests || []).map(r => r.player_num));
    
    // Find players who haven't submitted shop requests
    const playersWithoutRequests = humanPlayers.filter(p => !requestPlayerNums.has(p.player_number));
    
    if (playersWithoutRequests.length === 0) {
      console.log('[ForetAutoController] All players have already submitted shop requests');
      return;
    }

    console.log('[ForetAutoController] Generating default shop requests for', playersWithoutRequests.length, 'players');
    
    // Get player IDs from the full player list
    const { data: fullPlayers } = await supabase
      .from('game_players')
      .select('id, player_number')
      .eq('game_id', gameId)
      .eq('status', 'ACTIVE');
    
    const playerIdMap = new Map((fullPlayers || []).map(p => [p.player_number, p.id]));
    
    for (const player of playersWithoutRequests) {
      const playerId = playerIdMap.get(player.player_number);
      if (!playerId) continue;
      
      await supabase.from('shop_requests').upsert({
        game_id: gameId,
        session_game_id: sessionGameId,
        manche: manche,
        player_id: playerId,
        player_num: player.player_number,
        want_buy: false,
        item_name: null,
      }, {
        onConflict: 'game_id,manche,player_num',
      });
    }
    
    console.log('[ForetAutoController] Default shop requests generated');
  }, [gameId, sessionGameId, players]);

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
            await updateLastStep('GENERATING_DEFAULT_BETS');

            // Generate default bets for players who haven't submitted
            if (!allValidated) {
              await generateDefaultBets(manche);
            }

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
            await updateLastStep('GENERATING_DEFAULT_ACTIONS');

            // Generate default actions for players who haven't submitted
            if (!allValidated) {
              await generateDefaultActions(manche);
            }

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
            await updateLastStep('GENERATING_DEFAULT_SHOP');

            // Generate default shop requests for players who haven't submitted
            if (!allValidated) {
              await generateDefaultShopRequests(manche);
            }

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
    generateDefaultBets,
    generateDefaultActions,
    generateDefaultShopRequests,
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
