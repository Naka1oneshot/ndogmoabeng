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
        
        if (citoyensMet && !pvMet) {
          // Case A: Sabotage MAINTAINED
          sabotageActive = true;
          debitList = citoyenContributors;
          addLog('STEP_5_CORRUPTION_RESULT', { case: 'A', sabotage: true });
        } else if (pvMet && !citoyensMet) {
          // Case B: Sabotage CANCELLED
          sabotageActive = false;
          debitList = pvContributors;
          addLog('STEP_5_CORRUPTION_RESULT', { case: 'B', sabotage: false });
        } else if (citoyensMet && pvMet) {
          // Case C: Both thresholds met -> Sabotage CANCELLED, only PV debited
          sabotageActive = false;
          debitList = pvContributors;
          addLog('STEP_5_CORRUPTION_RESULT', { case: 'C', sabotage: false });
        } else {
          // Neither threshold met -> no effect
          addLog('STEP_5_CORRUPTION_RESULT', { case: 'NONE', sabotage: false });
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

      // Check if target is already dead
      if (!target.is_alive || deaths.includes(target.player_number)) {
        await supabase.from('infection_shots').update({ status: 'IGNORED', ignore_reason: 'target_already_dead' }).eq('id', shot.id);
        processedShots.push({ shooter: shot.shooter_num, target: shot.target_num, result: 'target_dead' });
        continue;
      }

      // Check for Gilet (vest)
      const gilet = inventory.find(i => 
        i.owner_num === target.player_number && 
        i.objet === 'Gilet' && 
        i.quantite > 0 && 
        i.disponible
      );

      if (gilet) {
        // Vest blocks the bullet
        gilet.quantite -= 1;
        await supabase.from('inventory').update({ quantite: gilet.quantite }).eq('id', gilet.id);
        await supabase.from('infection_shots').update({ status: 'APPLIED', ignore_reason: 'blocked_by_vest' }).eq('id', shot.id);
        processedShots.push({ shooter: shot.shooter_num, target: shot.target_num, result: 'blocked_by_vest' });
        
        privateMessages.push({ player_num: target.player_number, message: `🛡️ Ton gilet t'a protégé d'une balle!` });
        continue;
      }

      // Shot kills target
      target.is_alive = false;
      deaths.push(target.player_number);
      
      await supabase.from('game_players').update({ is_alive: false }).eq('id', target.id);
      await supabase.from('infection_shots').update({ status: 'APPLIED' }).eq('id', shot.id);
      
      processedShots.push({ shooter: shot.shooter_num, target: shot.target_num, result: 'killed' });
      publicEvents.push(`💀 ${target.display_name} a été tué(e) par balle. Rôle: ${target.role_code}`);
    }

    addLog('STEP_2_ARMES', { shots: processedShots, deaths });

    // ========================================
    // STEP 3: OC (Oracle Consultation)
    // ========================================
    const aliveOC = players.find(p => p.role_code === 'OC' && p.is_alive && !deaths.includes(p.player_number));
    
    if (aliveOC) {
      const ocInput = getInput(aliveOC.player_number);
      const ocTarget = ocInput?.oc_lookup_target_num;

      if (ocTarget) {
        const targetPlayer = getPlayerByNum(players, ocTarget);
        if (targetPlayer) {
          // Consume crystal ball
          const crystal = inventory.find(i => 
            i.owner_num === aliveOC.player_number && 
            i.objet === 'Boule de cristal' && 
            i.quantite > 0
          );

          if (crystal) {
            crystal.quantite -= 1;
            await supabase.from('inventory').update({ quantite: crystal.quantite }).eq('id', crystal.id);
            
            privateMessages.push({ 
              player_num: aliveOC.player_number, 
              message: `🔮 Le rôle de ${targetPlayer.display_name} est: ${targetPlayer.role_code}` 
            });

            addLog('STEP_3_OC', { oc_num: aliveOC.player_number, target: ocTarget, role_revealed: targetPlayer.role_code });
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
        // Success! Target becomes permanently immune
        targetPlayer.immune_permanent = true;
        await supabase.from('game_players').update({ immune_permanent: true }).eq('id', targetPlayer.id);
        
        privateMessages.push({ player_num: player.player_number, message: `💉 Antidote réussi! ${targetPlayer.display_name} est maintenant immunisé(e).` });
        addLog('STEP_4_ANTIDOTE', { user: player.player_number, target: antidoteTarget, success: true });
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
        
        privateMessages.push({ 
          player_num: testedPlayer.player_number, 
          message: hasAntibodies 
            ? `🧬 Résultat du test: Tu as les anticorps!`
            : `🧬 Résultat du test: Tu n'as pas les anticorps.`
        });

        publicEvents.push(`🧪 Un test anticorps a été réalisé.`);
        addLog('STEP_6_VOTE_TEST', { target: testTarget, hasAntibodies, votes: testCounts });
      }
    }

    // ========================================
    // STEP 8: INFECTION CYCLE
    // ========================================
    
    // 8a: Patient 0 (only manche 1)
    if (manche === 1) {
      const alivePV = players.filter(p => p.role_code === 'PV' && p.is_alive && !deaths.includes(p.player_number));
      const patient0Votes = alivePV
        .map(pv => getInput(pv.player_number)?.pv_patient0_target_num)
        .filter(v => v !== null && v !== undefined) as number[];

      const { winner: patient0Num } = countVotes(patient0Votes);

      if (patient0Num) {
        const patient0 = getPlayerByNum(players, patient0Num);
        if (patient0 && patient0.is_alive && !deaths.includes(patient0.player_number)) {
          // Infect patient 0
          patient0.is_carrier = true;
          patient0.is_contagious = false;
          patient0.infected_at_manche = manche;
          patient0.will_contaminate_at_manche = manche + 1;
          patient0.will_die_at_manche = manche + 2;

          await supabase.from('game_players').update({
            is_carrier: true,
            is_contagious: false,
            infected_at_manche: manche,
            will_contaminate_at_manche: manche + 1,
            will_die_at_manche: manche + 2,
          }).eq('id', patient0.id);

          pvMessages.push(`🦠 Patient 0: ${patient0.display_name} (#${patient0.player_number})`);
          addLog('STEP_8_PATIENT0', { patient0_num: patient0Num, name: patient0.display_name });
        }
      }
    }

    // 8b: Contamination (spread to neighbors)
    const contaminators = players.filter(p => 
      p.is_alive && 
      !deaths.includes(p.player_number) &&
      p.will_contaminate_at_manche === manche
    );

    for (const contaminator of contaminators) {
      contaminator.is_contagious = true;
      await supabase.from('game_players').update({ is_contagious: true }).eq('id', contaminator.id);

      // Find neighbors (circular)
      const allNums = players.filter(p => p.is_alive && !deaths.includes(p.player_number)).map(p => p.player_number).sort((a, b) => a - b);
      const idx = allNums.indexOf(contaminator.player_number);
      
      const neighbors: number[] = [];
      if (allNums.length > 1) {
        const leftIdx = idx === 0 ? allNums.length - 1 : idx - 1;
        const rightIdx = idx === allNums.length - 1 ? 0 : idx + 1;
        if (allNums[leftIdx] !== contaminator.player_number) neighbors.push(allNums[leftIdx]);
        if (allNums[rightIdx] !== contaminator.player_number && allNums[rightIdx] !== allNums[leftIdx]) {
          neighbors.push(allNums[rightIdx]);
        }
      }

      for (const neighborNum of neighbors) {
        const neighbor = getPlayerByNum(players, neighborNum);
        if (neighbor && neighbor.is_alive && !neighbor.is_carrier) {
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

          addLog('STEP_8_CONTAMINATION', { 
            source: contaminator.player_number, 
            target: neighborNum,
            will_die_at: manche + 2
          });
        }
      }
    }

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
    // All non-PV dead (excluding immune)?
    else if (remainingNonPV.filter(p => !p.immune_permanent).length === 0) {
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

      // TODO: Calculate final PVic scores
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
