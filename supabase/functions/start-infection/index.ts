import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RoleConfig {
  BA: number;
  PV: number;
  SY: number;
  AE: number;
  OC: number;
  KK: number;
  CV: number;
}

interface StartInfectionRequest {
  gameId: string;
  sessionGameId: string;
  roleConfig?: Partial<RoleConfig>;
  startingTokens?: number;
  preAssignedRoles?: Record<string, string>; // playerId -> roleCode
}

// Role to team mapping
const ROLE_TO_TEAM: Record<string, string> = {
  BA: 'NEUTRE',
  PV: 'PV',
  SY: 'SY',
  AE: 'NEUTRE',
  OC: 'NEUTRE',
  KK: 'NEUTRE',
  CV: 'CITOYEN',
};

// Shuffle array (Fisher-Yates)
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Retry helper with exponential backoff
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 500
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`[start-infection] Attempt ${attempt + 1} failed:`, lastError.message);
      if (attempt < maxRetries - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { gameId, sessionGameId, roleConfig, startingTokens, preAssignedRoles }: StartInfectionRequest = await req.json();

    console.log('[start-infection] Starting with:', { gameId, sessionGameId, roleConfig, startingTokens, preAssignedRoles: preAssignedRoles ? Object.keys(preAssignedRoles).length : 0 });

    // 1. Fetch active players (with player_number assigned) - with retry
    const playersRaw = await withRetry(async () => {
      const result = await supabase
        .from('game_players')
        .select('id, player_number, display_name, clan, jetons')
        .eq('game_id', gameId)
        .is('removed_at', null)
        .not('player_number', 'is', null)
        .order('player_number', { ascending: true });
      
      if (result.error) {
        throw new Error(`Failed to fetch players: ${result.error.message}`);
      }
      return result.data;
    });

    const players = playersRaw || [];

    if (players.length < 7) {
      throw new Error(`Not enough players. Need at least 7, got ${players.length}`);
    }

    const playerCount = players.length;
    console.log('[start-infection] Player count:', playerCount);

    // 2. Calculate role distribution based on player count
    // MINIMUM 7 players. Distribution ensures at least 1 CV for antibodies.
    // 7 players:  BA=1, PV=2, SY=2, OC=1, CV=1 (no AE, no KK)
    // 8 players:  BA=1, PV=2, SY=2, OC=1, KK=1, CV=1 (no AE)
    // 9+ players: BA=1, PV=2, SY=2, AE=1, OC=1, KK=1, CV=remaining
    let defaultRoleConfig: RoleConfig;
    
    if (playerCount === 7) {
      // 7 players: BA=1, PV=2, SY=2, OC=1, CV=1 (no AE, no KK)
      defaultRoleConfig = {
        BA: 1,
        PV: 2,
        SY: 2,
        AE: 0,
        OC: 1,
        KK: 0,
        CV: 1,
      };
    } else if (playerCount === 8) {
      // 8 players: BA=1, PV=2, SY=2, OC=1, KK=1, CV=1 (no AE)
      defaultRoleConfig = {
        BA: 1,
        PV: 2,
        SY: 2,
        AE: 0,
        OC: 1,
        KK: 1,
        CV: 1,
      };
    } else {
      // 9+ players: full distribution with AE
      defaultRoleConfig = {
        BA: 1,
        PV: 2,
        SY: 2,
        AE: 1,
        OC: 1,
        KK: 1,
        CV: playerCount - 8, // Remaining are CV
      };
    }

    const finalRoleConfig: RoleConfig = {
      ...defaultRoleConfig,
      ...roleConfig,
    };

    // Validate total roles = player count and adjust if needed
    const totalRoles = Object.values(finalRoleConfig).reduce((a, b) => a + b, 0);
    if (totalRoles !== playerCount) {
      finalRoleConfig.CV = Math.max(0, playerCount - (totalRoles - finalRoleConfig.CV));
    }
    
    // Safety check: ensure at least 1 CV for antibodies
    if (finalRoleConfig.CV < 1) {
      console.warn('[start-infection] Warning: No CV players - adjusting');
      // Reduce KK or AE to make room for CV
      if (finalRoleConfig.KK > 0) {
        finalRoleConfig.KK--;
        finalRoleConfig.CV++;
      } else if (finalRoleConfig.AE > 0) {
        finalRoleConfig.AE--;
        finalRoleConfig.CV++;
      }
    }

    console.log('[start-infection] Role config:', finalRoleConfig);

    // 3. Build role list and shuffle (considering pre-assigned roles)
    const preAssigned = preAssignedRoles || {};
    
    // Count pre-assigned roles to adjust remaining pool
    const preAssignedCounts: Record<string, number> = {};
    for (const roleCode of Object.values(preAssigned)) {
      preAssignedCounts[roleCode] = (preAssignedCounts[roleCode] || 0) + 1;
    }
    
    // Calculate remaining roles after pre-assignments
    const remainingRoleCounts: Record<string, number> = {};
    for (const [role, count] of Object.entries(finalRoleConfig)) {
      const preAssignedCount = preAssignedCounts[role] || 0;
      remainingRoleCounts[role] = Math.max(0, count - preAssignedCount);
    }
    
    // Build remaining roles pool
    const remainingRoles: string[] = [];
    for (const [role, count] of Object.entries(remainingRoleCounts)) {
      for (let i = 0; i < count; i++) {
        remainingRoles.push(role);
      }
    }
    const shuffledRemainingRoles = shuffleArray(remainingRoles);

    console.log('[start-infection] Pre-assigned counts:', preAssignedCounts);
    console.log('[start-infection] Remaining roles to assign:', shuffledRemainingRoles);

    // 4. Get starting tokens
    const { data: gameData } = await supabase
      .from('games')
      .select('starting_tokens')
      .eq('id', gameId)
      .single();

    const tokens = startingTokens || gameData?.starting_tokens || 50;

    // 5. Assign roles to players (respecting pre-assignments) and prepare updates
    let remainingRoleIndex = 0;
    const playerUpdates = players.map((player) => {
      // Check if this player has a pre-assigned role
      const preAssignedRole = preAssigned[player.id];
      const role = preAssignedRole || shuffledRemainingRoles[remainingRoleIndex++];
      const team = ROLE_TO_TEAM[role] || 'CITOYEN';
      
      // Royaux clan bonus: 1.5x starting tokens
      const playerTokens = player.clan === 'Royaux' 
        ? Math.floor(tokens * 1.5) 
        : tokens;
      
      return {
        id: player.id,
        role_code: role,
        team_code: team,
        jetons: playerTokens,
        pvic: 0,
        is_alive: true,
        immune_permanent: false,
        is_carrier: false,
        is_contagious: false,
        infected_at_manche: null,
        will_contaminate_at_manche: null,
        will_die_at_manche: null,
        has_antibodies: false,
        was_pre_assigned: !!preAssignedRole,
      };
    });

    // 6. Select random CV player for antibodies
    const cvPlayers = playerUpdates.filter(p => p.role_code === 'CV');
    if (cvPlayers.length > 0) {
      const randomCvIndex = Math.floor(Math.random() * cvPlayers.length);
      cvPlayers[randomCvIndex].has_antibodies = true;
      console.log('[start-infection] Antibodies assigned to player:', cvPlayers[randomCvIndex].id);
    }

    // 7. Update all players with roles
    for (const update of playerUpdates) {
      const { error: updateError } = await supabase
        .from('game_players')
        .update({
          role_code: update.role_code,
          team_code: update.team_code,
          jetons: update.jetons,
          pvic: update.pvic,
          is_alive: update.is_alive,
          immune_permanent: update.immune_permanent,
          is_carrier: update.is_carrier,
          is_contagious: update.is_contagious,
          infected_at_manche: update.infected_at_manche,
          will_contaminate_at_manche: update.will_contaminate_at_manche,
          will_die_at_manche: update.will_die_at_manche,
          has_antibodies: update.has_antibodies,
        })
        .eq('id', update.id);

      if (updateError) {
        console.error('[start-infection] Error updating player:', update.id, updateError);
        throw new Error(`Failed to update player ${update.id}: ${updateError.message}`);
      }
    }

    console.log('[start-infection] All players updated with roles');

    // 8. Create starting inventories
    const inventoryItems: Array<{
      game_id: string;
      session_game_id: string;
      owner_num: number;
      objet: string;
      quantite: number;
      disponible: boolean;
      dispo_attaque: boolean;
    }> = [];

    for (const player of players) {
      const playerUpdate = playerUpdates.find(p => p.id === player.id);
      if (!playerUpdate) continue;

      const role = playerUpdate.role_code;
      const playerNum = player.player_number!;

      // Role-specific items
      switch (role) {
        case 'BA':
          // BA starts with 1 bullet (max 2 total)
          inventoryItems.push({
            game_id: gameId,
            session_game_id: sessionGameId,
            owner_num: playerNum,
            objet: 'Balle BA',
            quantite: 1,
            disponible: true,
            dispo_attaque: true,
          });
          break;

        case 'PV':
          // PV gets 1 bullet for the entire game
          inventoryItems.push({
            game_id: gameId,
            session_game_id: sessionGameId,
            owner_num: playerNum,
            objet: 'Balle PV',
            quantite: 1,
            disponible: true,
            dispo_attaque: true,
          });
          // PV gets 1 antidote for the entire game
          inventoryItems.push({
            game_id: gameId,
            session_game_id: sessionGameId,
            owner_num: playerNum,
            objet: 'Antidote PV',
            quantite: 1,
            disponible: true,
            dispo_attaque: false,
          });
          break;

        case 'OC':
          // OC gets 1 crystal ball per round (starts with 1)
          inventoryItems.push({
            game_id: gameId,
            session_game_id: sessionGameId,
            owner_num: playerNum,
            objet: 'Boule de cristal',
            quantite: 1,
            disponible: true,
            dispo_attaque: false,
          });
          break;
      }

      // Ezkar clan bonus: +1 Antidote + 1 Gilet
      if (player.clan === 'Ezkar') {
        inventoryItems.push({
          game_id: gameId,
          session_game_id: sessionGameId,
          owner_num: playerNum,
          objet: 'Antidote Ezkar',
          quantite: 1,
          disponible: true,
          dispo_attaque: false,
        });
        inventoryItems.push({
          game_id: gameId,
          session_game_id: sessionGameId,
          owner_num: playerNum,
          objet: 'Gilet',
          quantite: 1,
          disponible: true,
          dispo_attaque: false,
        });
      }
    }

    // Create shared PV venin item (team-level, no owner)
    inventoryItems.push({
      game_id: gameId,
      session_game_id: sessionGameId,
      owner_num: 0, // Team item
      objet: 'Dose de venin PV',
      quantite: 1,
      disponible: true,
      dispo_attaque: false,
    });

    if (inventoryItems.length > 0) {
      const { error: inventoryError } = await supabase
        .from('inventory')
        .insert(inventoryItems);

      if (inventoryError) {
        console.error('[start-infection] Error creating inventory:', inventoryError);
        throw new Error(`Failed to create inventory: ${inventoryError.message}`);
      }
    }

    console.log('[start-infection] Inventory created:', inventoryItems.length, 'items');

    // 9. Create first round state (manche 1, OPEN)
    const syCount = playerUpdates.filter(p => p.role_code === 'SY').length;
    const syRequiredSuccess = syCount >= 2 ? 2 : 3;

    const { error: roundError } = await supabase
      .from('infection_round_state')
      .insert({
        game_id: gameId,
        session_game_id: sessionGameId,
        manche: 1,
        status: 'OPEN',
        sy_success_count: 0,
        sy_required_success: syRequiredSuccess,
        opened_at: new Date().toISOString(),
      });

    if (roundError) {
      console.error('[start-infection] Error creating round state:', roundError);
      throw new Error(`Failed to create round state: ${roundError.message}`);
    }

    console.log('[start-infection] Round 1 created (OPEN)');

    // 10. Update session_game status
    const { error: sessionError } = await supabase
      .from('session_games')
      .update({
        status: 'RUNNING',
        started_at: new Date().toISOString(),
        manche_active: 1,
        phase: 'OPEN',
      })
      .eq('id', sessionGameId);

    if (sessionError) {
      console.error('[start-infection] Error updating session_game:', sessionError);
      throw new Error(`Failed to update session_game: ${sessionError.message}`);
    }

    // 11. Update game status
    const { error: gameError } = await supabase
      .from('games')
      .update({
        status: 'IN_GAME',
        manche_active: 1,
        phase: 'OPEN',
      })
      .eq('id', gameId);

    if (gameError) {
      console.error('[start-infection] Error updating game:', gameError);
      throw new Error(`Failed to update game: ${gameError.message}`);
    }

    // 12. Log game start event
    const { error: eventError } = await supabase
      .from('game_events')
      .insert({
        game_id: gameId,
        session_game_id: sessionGameId,
        event_type: 'GAME_START',
        message: `La partie INFECTION commence avec ${playerCount} joueurs. Manche 1 ouverte.`,
        manche: 1,
        phase: 'OPEN',
        visibility: 'PUBLIC',
        payload: {
          player_count: playerCount,
          role_distribution: finalRoleConfig,
        },
      });

    if (eventError) {
      console.error('[start-infection] Error logging event:', eventError);
    }

    // 13. Log MJ details
    const roleAssignments = playerUpdates.map(p => {
      const player = players.find(pl => pl.id === p.id);
      return {
        num: player?.player_number,
        name: player?.display_name,
        role: p.role_code,
        team: p.team_code,
        has_antibodies: p.has_antibodies,
      };
    });

    const { error: mjLogError } = await supabase
      .from('logs_mj')
      .insert({
        game_id: gameId,
        session_game_id: sessionGameId,
        action: 'GAME_START',
        manche: 1,
        details: JSON.stringify({
          role_distribution: finalRoleConfig,
          role_assignments: roleAssignments,
          starting_tokens: tokens,
          sy_required_success: syRequiredSuccess,
        }),
      });

    if (mjLogError) {
      console.error('[start-infection] Error logging MJ details:', mjLogError);
    }

    // 14. Send private message to Ezkar+KK players about disabled vest
    const ezkarKKPlayers = playerUpdates.filter((p, idx) => {
      const player = players[idx];
      return p.role_code === 'KK' && player?.clan === 'Ezkar';
    });

    for (const ezkarKK of ezkarKKPlayers) {
      const player = players.find(pl => pl.id === ezkarKK.id);
      if (player) {
        await supabase.from('game_events').insert({
          game_id: gameId,
          session_game_id: sessionGameId,
          event_type: 'PRIVATE_INFO',
          message: `⚠️ Attention ${player.display_name}: En tant que membre du clan Ezkar avec le rôle Sans Cercle (KK), ton gilet pare-balles est INOPÉRANT. Tu mourras au premier tir. Cependant, tu peux toujours utiliser ton antidote Ezkar à tout moment.`,
          manche: 1,
          phase: 'OPEN',
          visibility: 'PRIVATE',
          player_id: ezkarKK.id,
          player_num: player.player_number,
          payload: {
            type: 'EZKAR_KK_VEST_WARNING',
            affected_player: player.player_number,
          },
        });
        console.log('[start-infection] Sent Ezkar+KK vest warning to player:', player.player_number);
      }
    }

    console.log('[start-infection] Game started successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'INFECTION game started successfully',
        data: {
          playerCount,
          roleDistribution: finalRoleConfig,
          startingTokens: tokens,
          mancheActive: 1,
          syRequiredSuccess,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[start-infection] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
