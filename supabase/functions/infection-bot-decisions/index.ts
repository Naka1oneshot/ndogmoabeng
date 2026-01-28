import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BotPlayer {
  id: string;
  player_number: number;
  display_name: string;
  role_code: string;
  is_alive: boolean;
  jetons: number;
  is_carrier: boolean;
  is_contagious: boolean;
  has_antibodies: boolean;
}

interface InventoryItem {
  id: string;
  owner_num: number;
  objet: string;
  quantite: number;
}

interface BotDecisionResult {
  player_number: number;
  display_name: string;
  role_code: string;
  action?: string;
  target?: number;
  amount?: number;
  skipped_reason?: string;
  // Additional context for MJ visibility
  has_gilet?: boolean;
  has_antidote?: boolean;
  corruption_paid?: number;
}

interface RoundState {
  id: string;
  manche: number;
  status: string;
  sy_success_count: number;
  sy_required_success: number;
  config?: {
    bot_config?: BotConfig;
  };
}

interface BotConfig {
  ba_shoot_chance?: number;
  ae_sabotage_base?: number;
  ae_sabotage_after_success?: number;
  pv_antidote_chance?: number;
  pv_shoot_chance?: number;
  corruption_min?: number;
  corruption_max?: number;
  oc_pv_target_base?: number;
  oc_pv_target_increment?: number;
}

const DEFAULT_BOT_CONFIG: Required<BotConfig> = {
  ba_shoot_chance: 90,
  ae_sabotage_base: 40,
  ae_sabotage_after_success: 90,
  pv_antidote_chance: 80,
  pv_shoot_chance: 70,
  corruption_min: 2,
  corruption_max: 10,
  oc_pv_target_base: 40,
  oc_pv_target_increment: 10,
};

interface BotMemory {
  ae_sabotage_count: number;
  oc_pv_targets: number[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { gameId, sessionGameId, manche } = await req.json();

    if (!gameId || !sessionGameId || !manche) {
      throw new Error('gameId, sessionGameId, and manche are required');
    }

    console.log('[infection-bot-decisions] Starting:', { gameId, sessionGameId, manche });

    // Verify authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization required');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if user is host or admin
    const { data: game } = await supabase
      .from('games')
      .select('host_user_id')
      .eq('id', gameId)
      .single();

    const { data: adminRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'super_admin'])
      .maybeSingle();

    if (game?.host_user_id !== user.id && !adminRole) {
      throw new Error('Only host or admin can trigger bot decisions');
    }

    // Verify round is OPEN
    const { data: roundState } = await supabase
      .from('infection_round_state')
      .select('*')
      .eq('session_game_id', sessionGameId)
      .eq('manche', manche)
      .single();

    if (!roundState || roundState.status !== 'OPEN') {
      throw new Error(`Round not OPEN (status: ${roundState?.status || 'not found'})`);
    }

    // Extract bot config from round state
    const botConfig: Required<BotConfig> = {
      ...DEFAULT_BOT_CONFIG,
      ...((roundState.config as any)?.bot_config || {}),
    };

    // Fetch all alive bots
    const { data: allPlayers } = await supabase
      .from('game_players')
      .select('id, player_number, display_name, role_code, is_alive, jetons, is_carrier, is_contagious, has_antibodies, is_bot')
      .eq('game_id', gameId)
      .is('removed_at', null)
      .not('player_number', 'is', null)
      .order('player_number', { ascending: true });

    const players = allPlayers || [];
    const bots = players.filter(p => p.is_bot && p.is_alive !== false) as BotPlayer[];
    const humanPlayers = players.filter(p => !p.is_bot && p.is_alive !== false);
    const alivePlayers = players.filter(p => p.is_alive !== false);

    if (bots.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No bots to process', decisions_made: 0, results: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch inventory
    const { data: inventoryData } = await supabase
      .from('inventory')
      .select('id, owner_num, objet, quantite')
      .eq('session_game_id', sessionGameId);
    
    const inventory = inventoryData || [];

    // Fetch existing inputs this round (to check for duplicates)
    const { data: existingInputsData } = await supabase
      .from('infection_inputs')
      .select('player_num, ae_sabotage_target_num, sy_research_target_num, oc_lookup_target_num, corruption_amount, pv_patient0_target_num')
      .eq('session_game_id', sessionGameId)
      .eq('manche', manche);
    
    const existingInputs = existingInputsData || [];

    type ExistingInput = { player_num: number; ae_sabotage_target_num: number | null; sy_research_target_num: number | null; oc_lookup_target_num: number | null; corruption_amount: number | null; pv_patient0_target_num: number | null };
    const existingInputsMap = new Map<number, ExistingInput>();
    for (const input of existingInputs || []) {
      existingInputsMap.set(input.player_num, input);
    }

    // Fetch existing shots this round
    const { data: existingShots } = await supabase
      .from('infection_shots')
      .select('shooter_num')
      .eq('session_game_id', sessionGameId)
      .eq('manche', manche);

    const shootersThisRound = new Set((existingShots || []).map(s => s.shooter_num));

    // Load bot memory from logs (AE sabotage count, OC findings)
    const { data: mjLogs } = await supabase
      .from('logs_mj')
      .select('action, details')
      .eq('game_id', gameId)
      .in('action', ['SABOTAGE_SUCCESS', 'OC_CONSULT', 'ROUND_RESOLVED']);

    const botMemory: BotMemory = {
      ae_sabotage_count: 0,
      oc_pv_targets: [],
    };

    for (const log of mjLogs || []) {
      if (log.action === 'SABOTAGE_SUCCESS') {
        botMemory.ae_sabotage_count++;
      }
      if (log.action === 'OC_CONSULT') {
        try {
          const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
          if (details?.target_role === 'PV' && details?.target_num) {
            botMemory.oc_pv_targets.push(details.target_num);
          }
        } catch {}
      }
    }

    const results: BotDecisionResult[] = [];
    const inputsToInsert: any[] = [];
    const inputsToUpdate: { player_num: number; updates: any }[] = [];
    const shotsToInsert: any[] = [];
    const inventoryUpdates: { id: string; quantite: number }[] = [];

    // Helper: get random alive player (excluding certain roles/nums)
    function getRandomTarget(excludeNums: number[] = [], excludeRoles: string[] = []): number | null {
      const targets = alivePlayers.filter(
        p => !excludeNums.includes(p.player_number!) && !excludeRoles.includes(p.role_code || '')
      );
      if (targets.length === 0) return null;
      return targets[Math.floor(Math.random() * targets.length)].player_number!;
    }

    // Find the BA player for AE sabotage
    const baPlayer = players.find(p => p.role_code === 'BA' && p.is_alive !== false);

    // Pre-compute SY coordination target (all bot SY will use same target)
    let syCoordinatedTarget: number | null = null;
    
    // First check if human SY has submitted
    const humanSYs = humanPlayers.filter(p => p.role_code === 'SY');
    for (const humanSY of humanSYs) {
      const humanInput = existingInputsMap.get(humanSY.player_number!);
      if (humanInput?.sy_research_target_num) {
        syCoordinatedTarget = humanInput.sy_research_target_num;
        console.log('[infection-bot-decisions] SY bots will follow human SY target:', syCoordinatedTarget);
        break;
      }
    }
    
    // If no human SY vote, pick ONE random target for all bot SYs
    if (!syCoordinatedTarget) {
      const nonSYPlayers = alivePlayers.filter(p => p.role_code !== 'SY');
      const humanNonSY = nonSYPlayers.filter(p => !p.is_bot);
      const pool = humanNonSY.length > 0 ? humanNonSY : nonSYPlayers;
      if (pool.length > 0) {
        syCoordinatedTarget = pool[Math.floor(Math.random() * pool.length)].player_number!;
        console.log('[infection-bot-decisions] SY bots will all target:', syCoordinatedTarget);
      }
    }

    // Process each bot based on role
    for (const bot of bots) {
      const playerInventory = inventory.filter(i => i.owner_num === bot.player_number);
      const existingInput = existingInputsMap.get(bot.player_number);
      
      // Check for protection items
      const hasGilet = playerInventory.some(i => i.objet === 'Gilet' && i.quantite > 0);
      const hasAntidote = playerInventory.some(i => 
        (i.objet === 'Antidote PV' || i.objet === 'Antidote Ezkar') && i.quantite > 0
      );
      
      const result: BotDecisionResult = {
        player_number: bot.player_number,
        display_name: bot.display_name,
        role_code: bot.role_code,
        has_gilet: hasGilet,
        has_antidote: hasAntidote,
      };

      try {
        switch (bot.role_code) {
          case 'BA': {
            // BA: 90% chance to use weapon, random target (with OC-discovered PV priority)
            if (shootersThisRound.has(bot.player_number)) {
              result.skipped_reason = 'Already shot this round';
              break;
            }

            const bullets = playerInventory.find(i => i.objet === 'Balle BA');
            if (!bullets || bullets.quantite < 1) {
              result.skipped_reason = 'No bullets';
              break;
            }

            if (Math.random() > (botConfig.ba_shoot_chance / 100)) {
              result.skipped_reason = `Chose not to shoot (${100 - botConfig.ba_shoot_chance}% chance)`;
              break;
            }

            // Target selection with OC-discovered PV priority
            let targetNum: number | null = null;
            const knownPVs = botMemory.oc_pv_targets.filter(num => 
              alivePlayers.some(p => p.player_number === num)
            );

            if (knownPVs.length > 0) {
              // Calculate chance based on how long PV has been known (configurable)
              const basePVChance = (botConfig.oc_pv_target_base / 100) + (manche - 1) * (botConfig.oc_pv_target_increment / 100);
              if (Math.random() < Math.min(basePVChance, 0.9)) {
                targetNum = knownPVs[Math.floor(Math.random() * knownPVs.length)];
              }
            }

            if (!targetNum) {
              targetNum = getRandomTarget([bot.player_number]);
            }

            if (!targetNum) {
              result.skipped_reason = 'No valid target';
              break;
            }

            // Insert shot with correct schema: shooter_role instead of weapon_type
            shotsToInsert.push({
              game_id: gameId,
              session_game_id: sessionGameId,
              manche,
              shooter_num: bot.player_number,
              target_num: targetNum,
              shooter_role: 'BA',
              status: 'PENDING',
            });

            inventoryUpdates.push({ id: bullets.id, quantite: bullets.quantite - 1 });
            result.action = 'SHOT';
            result.target = targetNum;
            break;
          }

          case 'PV': {
            // PV: Cannot shoot other PVs, 80% chance to use antidote when carrier
            // MANCHE 1: MUST designate Patient 0 (virus usage is mandatory)
            const otherPVs = players.filter(p => p.role_code === 'PV' && p.player_number !== bot.player_number);
            const otherPVNums = otherPVs.map(p => p.player_number!);

            // Manche 1: PV bots ALWAYS designate a patient 0 (mandatory per game rules)
            if (manche === 1) {
              // Check if already submitted patient 0
              if (existingInput?.pv_patient0_target_num) {
                result.skipped_reason = 'Already designated patient 0';
              } else {
                // Target a random non-PV player for patient 0
                const validTargets = alivePlayers.filter(
                  p => p.role_code !== 'PV' && p.player_number !== bot.player_number
                );
                if (validTargets.length > 0) {
                  const targetNum = validTargets[Math.floor(Math.random() * validTargets.length)].player_number!;
                  
                  if (existingInput) {
                    inputsToUpdate.push({
                      player_num: bot.player_number,
                      updates: { pv_patient0_target_num: targetNum }
                    });
                  } else {
                    inputsToInsert.push({
                      game_id: gameId,
                      session_game_id: sessionGameId,
                      manche,
                      player_id: bot.id,
                      player_num: bot.player_number,
                      pv_patient0_target_num: targetNum,
                    });
                  }
                  result.action = 'PATIENT_0';
                  result.target = targetNum;
                  console.log(`[infection-bot-decisions] PV bot ${bot.player_number} designated patient 0: ${targetNum}`);
                } else {
                  result.skipped_reason = 'No valid target for patient 0';
                }
              }
              break;
            }

            // After manche 1: Check for antidote usage (configurable % when carrier)
            if (bot.is_carrier && Math.random() < (botConfig.pv_antidote_chance / 100)) {
              const antidote = playerInventory.find(i => 
                i.objet === 'Antidote PV' && i.quantite > 0
              );
              if (antidote) {
                // Use correct schema: pv_antidote_target_num
                if (existingInput) {
                  inputsToUpdate.push({
                    player_num: bot.player_number,
                    updates: { pv_antidote_target_num: bot.player_number }
                  });
                } else {
                  inputsToInsert.push({
                    game_id: gameId,
                    session_game_id: sessionGameId,
                    manche,
                    player_id: bot.id,
                    player_num: bot.player_number,
                    pv_antidote_target_num: bot.player_number,
                  });
                }
                inventoryUpdates.push({ id: antidote.id, quantite: antidote.quantite - 1 });
                result.action = 'ANTIDOTE';
                result.target = bot.player_number;
                break;
              }
            }

            // Check for shooting
            if (!shootersThisRound.has(bot.player_number)) {
              const bullets = playerInventory.find(i => i.objet === 'Balle PV');
              if (bullets && bullets.quantite > 0) {
                // Configurable % chance to shoot
                if (Math.random() < (botConfig.pv_shoot_chance / 100)) {
                  // Cannot target other PVs
                  const targetNum = getRandomTarget([bot.player_number, ...otherPVNums]);
                  if (targetNum) {
                    // Insert shot with correct schema: shooter_role instead of weapon_type
                    shotsToInsert.push({
                      game_id: gameId,
                      session_game_id: sessionGameId,
                      manche,
                      shooter_num: bot.player_number,
                      target_num: targetNum,
                      shooter_role: 'PV',
                      status: 'PENDING',
                    });
                    inventoryUpdates.push({ id: bullets.id, quantite: bullets.quantite - 1 });
                    result.action = 'SHOT';
                    result.target = targetNum;
                  }
                }
              }
            }
            break;
          }

          case 'SY': {
            // SY: ALL bots vote for the same target (coordinated)
            if (existingInput?.sy_research_target_num) {
              result.skipped_reason = 'Already submitted research';
              break;
            }

            if (syCoordinatedTarget) {
              // Use correct schema: sy_research_target_num
              if (existingInput) {
                inputsToUpdate.push({
                  player_num: bot.player_number,
                  updates: { sy_research_target_num: syCoordinatedTarget }
                });
              } else {
                inputsToInsert.push({
                  game_id: gameId,
                  session_game_id: sessionGameId,
                  manche,
                  player_id: bot.id,
                  player_num: bot.player_number,
                  sy_research_target_num: syCoordinatedTarget,
                });
              }
              result.action = 'RECHERCHE_SY';
              result.target = syCoordinatedTarget;
            } else {
              result.skipped_reason = 'No valid target for research';
            }
            break;
          }

          case 'AE': {
            // AE: ALWAYS tries to sabotage, success depends on probability
            // First check if already submitted this round
            if (existingInput?.ae_sabotage_target_num !== undefined && existingInput?.ae_sabotage_target_num !== null) {
              result.skipped_reason = 'Already submitted sabotage';
              break;
            }

            // AE ALWAYS submits a sabotage attempt targeting the BA
            if (!baPlayer) {
              result.skipped_reason = 'No BA player to sabotage';
              break;
            }

            // Determine if this sabotage attempt will be "successful" based on probability
            const sabotageChance = botMemory.ae_sabotage_count > 0 
              ? (botConfig.ae_sabotage_after_success / 100) 
              : (botConfig.ae_sabotage_base / 100);
            
            // AE always tries to identify the BA, success rate determines if they correctly identify
            const correctlyIdentifiesBA = Math.random() < sabotageChance;
            const targetNum = correctlyIdentifiesBA ? baPlayer.player_number : getRandomTarget([bot.player_number], ['AE']);

            if (targetNum) {
              // Use correct schema: ae_sabotage_target_num
              if (existingInput) {
                inputsToUpdate.push({
                  player_num: bot.player_number,
                  updates: { ae_sabotage_target_num: targetNum }
                });
              } else {
                inputsToInsert.push({
                  game_id: gameId,
                  session_game_id: sessionGameId,
                  manche,
                  player_id: bot.id,
                  player_num: bot.player_number,
                  ae_sabotage_target_num: targetNum,
                });
              }
              result.action = 'SABOTAGE';
              result.target = targetNum;
              
              if (correctlyIdentifiesBA) {
                console.log(`[infection-bot-decisions] AE bot ${bot.player_number} correctly identified BA ${targetNum}`);
              } else {
                console.log(`[infection-bot-decisions] AE bot ${bot.player_number} incorrectly targeted ${targetNum} (BA was ${baPlayer.player_number})`);
              }
            } else {
              result.skipped_reason = 'No valid sabotage target';
            }
            break;
          }

          case 'OC': {
            // OC: Use crystal ball to investigate a random non-OC player
            if (existingInput?.oc_lookup_target_num) {
              result.skipped_reason = 'Already used oracle';
              break;
            }

            const crystalBall = playerInventory.find(i => i.objet === 'Boule de cristal');
            if (!crystalBall || crystalBall.quantite < 1) {
              result.skipped_reason = 'No crystal ball';
              break;
            }

            // Filter out self, other OCs, and already-discovered PVs
            const validTargets = alivePlayers.filter(
              p => p.role_code !== 'OC' && 
                   p.player_number !== bot.player_number &&
                   !botMemory.oc_pv_targets.includes(p.player_number!)
            );

            if (validTargets.length === 0) {
              result.skipped_reason = 'No valid target for oracle';
              break;
            }

            // Random target among all valid players (bots and humans equally)
            const targetNum = validTargets[Math.floor(Math.random() * validTargets.length)].player_number!;

            // Use correct schema: oc_lookup_target_num
            if (existingInput) {
              inputsToUpdate.push({
                player_num: bot.player_number,
                updates: { oc_lookup_target_num: targetNum }
              });
            } else {
              inputsToInsert.push({
                game_id: gameId,
                session_game_id: sessionGameId,
                manche,
                player_id: bot.id,
                player_num: bot.player_number,
                oc_lookup_target_num: targetNum,
              });
            }
            inventoryUpdates.push({ id: crystalBall.id, quantite: crystalBall.quantite - 1 });
            result.action = 'ORACLE';
            result.target = targetNum;
            break;
          }

          case 'CV':
          case 'KK':
          default: {
            // CV/KK/other: Attempt to corrupt AE if sabotage happened 2+ times
            if (botMemory.ae_sabotage_count >= 2) {
              const aePlayer = alivePlayers.find(p => p.role_code === 'AE');
              if (aePlayer && bot.jetons >= botConfig.corruption_min) {
                // Check if already submitted corruption
                const alreadyCorrupted = existingInput?.corruption_amount && existingInput.corruption_amount > 0;
                if (!alreadyCorrupted) {
                  // Corruption amount: configurable range
                  const maxCorruption = Math.min(botConfig.corruption_max, bot.jetons);
                  const minCorruption = botConfig.corruption_min;
                  const corruptionAmount = Math.floor(Math.random() * (maxCorruption - minCorruption + 1)) + minCorruption;

                  // Use correct schema: corruption_amount
                  if (existingInput) {
                    inputsToUpdate.push({
                      player_num: bot.player_number,
                      updates: { corruption_amount: corruptionAmount }
                    });
                  } else {
                    inputsToInsert.push({
                      game_id: gameId,
                      session_game_id: sessionGameId,
                      manche,
                      player_id: bot.id,
                      player_num: bot.player_number,
                      corruption_amount: corruptionAmount,
                    });
                  }
                  result.action = 'CORRUPTION';
                  result.target = aePlayer.player_number!;
                  result.amount = corruptionAmount;
                  result.corruption_paid = corruptionAmount;
                } else {
                  result.skipped_reason = 'Already submitted corruption';
                }
              } else {
                result.skipped_reason = 'No AE to corrupt or insufficient tokens';
              }
            } else {
              result.skipped_reason = 'No action needed (CV/KK passive or no role)';
            }
            break;
          }
        }
      } catch (err) {
        console.error(`[infection-bot-decisions] Error processing bot ${bot.player_number}:`, err);
        result.skipped_reason = `Error: ${err instanceof Error ? err.message : 'Unknown'}`;
      }

      // Ensure ALL bots get an infection_inputs entry for validation tracking
      // Check if this bot already has an input or one is being created
      const hasInputCreated = inputsToInsert.some(i => i.player_num === bot.player_number);
      const hasInputUpdated = inputsToUpdate.some(i => i.player_num === bot.player_number);
      
      if (!existingInput && !hasInputCreated && !hasInputUpdated) {
        // Create a validation entry for this bot (no action, just marks as validated)
        inputsToInsert.push({
          game_id: gameId,
          session_game_id: sessionGameId,
          manche,
          player_id: bot.id,
          player_num: bot.player_number,
        });
        console.log(`[infection-bot-decisions] Created validation entry for bot ${bot.player_number} (${bot.role_code || 'no role'})`);
      }

      results.push(result);
    }

    // Insert all new inputs
    if (inputsToInsert.length > 0) {
      const { error: inputError } = await supabase
        .from('infection_inputs')
        .insert(inputsToInsert);
      if (inputError) {
        console.error('[infection-bot-decisions] Error inserting inputs:', inputError);
      }
    }

    // Update existing inputs
    for (const { player_num, updates } of inputsToUpdate) {
      const { error: updateError } = await supabase
        .from('infection_inputs')
        .update(updates)
        .eq('session_game_id', sessionGameId)
        .eq('manche', manche)
        .eq('player_num', player_num);
      if (updateError) {
        console.error(`[infection-bot-decisions] Error updating input for player ${player_num}:`, updateError);
      }
    }

    // Insert all shots
    if (shotsToInsert.length > 0) {
      const { error: shotError } = await supabase
        .from('infection_shots')
        .insert(shotsToInsert);
      if (shotError) {
        console.error('[infection-bot-decisions] Error inserting shots:', shotError);
      }
    }

    // Update inventory
    for (const update of inventoryUpdates) {
      await supabase
        .from('inventory')
        .update({ quantite: update.quantite })
        .eq('id', update.id);
    }

    // Log bot decisions
    await supabase.from('logs_mj').insert({
      game_id: gameId,
      session_game_id: sessionGameId,
      manche,
      action: 'BOT_DECISIONS',
      details: JSON.stringify({
        bots_processed: bots.length,
        inputs_created: inputsToInsert.length,
        inputs_updated: inputsToUpdate.length,
        shots_created: shotsToInsert.length,
        results,
      }),
    });

    console.log('[infection-bot-decisions] Completed:', {
      bots_processed: bots.length,
      inputs_created: inputsToInsert.length,
      inputs_updated: inputsToUpdate.length,
      shots_created: shotsToInsert.length,
    });

    return new Response(
      JSON.stringify({
        success: true,
        decisions_made: inputsToInsert.length + inputsToUpdate.length + shotsToInsert.length,
        bots_processed: bots.length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[infection-bot-decisions] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
