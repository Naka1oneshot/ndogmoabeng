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
}

interface RoundState {
  id: string;
  manche: number;
  status: string;
  sy_success_count: number;
  sy_required_success: number;
}

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

    // Fetch existing inputs this round (to avoid duplicates)
    const { data: existingInputs } = await supabase
      .from('infection_inputs')
      .select('player_num, action_type')
      .eq('session_game_id', sessionGameId)
      .eq('manche', manche);

    const existingInputsSet = new Set(
      (existingInputs || []).map(i => `${i.player_num}-${i.action_type}`)
    );

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

    // Helper: get human SY vote target for research
    function getHumanSYResearchTarget(): number | null {
      const humanSY = humanPlayers.find(p => p.role_code === 'SY' && p.is_alive !== false);
      if (!humanSY) return null;

      // Check if human SY has submitted a research input
      const humanResearch = existingInputs?.find(
        i => i.player_num === humanSY.player_number && i.action_type === 'RECHERCHE_SY'
      );
      return null; // We'd need to fetch the actual target - for now bots will pick randomly
    }

    // Process each bot based on role
    for (const bot of bots) {
      const result: BotDecisionResult = {
        player_number: bot.player_number,
        display_name: bot.display_name,
        role_code: bot.role_code,
      };

      const playerInventory = inventory.filter(i => i.owner_num === bot.player_number);

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

            if (Math.random() > 0.9) {
              result.skipped_reason = 'Chose not to shoot (10% chance)';
              break;
            }

            // Target selection with OC-discovered PV priority
            let targetNum: number | null = null;
            const knownPVs = botMemory.oc_pv_targets.filter(num => 
              alivePlayers.some(p => p.player_number === num)
            );

            if (knownPVs.length > 0) {
              // Calculate chance based on how long PV has been known
              const basePVChance = 0.4 + (manche - 1) * 0.1; // 40% + 10% per additional round
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

            shotsToInsert.push({
              game_id: gameId,
              session_game_id: sessionGameId,
              manche,
              shooter_num: bot.player_number,
              target_num: targetNum,
              weapon_type: 'Balle BA',
              status: 'PENDING',
            });

            inventoryUpdates.push({ id: bullets.id, quantite: bullets.quantite - 1 });
            result.action = 'SHOT';
            result.target = targetNum;
            break;
          }

          case 'PV': {
            // PV: Cannot shoot other PVs, 80% chance to use antidote when carrier
            const otherPVs = players.filter(p => p.role_code === 'PV' && p.player_number !== bot.player_number);
            const otherPVNums = otherPVs.map(p => p.player_number!);

            // Check for antidote usage (80% when carrier)
            if (bot.is_carrier && Math.random() < 0.8) {
              const antidote = playerInventory.find(i => 
                i.objet === 'Antidote PV' && i.quantite > 0
              );
              if (antidote) {
                inputsToInsert.push({
                  game_id: gameId,
                  session_game_id: sessionGameId,
                  manche,
                  player_num: bot.player_number,
                  action_type: 'ANTIDOTE',
                  target_num: bot.player_number,
                });
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
                // 70% chance to shoot (more conservative than BA)
                if (Math.random() < 0.7) {
                  // Cannot target other PVs
                  const targetNum = getRandomTarget([bot.player_number, ...otherPVNums]);
                  if (targetNum) {
                    shotsToInsert.push({
                      game_id: gameId,
                      session_game_id: sessionGameId,
                      manche,
                      shooter_num: bot.player_number,
                      target_num: targetNum,
                      weapon_type: 'Balle PV',
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
            // SY: Vote together, priority to human SY vote
            if (existingInputsSet.has(`${bot.player_number}-RECHERCHE_SY`)) {
              result.skipped_reason = 'Already submitted research';
              break;
            }

            // Find human SY's vote first
            const humanSYs = humanPlayers.filter(p => p.role_code === 'SY');
            let targetNum: number | null = null;

            // Check if any human SY has submitted
            for (const humanSY of humanSYs) {
              const humanInput = await supabase
                .from('infection_inputs')
                .select('target_num')
                .eq('session_game_id', sessionGameId)
                .eq('manche', manche)
                .eq('player_num', humanSY.player_number)
                .eq('action_type', 'RECHERCHE_SY')
                .maybeSingle();

              if (humanInput.data?.target_num) {
                targetNum = humanInput.data.target_num;
                break;
              }
            }

            // If no human SY vote, pick a random non-SY target (prioritize non-bots)
            if (!targetNum) {
              const nonSYPlayers = alivePlayers.filter(p => p.role_code !== 'SY');
              const humanNonSY = nonSYPlayers.filter(p => !p.is_bot);
              const pool = humanNonSY.length > 0 ? humanNonSY : nonSYPlayers;
              if (pool.length > 0) {
                targetNum = pool[Math.floor(Math.random() * pool.length)].player_number!;
              }
            }

            if (targetNum) {
              inputsToInsert.push({
                game_id: gameId,
                session_game_id: sessionGameId,
                manche,
                player_num: bot.player_number,
                action_type: 'RECHERCHE_SY',
                target_num: targetNum,
              });
              result.action = 'RECHERCHE_SY';
              result.target = targetNum;
            } else {
              result.skipped_reason = 'No valid target for research';
            }
            break;
          }

          case 'AE': {
            // AE: 40% chance to sabotage BA, 90% if successful before
            if (existingInputsSet.has(`${bot.player_number}-SABOTAGE`)) {
              result.skipped_reason = 'Already submitted sabotage';
              break;
            }

            const sabotageChance = botMemory.ae_sabotage_count > 0 ? 0.9 : 0.4;
            if (Math.random() < sabotageChance) {
              inputsToInsert.push({
                game_id: gameId,
                session_game_id: sessionGameId,
                manche,
                player_num: bot.player_number,
                action_type: 'SABOTAGE',
                target_num: null,
                amount: null,
              });
              result.action = 'SABOTAGE';
            } else {
              result.skipped_reason = `Chose not to sabotage (${Math.round((1 - sabotageChance) * 100)}% chance)`;
            }
            break;
          }

          case 'OC': {
            // OC: Use crystal ball to investigate a random non-OC player
            if (existingInputsSet.has(`${bot.player_number}-ORACLE`)) {
              result.skipped_reason = 'Already used oracle';
              break;
            }

            const crystalBall = playerInventory.find(i => i.objet === 'Boule de cristal');
            if (!crystalBall || crystalBall.quantite < 1) {
              result.skipped_reason = 'No crystal ball';
              break;
            }

            // Pick a random non-OC alive player (prioritize humans, avoid already-investigated)
            const nonOCPlayers = alivePlayers.filter(
              p => p.role_code !== 'OC' && !botMemory.oc_pv_targets.includes(p.player_number!)
            );
            const humanNonOC = nonOCPlayers.filter(p => !p.is_bot);
            const pool = humanNonOC.length > 0 ? humanNonOC : nonOCPlayers;

            if (pool.length === 0) {
              result.skipped_reason = 'No valid target for oracle';
              break;
            }

            const targetNum = pool[Math.floor(Math.random() * pool.length)].player_number!;
            inputsToInsert.push({
              game_id: gameId,
              session_game_id: sessionGameId,
              manche,
              player_num: bot.player_number,
              action_type: 'ORACLE',
              target_num: targetNum,
            });
            inventoryUpdates.push({ id: crystalBall.id, quantite: crystalBall.quantite - 1 });
            result.action = 'ORACLE';
            result.target = targetNum;
            break;
          }

          case 'CV':
          case 'KK':
          default: {
            // CV/KK/other: Attempt to corrupt AE if sabotage happened 2+ times
            if (botMemory.ae_sabotage_count >= 2 && !existingInputsSet.has(`${bot.player_number}-CORRUPTION`)) {
              const aePlayer = alivePlayers.find(p => p.role_code === 'AE');
              if (aePlayer && bot.jetons >= 2) {
                // Corruption amount: 2-10 tokens
                const maxCorruption = Math.min(10, bot.jetons);
                const corruptionAmount = Math.floor(Math.random() * (maxCorruption - 2 + 1)) + 2;

                inputsToInsert.push({
                  game_id: gameId,
                  session_game_id: sessionGameId,
                  manche,
                  player_num: bot.player_number,
                  action_type: 'CORRUPTION',
                  target_num: aePlayer.player_number,
                  amount: corruptionAmount,
                });
                result.action = 'CORRUPTION';
                result.target = aePlayer.player_number!;
                result.amount = corruptionAmount;
              } else {
                result.skipped_reason = 'No AE to corrupt or insufficient tokens';
              }
            } else {
              result.skipped_reason = 'No action needed (CV/KK passive) or AE not corrupted enough';
            }
            break;
          }
        }
      } catch (err) {
        console.error(`[infection-bot-decisions] Error processing bot ${bot.player_number}:`, err);
        result.skipped_reason = `Error: ${err instanceof Error ? err.message : 'Unknown'}`;
      }

      results.push(result);
    }

    // Insert all inputs
    if (inputsToInsert.length > 0) {
      const { error: inputError } = await supabase
        .from('infection_inputs')
        .insert(inputsToInsert);
      if (inputError) {
        console.error('[infection-bot-decisions] Error inserting inputs:', inputError);
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
        shots_created: shotsToInsert.length,
        results,
      }),
    });

    console.log('[infection-bot-decisions] Completed:', {
      bots_processed: bots.length,
      inputs_created: inputsToInsert.length,
      shots_created: shotsToInsert.length,
    });

    return new Response(
      JSON.stringify({
        success: true,
        decisions_made: inputsToInsert.length + shotsToInsert.length,
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
