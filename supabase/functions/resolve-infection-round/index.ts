import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Player {
  id: string;
  player_number: number;
  display_name: string;
  role_code: string;
  team_code: string;
  jetons: number;
  pvic: number;
  is_alive: boolean;
  immune_permanent: boolean;
  is_carrier: boolean;
  is_contagious: boolean;
  infected_at_manche: number | null;
  will_contaminate_at_manche: number | null;
  will_die_at_manche: number | null;
  has_antibodies: boolean;
  clan: string | null;
  is_bot: boolean;
}

interface InfectionInput {
  player_id: string;
  player_num: number;
  ae_sabotage_target_num: number | null;
  corruption_amount: number;
  ba_shot_target_num: number | null;
  pv_shot_target_num: number | null;
  pv_antidote_target_num: number | null;
  oc_lookup_target_num: number | null;
  sy_research_target_num: number | null;
  vote_test_target_num: number | null;
  vote_suspect_pv_target_num: number | null;
  pv_patient0_target_num: number | null;
}

interface Shot {
  id: string;
  shooter_num: number;
  shooter_role: string;
  target_num: number;
  server_ts: string;
  status: string;
}

interface InventoryItem {
  id: string;
  owner_num: number;
  objet: string;
  quantite: number;
  disponible: boolean;
}

interface ResolutionLog {
  step: string;
  details: any;
  timestamp: string;
}

// Helper: Get player by number
function getPlayerByNum(players: Player[], num: number): Player | undefined {
  return players.find(p => p.player_number === num);
}

// Helper: Count votes and find winner
function countVotes(votes: (number | null)[]): { winner: number | null; counts: Record<number, number> } {
  const counts: Record<number, number> = {};
  for (const vote of votes) {
    if (vote !== null) {
      counts[vote] = (counts[vote] || 0) + 1;
    }
  }
  
  let maxCount = 0;
  let winners: number[] = [];
  for (const [num, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      winners = [parseInt(num)];
    } else if (count === maxCount) {
      winners.push(parseInt(num));
    }
  }
  
  // Tie-break: random
  const winner = winners.length > 0 ? winners[Math.floor(Math.random() * winners.length)] : null;
  return { winner, counts };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const logs: ResolutionLog[] = [];
  const publicEvents: string[] = [];
  const privateMessages: Array<{ player_num: number; message: string }> = [];
  const pvMessages: string[] = [];
  const syMessages: string[] = [];

  const addLog = (step: string, details: any) => {
    logs.push({ step, details, timestamp: new Date().toISOString() });
    console.log(`[resolve-infection] ${step}:`, JSON.stringify(details));
  };

  try {
    const { gameId, sessionGameId, manche } = await req.json();
    addLog('START', { gameId, sessionGameId, manche });

    // ========================================
    // STEP 0: Load all data
    // ========================================
    
    // Fetch round state
    const { data: roundState, error: roundError } = await supabase
      .from('infection_round_state')
      .select('*')
      .eq('session_game_id', sessionGameId)
      .eq('manche', manche)
      .single();

    if (roundError || !roundState) {
      throw new Error(`Round state not found: ${roundError?.message}`);
    }

    if (roundState.status !== 'OPEN') {
      throw new Error(`Round is not OPEN (current: ${roundState.status})`);
    }

    // Fetch players
    const { data: playersData, error: playersError } = await supabase
      .from('game_players')
      .select('*')
      .eq('game_id', gameId)
      .is('removed_at', null)
      .order('player_number');

    if (playersError) throw new Error(`Failed to fetch players: ${playersError.message}`);
    let players = playersData as Player[];

    // Fetch inputs
    const { data: inputsData } = await supabase
      .from('infection_inputs')
      .select('*')
      .eq('session_game_id', sessionGameId)
      .eq('manche', manche);
    const inputs = (inputsData || []) as InfectionInput[];

    // Fetch shots
    const { data: shotsData } = await supabase
      .from('infection_shots')
      .select('*')
      .eq('session_game_id', sessionGameId)
      .eq('manche', manche)
      .eq('status', 'PENDING')
      .order('server_ts');
    const shots = (shotsData || []) as Shot[];

    // Fetch inventory
    const { data: inventoryData } = await supabase
      .from('inventory')
      .select('*')
      .eq('session_game_id', sessionGameId);
    let inventory = (inventoryData || []) as InventoryItem[];

    // Helper to get player input
    const getInput = (playerNum: number): InfectionInput | undefined => {
      return inputs.find(i => i.player_num === playerNum);
    };

    // ========================================
    // STEP 1: FREEZE
    // ========================================
    await supabase
      .from('infection_round_state')
      .update({ status: 'LOCKED', locked_at: new Date().toISOString() })
      .eq('id', roundState.id);
    
    addLog('STEP_1_FREEZE', { status: 'LOCKED' });

    // ========================================
    // STEP 1B: PATIENT 0 INFECTION (BEFORE SHOTS!)
    // Only in manche 1 - Patient 0 is infected BEFORE any shooting
    // ========================================
    let patient0Player: Player | null = null;
    
    if (manche === 1) {
      const alivePV = players.filter(p => p.role_code === 'PV' && p.is_alive);
      
      // Filter votes to only include LIVING targets (not PV)
      const validPatient0Targets = players.filter(p => 
        p.is_alive && 
        p.role_code !== 'PV'
      ).map(p => p.player_number);
      
      const patient0Votes = alivePV
        .map(pv => getInput(pv.player_number)?.pv_patient0_target_num)
        .filter(v => v !== null && v !== undefined && validPatient0Targets.includes(v)) as number[];

      addLog('STEP_1B_PATIENT0_VOTES', { 
        alivePV: alivePV.map(p => p.player_number),
        validTargets: validPatient0Targets,
        filteredVotes: patient0Votes 
      });

      const { winner: patient0Num, counts: patient0Counts } = countVotes(patient0Votes);

      if (patient0Num) {
        const patient0 = getPlayerByNum(players, patient0Num);
        if (patient0 && patient0.is_alive) {
          // Infect patient 0 BEFORE shots
          patient0.is_carrier = true;
          patient0.is_contagious = false;
          patient0.infected_at_manche = manche;
          patient0.will_contaminate_at_manche = manche + 1;
          patient0.will_die_at_manche = manche + 2;
          patient0Player = patient0;

          await supabase.from('game_players').update({
            is_carrier: true,
            is_contagious: false,
            infected_at_manche: manche,
            will_contaminate_at_manche: manche + 1,
            will_die_at_manche: manche + 2,
          }).eq('id', patient0.id);

          pvMessages.push(`🦠 Patient 0: ${patient0.display_name} (#${patient0.player_number})`);
          addLog('STEP_1B_PATIENT0', { patient0_num: patient0Num, name: patient0.display_name, votes: patient0Counts });
        }
      } else {
        addLog('STEP_1B_PATIENT0_SKIPPED', { reason: 'No valid votes for living non-PV targets' });
      }
    }

    // ========================================
    // STEP 5: CORRUPTION AE (before timestamp order)
    // ========================================
    const ae = players.find(p => p.role_code === 'AE' && p.is_alive);
    const ba = players.find(p => p.role_code === 'BA');
    let sabotageActive = false;
    let aeGain = 0;

    if (ae && ba) {
      const aeInput = getInput(ae.player_number);
      const aeTargetNum = aeInput?.ae_sabotage_target_num;
      const aeCorrectlyIdentifiedBA = aeTargetNum === ba.player_number;

      addLog('STEP_5_CORRUPTION_CHECK', { 
        ae_num: ae.player_number, 
        ae_target: aeTargetNum, 
        ba_num: ba.player_number,
        correct: aeCorrectlyIdentifiedBA 
      });

      if (aeCorrectlyIdentifiedBA) {
        // NEW RULE: AE correctly identifies BA => Sabotage is ACTIVE by default
        // - CV (citoyens) can pay ≥10 to CANCEL sabotage
        // - PV can pay ≥15 to REACTIVATE sabotage (overrides CV cancellation)
        
        // Calculate sums
        let sumCitoyens = 0;
        let sumPV = 0;
        const citoyenContributors: Array<{ num: number; amount: number }> = [];
        const pvContributors: Array<{ num: number; amount: number }> = [];

        for (const input of inputs) {
          const player = getPlayerByNum(players, input.player_num);
          if (!player || !player.is_alive) continue;
          
          const amount = input.corruption_amount || 0;
          if (amount <= 0) continue;

          if (player.role_code === 'PV') {
            sumPV += amount;
            pvContributors.push({ num: player.player_number, amount });
          } else {
            // All non-PV are "citoyens" for corruption
            sumCitoyens += amount;
            citoyenContributors.push({ num: player.player_number, amount });
          }
        }

        const citoyenThreshold = 10;
        const pvThreshold = 15;
        const citoyensMet = sumCitoyens >= citoyenThreshold;
        const pvMet = sumPV >= pvThreshold;

        addLog('STEP_5_CORRUPTION_SUMS', { 
          sumCitoyens, sumPV, citoyensMet, pvMet,
          citoyenContributors, pvContributors 
        });

        let debitList: Array<{ num: number; amount: number }> = [];
        
        // Default: Sabotage ACTIVE when AE correctly identifies BA
        sabotageActive = true;
        
        if (citoyensMet && !pvMet) {
          // Case A: CV paid ≥10, PV didn't pay ≥15 -> Sabotage CANCELLED
          sabotageActive = false;
          debitList = citoyenContributors;
          addLog('STEP_5_CORRUPTION_RESULT', { case: 'A_CV_CANCEL', sabotage: false });
        } else if (pvMet) {
          // Case B: PV paid ≥15 -> Sabotage REACTIVATED (overrides CV)
          sabotageActive = true;
          debitList = pvContributors;
          addLog('STEP_5_CORRUPTION_RESULT', { case: 'B_PV_OVERRIDE', sabotage: true });
        } else {
          // Case C: Neither threshold met -> Sabotage remains ACTIVE (default)
          // AE gets +10 PVic bonus for successful sabotage without corruption
          aeGain = 10;
          addLog('STEP_5_CORRUPTION_RESULT', { case: 'C_DEFAULT_ACTIVE', sabotage: true, aeBonus: 10 });
        }

        // Apply debits and calculate AE gain
        for (const { num, amount } of debitList) {
          const player = getPlayerByNum(players, num);
          if (player) {
            const actualDebit = Math.min(amount, player.jetons);
            player.jetons -= actualDebit;
            aeGain += actualDebit;
            
            await supabase
              .from('game_players')
              .update({ jetons: player.jetons })
              .eq('id', player.id);
          }
        }

        // Credit AE
        if (aeGain > 0) {
          ae.pvic += aeGain;
          await supabase
            .from('game_players')
            .update({ pvic: ae.pvic })
            .eq('id', ae.id);
        }

        publicEvents.push(`🎭 Corruption résolue.`);
        addLog('STEP_5_CORRUPTION_DONE', { sabotageActive, aeGain, debitList });
      } else {
        addLog('STEP_5_CORRUPTION_SKIPPED', { reason: 'AE did not correctly identify BA' });
      }
    }

    // ========================================
    // STEP 7: RECHERCHE SY
    // ========================================
    const aliveSY = players.filter(p => p.role_code === 'SY' && p.is_alive);
    let sySuccess = false;

    if (aliveSY.length > 0) {
      const syTargets = aliveSY
        .map(sy => getInput(sy.player_number)?.sy_research_target_num)
        .filter(t => t !== null && t !== undefined) as number[];

      addLog('STEP_7_SY_RESEARCH', { sy_count: aliveSY.length, targets: syTargets });

      if (syTargets.length === aliveSY.length) {
        // Check if all SY chose the same target
        const uniqueTargets = [...new Set(syTargets)];
        
        if (uniqueTargets.length === 1) {
          const targetNum = uniqueTargets[0];
          const targetPlayer = getPlayerByNum(players, targetNum);
          
          if (targetPlayer?.has_antibodies) {
            sySuccess = true;
            roundState.sy_success_count = (roundState.sy_success_count || 0) + 1;
            
            await supabase
              .from('infection_round_state')
              .update({ sy_success_count: roundState.sy_success_count })
              .eq('id', roundState.id);

            publicEvents.push(`🔬 Recherche SY: Succès!`);
            syMessages.push(`Recherche réussie sur ${targetPlayer.display_name} - Anticorps trouvés!`);
          } else {
            publicEvents.push(`🔬 Recherche SY: Échec.`);
            syMessages.push(`Recherche échouée - ${targetPlayer?.display_name || 'Cible'} n'a pas les anticorps.`);
          }

          addLog('STEP_7_SY_RESULT', { 
            targetNum, 
            hasAntibodies: targetPlayer?.has_antibodies,
            success: sySuccess,
            totalSuccess: roundState.sy_success_count 
          });
        } else {
          publicEvents.push(`🔬 Recherche SY: Échec (cibles différentes).`);
          syMessages.push(`Recherche échouée - Les SY ont choisi des cibles différentes.`);
          addLog('STEP_7_SY_RESULT', { reason: 'different_targets', targets: syTargets });
        }
      } else {
        addLog('STEP_7_SY_RESULT', { reason: 'not_all_sy_submitted' });
      }
    }

    // ========================================
    // STEP 2: ARMES (shots by timestamp)
    // ========================================
    const deaths: number[] = [];
    const processedShots: Array<{ shooter: number; target: number; result: string }> = [];

    for (const shot of shots) {
      const shooter = getPlayerByNum(players, shot.shooter_num);
      const target = getPlayerByNum(players, shot.target_num);

      if (!shooter || !target) {
        await supabase.from('infection_shots').update({ status: 'IGNORED', ignore_reason: 'invalid_player' }).eq('id', shot.id);
        continue;
      }

      // Check if shooter is dead
      if (!shooter.is_alive || deaths.includes(shooter.player_number)) {
        await supabase.from('infection_shots').update({ status: 'IGNORED', ignore_reason: 'shooter_dead' }).eq('id', shot.id);
        processedShots.push({ shooter: shot.shooter_num, target: shot.target_num, result: 'shooter_dead' });
        continue;
      }

      // Check sabotage for BA
      if (shot.shooter_role === 'BA' && sabotageActive) {
        await supabase.from('infection_shots').update({ status: 'IGNORED', ignore_reason: 'sabotaged' }).eq('id', shot.id);
        processedShots.push({ shooter: shot.shooter_num, target: shot.target_num, result: 'sabotaged' });
        // Bullet is still consumed
        continue;
      }

      // Bot PV cannot kill other PV (friendly fire protection - only for bots)
      if (shot.shooter_role === 'PV' && target.role_code === 'PV' && shooter.is_bot) {
        await supabase.from('infection_shots').update({ status: 'IGNORED', ignore_reason: 'pv_bot_friendly_fire' }).eq('id', shot.id);
        processedShots.push({ shooter: shot.shooter_num, target: shot.target_num, result: 'pv_bot_friendly_fire' });
        continue;
      }

      // Check if target is already dead
      if (!target.is_alive || deaths.includes(target.player_number)) {
        await supabase.from('infection_shots').update({ status: 'IGNORED', ignore_reason: 'target_already_dead' }).eq('id', shot.id);
        processedShots.push({ shooter: shot.shooter_num, target: shot.target_num, result: 'target_dead' });
        continue;
      }

      // Check for Gilet (vest)
      // SPECIAL RULE: Ezkar + KK = gilet disabled (dies on first shot)
      const isEzkarKK = target.clan === 'Ezkar' && target.role_code === 'KK';
      
      const gilet = inventory.find(i => 
        i.owner_num === target.player_number && 
        i.objet === 'Gilet' && 
        i.quantite > 0 && 
        i.disponible
      );

      if (gilet && !isEzkarKK) {
        // Vest blocks the bullet (but NOT for Ezkar+KK)
        gilet.quantite -= 1;
        await supabase.from('inventory').update({ quantite: gilet.quantite }).eq('id', gilet.id);
        await supabase.from('infection_shots').update({ status: 'APPLIED', ignore_reason: 'blocked_by_vest' }).eq('id', shot.id);
        processedShots.push({ shooter: shot.shooter_num, target: shot.target_num, result: 'blocked_by_vest' });
        
        privateMessages.push({ player_num: target.player_number, message: `🛡️ Ton gilet t'a protégé d'une balle!` });
        continue;
      }
      
      // Log if Ezkar+KK had a vest but it didn't work
      if (gilet && isEzkarKK) {
        addLog('STEP_2_EZKAR_KK_VEST_DISABLED', { target: target.player_number, reason: 'Ezkar+KK combo disables vest' });
      }

      // Shot kills target
      target.is_alive = false;
      deaths.push(target.player_number);
      
      await supabase.from('game_players').update({ is_alive: false }).eq('id', target.id);
      await supabase.from('infection_shots').update({ status: 'APPLIED' }).eq('id', shot.id);
      
      processedShots.push({ shooter: shot.shooter_num, target: shot.target_num, result: 'killed' });
      publicEvents.push(`💀 ${target.display_name} a été tué(e). Rôle: ${target.role_code}`);
    }

    addLog('STEP_2_ARMES', { shots: processedShots, deaths });

    // ========================================
    // STEP 3: OC (Oracle Consultation)
    // ========================================
    const aliveOC = players.find(p => p.role_code === 'OC' && p.is_alive && !deaths.includes(p.player_number));
    
    addLog('STEP_3_OC_CHECK', { 
      has_oc: !!aliveOC, 
      oc_num: aliveOC?.player_number,
      oc_alive: aliveOC?.is_alive 
    });
    
    if (aliveOC) {
      const ocInput = getInput(aliveOC.player_number);
      const ocTarget = ocInput?.oc_lookup_target_num;

      addLog('STEP_3_OC_INPUT', { 
        oc_num: aliveOC.player_number, 
        has_input: !!ocInput, 
        target: ocTarget 
      });

      if (ocTarget) {
        const targetPlayer = getPlayerByNum(players, ocTarget);
        if (targetPlayer) {
          // Find crystal ball - don't require it to be available (OC always has implicit vision)
          const crystal = inventory.find(i => 
            i.owner_num === aliveOC.player_number && 
            i.objet === 'Boule de cristal'
          );

          addLog('STEP_3_OC_CRYSTAL', { 
            has_crystal: !!crystal, 
            crystal_qty: crystal?.quantite,
            crystal_id: crystal?.id 
          });

          // OC can always see roles (crystal ball is symbolic, always works)
          const ocMessage = `🔮 Le rôle de ${targetPlayer.display_name} est: ${targetPlayer.role_code}`;
          privateMessages.push({ 
            player_num: aliveOC.player_number, 
            message: ocMessage
          });

          // Consume crystal ball if exists and has quantity
          if (crystal && crystal.quantite > 0) {
            crystal.quantite -= 1;
            const { error: crystalError } = await supabase
              .from('inventory')
              .update({ quantite: crystal.quantite })
              .eq('id', crystal.id);
            
            if (crystalError) {
              addLog('STEP_3_OC_CRYSTAL_ERROR', { error: crystalError.message });
            }
          }

          // Insert as game_event for the private messages panel
          const { error: eventError } = await supabase.from('game_events').insert({
            game_id: gameId,
            session_game_id: sessionGameId,
            event_type: 'OC_REVEAL',
            message: ocMessage,
            manche,
            phase: 'RESOLVED',
            visibility: 'PRIVATE',
            player_num: aliveOC.player_number,
            payload: { target_num: ocTarget, role_revealed: targetPlayer.role_code, target_name: targetPlayer.display_name },
          });

          if (eventError) {
            addLog('STEP_3_OC_EVENT_ERROR', { error: eventError.message });
          } else {
            addLog('STEP_3_OC_SUCCESS', { 
              oc_num: aliveOC.player_number, 
              target: ocTarget, 
              role_revealed: targetPlayer.role_code,
              message: ocMessage 
            });
          }
        }
      }
    }

    // ========================================
    // STEP 4: ANTIDOTES
    // ========================================
    for (const input of inputs) {
      const player = getPlayerByNum(players, input.player_num);
      if (!player || !player.is_alive || deaths.includes(player.player_number)) continue;

      const antidoteTarget = input.pv_antidote_target_num;
      if (!antidoteTarget) continue;

      // Check if player has antidote
      const antidoteItem = inventory.find(i => 
        i.owner_num === player.player_number && 
        (i.objet === 'Antidote PV' || i.objet === 'Antidote Ezkar') && 
        i.quantite > 0 && 
        i.disponible
      );

      if (!antidoteItem) continue;

      const targetPlayer = getPlayerByNum(players, antidoteTarget);
      if (!targetPlayer) continue;

      // Consume antidote
      antidoteItem.quantite -= 1;
      await supabase.from('inventory').update({ quantite: antidoteItem.quantite }).eq('id', antidoteItem.id);

      // Check if target is carrier
      if (targetPlayer.is_carrier) {
        // Success! Target becomes permanently immune to DEATH but remains a carrier
        // They will continue to contaminate others like a healthy carrier
        targetPlayer.immune_permanent = true;
        targetPlayer.will_die_at_manche = null; // Cancel scheduled death
        
        await supabase.from('game_players').update({ 
          immune_permanent: true,
          will_die_at_manche: null 
        }).eq('id', targetPlayer.id);
        
        privateMessages.push({ player_num: player.player_number, message: `💉 Antidote réussi! ${targetPlayer.display_name} est maintenant immunisé(e) contre la mort mais reste porteur.` });
        privateMessages.push({ player_num: targetPlayer.player_number, message: `💉 Tu as reçu l'antidote! Tu es immunisé(e) contre la mort de l'infection mais tu continues de contaminer.` });
        addLog('STEP_4_ANTIDOTE', { user: player.player_number, target: antidoteTarget, success: true, willDieCancelled: true });
      } else {
        privateMessages.push({ player_num: player.player_number, message: `💉 Antidote échoué. ${targetPlayer.display_name} n'était pas porteur.` });
        addLog('STEP_4_ANTIDOTE', { user: player.player_number, target: antidoteTarget, success: false });
      }
    }

    // ========================================
    // STEP 6: VOTE TEST ANTICORPS
    // ========================================
    const aliveVoters = players.filter(p => p.is_alive && !deaths.includes(p.player_number));
    const testVotes = aliveVoters
      .map(p => getInput(p.player_number)?.vote_test_target_num)
      .filter(v => v !== null && v !== undefined) as number[];

    const { winner: testTarget, counts: testCounts } = countVotes(testVotes);

    if (testTarget) {
      const testedPlayer = getPlayerByNum(players, testTarget);
      if (testedPlayer) {
        const hasAntibodies = testedPlayer.has_antibodies;
        
        // Send private message to the tested player about their antibody status
        privateMessages.push({ 
          player_num: testedPlayer.player_number, 
          message: hasAntibodies 
            ? `🧬 Résultat du test: Tu as les anticorps!`
            : `🧬 Résultat du test: Tu n'as pas les anticorps.`
        });

        // Also insert as game_event for the private messages panel
        await supabase.from('game_events').insert({
          game_id: gameId,
          session_game_id: sessionGameId,
          event_type: 'ANTIBODY_TEST',
          message: hasAntibodies 
            ? `🧬 Résultat du test: Tu as les anticorps!`
            : `🧬 Résultat du test: Tu n'as pas les anticorps.`,
          manche,
          phase: 'RESOLVED',
          visibility: 'PRIVATE',
          player_num: testedPlayer.player_number,
          payload: { hasAntibodies, votes_received: testCounts[testTarget] || 0 },
        });

        // PUBLIC message: announce who got tested (name revealed)
        publicEvents.push(`🧪 Test anticorps: ${testedPlayer.display_name} (#${testedPlayer.player_number}) a été désigné(e) par le vote.`);
        addLog('STEP_6_VOTE_TEST', { target: testTarget, targetName: testedPlayer.display_name, hasAntibodies, votes: testCounts });
      }
    }

    // ========================================
    // STEP 8: INFECTION CYCLE
    // ========================================
    
    // Note: Patient 0 is now infected in STEP 1B (before shots)
    // The normal contamination logic (8b) handles both living and dead contaminators,
    // including the case where Patient 0 dies in manche 1 but still contaminates in manche 2

    // 8b: Contamination (spread to neighbors)
    // RULE: Maximum 2 NEW infections per round (global limit, not per contaminator)
    // Each contaminator checks ONLY their immediate neighbors (left and right)
    // If immediate neighbor is already a carrier -> NO spread in that direction
    // SPECIAL RULE: Dead contaminators still contaminate their neighbors
    // Get contaminators sorted by player_number to ensure consistent order
    const contaminators = players
      .filter(p => {
        const scheduledToContaminate = p.will_contaminate_at_manche === manche;
        
        // Exception: immune_permanent players don't spread
        if (p.immune_permanent) return false;
        
        return scheduledToContaminate;
      })
      .sort((a, b) => a.player_number - b.player_number);

    // Get original circle order (all players sorted by number)
    const allPlayersSorted = [...players].sort((a, b) => a.player_number - b.player_number);
    const allNums = allPlayersSorted.map(p => p.player_number);

    // Global limit: max 2 new infections per round
    const MAX_NEW_INFECTIONS_PER_ROUND = 2;
    let newInfectionsThisRound = 0;
    const newlyInfectedThisRound: number[] = [];

    for (const contaminator of contaminators) {
      // Stop if we've reached the max infections for this round
      if (newInfectionsThisRound >= MAX_NEW_INFECTIONS_PER_ROUND) {
        addLog('STEP_8_MAX_REACHED', { 
          contaminator_num: contaminator.player_number, 
          reason: 'Max 2 infections reached for this round' 
        });
        break;
      }

      const contaminatorIsAlive = contaminator.is_alive && !deaths.includes(contaminator.player_number);
      
      if (contaminatorIsAlive) {
        contaminator.is_contagious = true;
        await supabase.from('game_players').update({ is_contagious: true }).eq('id', contaminator.id);
      }

      // Find position in circle
      const contaminatorIdx = allNums.indexOf(contaminator.player_number);
      const targets: number[] = [];
      
      // Helper to find FIRST LIVING neighbor in a direction (skip dead players)
      const findFirstLivingNeighbor = (startIdx: number, direction: 'left' | 'right'): { num: number; player: Player } | null => {
        const step = direction === 'left' ? -1 : 1;
        for (let offset = 1; offset < allNums.length; offset++) {
          const idx = (startIdx + step * offset + allNums.length) % allNums.length;
          const num = allNums[idx];
          const player = getPlayerByNum(players, num);
          // Skip if dead or will die this round
          if (player && player.is_alive && !deaths.includes(player.player_number)) {
            return { num, player };
          }
        }
        return null;
      };
      
      // Check LEFT: Find first LIVING neighbor, then check if carrier
      const leftResult = findFirstLivingNeighbor(contaminatorIdx, 'left');
      
      if (leftResult) {
        const { num: leftNum, player: leftNeighbor } = leftResult;
        // If first living left neighbor was EVER a carrier -> STOP, don't spread left
        if (leftNeighbor.is_carrier || newlyInfectedThisRound.includes(leftNum)) {
          addLog('STEP_8_LEFT_BLOCKED', { 
            contaminator: contaminator.player_number, 
            first_living_left: leftNum, 
            reason: 'Already carrier' 
          });
        } else if (!leftNeighbor.immune_permanent &&
                   newInfectionsThisRound < MAX_NEW_INFECTIONS_PER_ROUND) {
          // Valid target: first living neighbor, not carrier, not immune
          targets.push(leftNum);
        }
      }
      
      // Check RIGHT: Find first LIVING neighbor, then check if carrier
      const rightResult = findFirstLivingNeighbor(contaminatorIdx, 'right');
      
      if (rightResult && (!leftResult || rightResult.num !== leftResult.num)) { // Avoid duplicate
        const { num: rightNum, player: rightNeighbor } = rightResult;
        // If first living right neighbor was EVER a carrier -> STOP, don't spread right
        if (rightNeighbor.is_carrier || newlyInfectedThisRound.includes(rightNum)) {
          addLog('STEP_8_RIGHT_BLOCKED', { 
            contaminator: contaminator.player_number, 
            first_living_right: rightNum, 
            reason: 'Already carrier' 
          });
        } else if (!rightNeighbor.immune_permanent &&
                   newInfectionsThisRound + targets.length < MAX_NEW_INFECTIONS_PER_ROUND) {
          // Valid target: first living neighbor, not carrier, not immune
          targets.push(rightNum);
        }
      } else if (rightResult && leftResult && rightResult.num === leftResult.num) {
        // Edge case: Only one living player left, already checked on left side
        addLog('STEP_8_RIGHT_SAME_AS_LEFT', { 
          contaminator: contaminator.player_number, 
          only_neighbor: rightResult.num 
        });
      }
      
      const leftNum = leftResult?.num ?? null;
      const rightNum = rightResult?.num ?? null;

      addLog('STEP_8_CONTAMINATOR', { 
        contaminator_num: contaminator.player_number, 
        contaminatorIsAlive,
        left_neighbor: leftNum,
        right_neighbor: rightNum,
        targets_found: targets,
        infections_so_far: newInfectionsThisRound
      });

      // Apply infections (respecting global limit)
      for (const targetNum of targets) {
        if (newInfectionsThisRound >= MAX_NEW_INFECTIONS_PER_ROUND) break;
        
        const neighbor = getPlayerByNum(players, targetNum);
        if (neighbor && neighbor.is_alive && !deaths.includes(neighbor.player_number) && !neighbor.is_carrier) {
          neighbor.is_carrier = true;
          neighbor.infected_at_manche = manche;
          neighbor.will_contaminate_at_manche = manche + 1;
          neighbor.will_die_at_manche = manche + 2;

          await supabase.from('game_players').update({
            is_carrier: true,
            infected_at_manche: manche,
            will_contaminate_at_manche: manche + 1,
            will_die_at_manche: manche + 2,
          }).eq('id', neighbor.id);

          newInfectionsThisRound++;
          newlyInfectedThisRound.push(targetNum);

          addLog('STEP_8_CONTAMINATION', { 
            source: contaminator.player_number, 
            sourceWasDead: !contaminatorIsAlive,
            target: targetNum,
            will_die_at: manche + 2,
            total_new_infections: newInfectionsThisRound
          });
        }
      }
    }

    addLog('STEP_8_CONTAMINATION_SUMMARY', { 
      total_new_infections: newInfectionsThisRound,
      newly_infected: newlyInfectedThisRound 
    });

    // 8c: Virus deaths
    const virusVictims = players.filter(p => 
      p.is_alive && 
      !deaths.includes(p.player_number) &&
      p.will_die_at_manche === manche &&
      !p.immune_permanent
    );

    for (const victim of virusVictims) {
      victim.is_alive = false;
      deaths.push(victim.player_number);
      
      await supabase.from('game_players').update({ is_alive: false }).eq('id', victim.id);
      publicEvents.push(`☠️ ${victim.display_name} est mort(e) du virus. Rôle: ${victim.role_code}`);
      
      addLog('STEP_8_VIRUS_DEATH', { victim: victim.player_number, name: victim.display_name });
    }

    // ========================================
    // STEP 9: PUBLICATION & END CHECK
    // ========================================
    
    // Check win conditions
    const remainingPlayers = players.filter(p => p.is_alive && !deaths.includes(p.player_number));
    const remainingPV = remainingPlayers.filter(p => p.role_code === 'PV');
    const remainingNonPV = remainingPlayers.filter(p => p.role_code !== 'PV');
    
    let gameEnded = false;
    let winner: 'PV' | 'NON_PV' | null = null;

    // SY mission complete?
    if (roundState.sy_success_count >= roundState.sy_required_success) {
      gameEnded = true;
      winner = 'NON_PV';
      publicEvents.push(`🎉 VICTOIRE NON-PV! La mission SY est accomplie!`);
    }
    // All PV dead?
    else if (remainingPV.length === 0) {
      gameEnded = true;
      winner = 'NON_PV';
      publicEvents.push(`🎉 VICTOIRE NON-PV! Tous les PV sont éliminés!`);
    }
    // All non-PV dead (excluding immune and those with antibodies who can't die)?
    // Players with has_antibodies are "healthy carriers" who will never die from virus
    // So if all remaining non-PV either have immune_permanent OR has_antibodies, PV wins
    else if (remainingNonPV.filter(p => !p.immune_permanent && !p.has_antibodies).length === 0) {
      gameEnded = true;
      winner = 'PV';
      publicEvents.push(`🦠 VICTOIRE PV! Le virus a triomphé!`);
    }

    addLog('STEP_9_END_CHECK', { 
      gameEnded, 
      winner, 
      remainingPV: remainingPV.length,
      remainingNonPV: remainingNonPV.length,
      syProgress: `${roundState.sy_success_count}/${roundState.sy_required_success}`
    });

    // Update round state
    await supabase
      .from('infection_round_state')
      .update({ status: 'RESOLVED', resolved_at: new Date().toISOString() })
      .eq('id', roundState.id);

    // Log all events
    for (const event of publicEvents) {
      await supabase.from('game_events').insert({
        game_id: gameId,
        session_game_id: sessionGameId,
        event_type: 'ROUND_EVENT',
        message: event,
        manche,
        phase: 'RESOLVED',
        visibility: 'PUBLIC',
      });
    }

    for (const { player_num, message } of privateMessages) {
      await supabase.from('logs_joueurs').insert({
        game_id: gameId,
        session_game_id: sessionGameId,
        manche,
        message,
        type: 'PRIVATE',
      });
    }

    // Log PV private chat
    for (const message of pvMessages) {
      await supabase.from('infection_chat_messages').insert({
        game_id: gameId,
        session_game_id: sessionGameId,
        manche,
        channel_type: 'PV',
        channel_key: 'PV',
        author_num: 0,
        author_name: 'SYSTÈME',
        message,
      });
    }

    // Log SY private chat
    for (const message of syMessages) {
      await supabase.from('infection_chat_messages').insert({
        game_id: gameId,
        session_game_id: sessionGameId,
        manche,
        channel_type: 'SY',
        channel_key: 'SY',
        author_num: 0,
        author_name: 'SYSTÈME',
        message,
      });
    }

    // Log MJ details
    await supabase.from('logs_mj').insert({
      game_id: gameId,
      session_game_id: sessionGameId,
      action: 'RESOLVE_ROUND',
      manche,
      details: JSON.stringify(logs),
    });

    // Update game status if ended
    if (gameEnded) {
      await supabase.from('session_games').update({ status: 'ENDED', ended_at: new Date().toISOString() }).eq('id', sessionGameId);
      await supabase.from('games').update({ status: 'ENDED', phase: 'ENDED' }).eq('id', gameId);

      // ========================================
      // CALCULATE FINAL PVIC SCORES
      // ========================================
      const pvicUpdates: { player_num: number; pvic_earned: number; breakdown: string[] }[] = [];
      
      // Fetch vote accuracy data
      const { data: allInputs } = await supabase
        .from('infection_inputs')
        .select('player_num, vote_suspect_pv_target_num')
        .eq('session_game_id', sessionGameId);
      
      // Count correct PV votes per player
      const pvPlayerNums = players.filter(p => p.role_code === 'PV').map(p => p.player_number);
      const voteAccuracy: Record<number, number> = {};
      for (const input of allInputs || []) {
        if (input.vote_suspect_pv_target_num && pvPlayerNums.includes(input.vote_suspect_pv_target_num)) {
          voteAccuracy[input.player_num] = (voteAccuracy[input.player_num] || 0) + 1;
        }
      }
      const maxVoteAccuracy = Math.max(...Object.values(voteAccuracy), 0);
      const bestVoters = Object.entries(voteAccuracy)
        .filter(([_, count]) => count === maxVoteAccuracy && maxVoteAccuracy > 0)
        .map(([num]) => parseInt(num));

      // Fetch AE sabotage count
      const { data: sabotageEvents } = await supabase
        .from('game_events')
        .select('payload')
        .eq('session_game_id', sessionGameId)
        .eq('event_type', 'SABOTAGE_SUCCESS');
      const sabotagesByAE: Record<number, number> = {};
      for (const evt of sabotageEvents || []) {
        const aeNum = (evt.payload as any)?.ae_num;
        if (aeNum) sabotagesByAE[aeNum] = (sabotagesByAE[aeNum] || 0) + 1;
      }

      // Fetch corruption received by AE
      const { data: corruptionLogs } = await supabase
        .from('logs_mj')
        .select('details')
        .eq('session_game_id', sessionGameId)
        .eq('action', 'RESOLVE_ROUND');
      let corruptionByAE: Record<number, number> = {};
      for (const log of corruptionLogs || []) {
        try {
          const parsed = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
          const corruptionStep = parsed?.find?.((l: any) => l.step === 'STEP_3_CORRUPTION');
          if (corruptionStep?.details?.pvic_awarded) {
            for (const [aeNum, pvic] of Object.entries(corruptionStep.details.pvic_awarded)) {
              corruptionByAE[parseInt(aeNum)] = (corruptionByAE[parseInt(aeNum)] || 0) + (pvic as number);
            }
          }
        } catch {}
      }

      for (const player of players) {
        let pvic = 0;
        const breakdown: string[] = [];
        const role = player.role_code;
        const isAlive = player.is_alive && !deaths.includes(player.player_number);
        const pvDead = winner === 'NON_PV';
        const sySuccess = roundState.sy_success_count >= roundState.sy_required_success;

        if (role === 'BA') {
          // BA: 50/30/15 PVic based on how fast PV died
          if (pvDead) {
            if (manche <= 2) { pvic += 50; breakdown.push('PV morts en ≤2 manches: +50'); }
            else if (manche === 3) { pvic += 30; breakdown.push('PV morts en 3 manches: +30'); }
            else if (manche === 4) { pvic += 15; breakdown.push('PV morts en 4 manches: +15'); }
          }
        } else if (role === 'CV') {
          // CV: 20 if all PV dead, 20 if SY success, 10 if alive at PV death, 10 if best voter
          if (pvDead) { pvic += 20; breakdown.push('Tous les PV morts: +20'); }
          if (sySuccess) { pvic += 20; breakdown.push('Mission SY réussie: +20'); }
          if (pvDead && isAlive) { pvic += 10; breakdown.push('Vivant à la mort des PV: +10'); }
          if (bestVoters.includes(player.player_number)) {
            const share = Math.floor(10 / bestVoters.length);
            pvic += share;
            breakdown.push(`Meilleurs soupçons (partage ${bestVoters.length}): +${share}`);
          }
        } else if (role === 'KK') {
          // KK: 50/30/15 based on death round, 10 if best voter
          if (!isAlive) {
            const deathManche = player.will_die_at_manche || manche;
            if (deathManche <= 2) { pvic += 50; breakdown.push('Mort en ≤2 manches: +50'); }
            else if (deathManche === 3) { pvic += 30; breakdown.push('Mort en 3ème manche: +30'); }
            else if (deathManche === 4) { pvic += 15; breakdown.push('Mort en 4ème manche: +15'); }
          }
          if (bestVoters.includes(player.player_number)) {
            const share = Math.floor(10 / bestVoters.length);
            pvic += share;
            breakdown.push(`Meilleurs soupçons (partage ${bestVoters.length}): +${share}`);
          }
        } else if (role === 'OC') {
          // OC: Same as CV
          if (pvDead) { pvic += 20; breakdown.push('Tous les PV morts: +20'); }
          if (sySuccess) { pvic += 20; breakdown.push('Mission SY réussie: +20'); }
          if (pvDead && isAlive) { pvic += 10; breakdown.push('Vivant à la mort des PV: +10'); }
          if (bestVoters.includes(player.player_number)) {
            const share = Math.floor(10 / bestVoters.length);
            pvic += share;
            breakdown.push(`Meilleurs soupçons (partage ${bestVoters.length}): +${share}`);
          }
        } else if (role === 'PV') {
          // PV: 40 if they win
          if (winner === 'PV') { pvic += 40; breakdown.push('Victoire PV: +40'); }
        } else if (role === 'SY') {
          // SY: 30 if mission success, 20 if PV dead, 10 if alive, 10 if best voter
          if (sySuccess) { pvic += 30; breakdown.push('Mission SY réussie: +30'); }
          if (pvDead) { pvic += 20; breakdown.push('Tous les PV morts: +20'); }
          if (pvDead && isAlive) { pvic += 10; breakdown.push('Vivant à la mort des PV: +10'); }
          if (bestVoters.includes(player.player_number)) {
            const share = Math.floor(10 / bestVoters.length);
            pvic += share;
            breakdown.push(`Meilleurs soupçons (partage ${bestVoters.length}): +${share}`);
          }
        } else if (role === 'AE') {
          // AE: 10 per sabotage, corruption amount, 10 if best voter
          const sabotages = sabotagesByAE[player.player_number] || 0;
          if (sabotages > 0) { pvic += sabotages * 10; breakdown.push(`Sabotages (${sabotages}): +${sabotages * 10}`); }
          const corruption = corruptionByAE[player.player_number] || 0;
          if (corruption > 0) { pvic += corruption; breakdown.push(`Corruption reçue: +${corruption}`); }
          if (bestVoters.includes(player.player_number)) {
            const share = Math.floor(10 / bestVoters.length);
            pvic += share;
            breakdown.push(`Meilleurs soupçons (partage ${bestVoters.length}): +${share}`);
          }
        }

        pvicUpdates.push({ player_num: player.player_number, pvic_earned: pvic, breakdown });
      }

      // Update players with earned PVic
      for (const update of pvicUpdates) {
        const player = getPlayerByNum(players, update.player_num);
        if (player) {
          await supabase
            .from('game_players')
            .update({ pvic: (player.pvic || 0) + update.pvic_earned })
            .eq('game_id', gameId)
            .eq('player_number', update.player_num);
        }
      }

      addLog('STEP_10_PVIC_CALCULATION', { pvicUpdates, bestVoters, maxVoteAccuracy });

      // Publish GAME_END event with PVic breakdown
      await supabase.from('game_events').insert({
        game_id: gameId,
        session_game_id: sessionGameId,
        event_type: 'GAME_END',
        message: `🏆 Partie terminée! Victoire ${winner === 'PV' ? 'Porte Venins' : 'Synthétistes'}`,
        manche,
        phase: 'ENDED',
        visibility: 'PUBLIC',
        payload: { winner, pvicUpdates },
      });

    } else {
      await supabase.from('session_games').update({ phase: 'RESOLVED' }).eq('id', sessionGameId);
      await supabase.from('games').update({ phase: 'RESOLVED' }).eq('id', gameId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: gameEnded ? `Partie terminée! Victoire ${winner}` : `Manche ${manche} résolue`,
        data: {
          gameEnded,
          winner,
          deaths: deaths.length,
          syProgress: `${roundState.sy_success_count}/${roundState.sy_required_success}`,
          sabotageActive,
          publicEvents,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('[resolve-infection-round] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error', logs }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
