import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { gameId } = await req.json();
    
    if (!gameId) {
      return new Response(
        JSON.stringify({ success: false, error: 'gameId requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Non autorisé' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Non autorisé' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get game and verify host
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('*, current_session_game_id')
      .eq('id', gameId)
      .single();

    if (gameError || !game) {
      return new Response(
        JSON.stringify({ success: false, error: 'Partie non trouvée' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (game.host_user_id !== user.id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Non autorisé - vous n\'êtes pas l\'hôte' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify phase
    if (game.phase !== 'PHASE2_POSITIONS') {
      return new Response(
        JSON.stringify({ success: false, error: 'Cette action n\'est disponible qu\'en Phase 2' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const manche = game.manche_active;
    const sessionGameId = game.current_session_game_id;

    // Check if positions already published (idempotence)
    let existingQuery = supabase
      .from('positions_finales')
      .select('id')
      .eq('game_id', gameId)
      .eq('manche', manche)
      .limit(1);
    
    if (sessionGameId) {
      existingQuery = existingQuery.eq('session_game_id', sessionGameId);
    }
    
    const { data: existingPositions } = await existingQuery;

    if (existingPositions && existingPositions.length > 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Positions déjà publiées pour cette manche' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get ACTIVE players count - this is our N (source of truth)
    const { data: activePlayers, error: playersError } = await supabase
      .from('game_players')
      .select('player_number, display_name, clan, jetons, is_bot')
      .eq('game_id', gameId)
      .eq('is_host', false)
      .in('status', ['ACTIVE', 'IN_GAME']);

    if (playersError) {
      console.error('[publish-positions] Error fetching players:', playersError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erreur lors de la récupération des joueurs' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // N = actual active player count (NOT x_nb_joueurs or max_players)
    const N = activePlayers?.length || 0;
    
    if (N === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Aucun joueur actif dans la partie' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[publish-positions] N = ${N} active players, session_game_id: ${sessionGameId}`);

    // Generate random actions for bots
    const botPlayers = activePlayers?.filter(p => p.is_bot) || [];
    if (botPlayers.length > 0) {
      console.log(`[publish-positions] Generating random actions for ${botPlayers.length} bots`);
      
      // Get existing actions to avoid duplicates
      const { data: existingActions } = await supabase
        .from('actions')
        .select('num_joueur')
        .eq('game_id', gameId)
        .eq('manche', manche);
      
      const existingActionNums = new Set((existingActions || []).map(a => a.num_joueur));
      
      // Get player inventory for possible attack items
      for (const bot of botPlayers) {
        if (existingActionNums.has(bot.player_number)) {
          console.log(`[publish-positions] Bot ${bot.display_name} already has action, skipping`);
          continue;
        }
        
        // Get bot inventory
        const { data: inventory } = await supabase
          .from('inventory')
          .select('objet, disponible, dispo_attaque')
          .eq('game_id', gameId)
          .eq('owner_num', bot.player_number)
          .eq('disponible', true);
        
        const attackItems = (inventory || []).filter(i => i.dispo_attaque);
        const protectionItems = (inventory || []).filter(i => !i.dispo_attaque);
        
        // Random position (1 to N)
        const randomPosition = Math.floor(Math.random() * N) + 1;
        
        // Random attack slot (1 to 3) - targeting monsters
        const randomSlotAttaque = Math.floor(Math.random() * 3) + 1;
        
        // Pick random attack item - ALWAYS attack if possible
        let attaque1 = null;
        if (attackItems.length > 0) {
          // Always use an attack item if available
          const randomIndex = Math.floor(Math.random() * attackItems.length);
          attaque1 = attackItems[randomIndex].objet;
        }
        
        // Pick random protection item if available
        let protection = null;
        let slotProtection = null;
        if (protectionItems.length > 0 && Math.random() > 0.5) { // 50% chance to use protection
          const randomIndex = Math.floor(Math.random() * protectionItems.length);
          protection = protectionItems[randomIndex].objet;
          slotProtection = Math.floor(Math.random() * 3) + 1;
        }
        
        await supabase.from('actions').insert({
          game_id: gameId,
          session_game_id: sessionGameId,
          manche,
          num_joueur: bot.player_number,
          position_souhaitee: randomPosition,
          slot_attaque: randomSlotAttaque,
          attaque1: attaque1,
          attaque2: null,
          protection_objet: protection,
          slot_protection: slotProtection,
        });
        
        console.log(`[publish-positions] Bot ${bot.display_name}: pos=${randomPosition}, slot=${randomSlotAttaque}, atk=${attaque1 || 'none'}, prot=${protection || 'none'}`);
      }
    }

    // Get priority rankings (order from Phase 1)
    let rankingsQuery = supabase
      .from('priority_rankings')
      .select('*')
      .eq('game_id', gameId)
      .eq('manche', manche)
      .order('rank', { ascending: true });
    
    if (sessionGameId) {
      rankingsQuery = rankingsQuery.eq('session_game_id', sessionGameId);
    }
    
    const { data: rankings, error: rankingsError } = await rankingsQuery;

    if (rankingsError || !rankings || rankings.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Aucun classement de priorité trouvé. Assurez-vous que la Phase 1 a été clôturée.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get actions for this round - don't filter by session_game_id for backward compatibility
    // Actions might have null session_game_id even when game has one
    const { data: actions, error: actionsError } = await supabase
      .from('actions')
      .select('*')
      .eq('game_id', gameId)
      .eq('manche', manche);

    if (actionsError) {
      console.error('[publish-positions] Error fetching actions:', actionsError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erreur lors de la récupération des actions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const playerMap = new Map(activePlayers?.map(p => [p.player_number, p]) || []);
    const actionMap = new Map(actions?.map(a => [a.num_joueur, a]) || []);

    // Track occupied positions - only positions 1..N are valid
    const occupiedPositions = new Set<number>();
    const positionsFinales: Array<{
      game_id: string;
      session_game_id: string | null;
      manche: number;
      rang_priorite: number;
      num_joueur: number;
      nom: string | null;
      clan: string | null;
      mise: number | null;
      position_souhaitee: number | null;
      position_finale: number;
      slot_attaque: number | null;
      attaque1: string | null;
      attaque2: string | null;
      protection: string | null;
      slot_protection: number | null;
    }> = [];

    // Process players in priority order
    for (const ranking of rankings) {
      const numJoueur = ranking.num_joueur;
      const player = playerMap.get(numJoueur);
      const action = actionMap.get(numJoueur);
      
      // Skip if player is no longer active
      if (!player) {
        console.log(`[publish-positions] Skipping player ${numJoueur} - not in active players`);
        continue;
      }
      
      let positionSouhaitee = action?.position_souhaitee || null;
      let positionFinale: number = -1;

      // Validate position_souhaitee is within 1..N
      const isValidDesired = positionSouhaitee !== null && 
                             positionSouhaitee >= 1 && 
                             positionSouhaitee <= N;

      if (isValidDesired && !occupiedPositions.has(positionSouhaitee!)) {
        // Desired position is valid and available
        positionFinale = positionSouhaitee!;
      } else {
        // Find next available position
        // If desired is valid but taken, start from desired+1, wrap around
        // If desired is invalid, start from 1
        const startPos = isValidDesired ? positionSouhaitee! : 1;
        
        // Try from startPos to N
        for (let i = startPos; i <= N; i++) {
          if (!occupiedPositions.has(i)) {
            positionFinale = i;
            break;
          }
        }
        // If not found, try from 1 to startPos-1 (wrap around)
        if (positionFinale === -1) {
          for (let i = 1; i < startPos; i++) {
            if (!occupiedPositions.has(i)) {
              positionFinale = i;
              break;
            }
          }
        }
      }

      // This should never happen if N >= number of players being processed
      if (positionFinale === -1) {
        console.error(`[publish-positions] Could not find position for player ${numJoueur}`);
        positionFinale = occupiedPositions.size + 1;
      }

      // Ensure position is always within 1..N
      if (positionFinale < 1 || positionFinale > N) {
        console.error(`[publish-positions] Invalid position ${positionFinale} for player ${numJoueur}, forcing to valid range`);
        // Find first available in 1..N
        for (let i = 1; i <= N; i++) {
          if (!occupiedPositions.has(i)) {
            positionFinale = i;
            break;
          }
        }
      }

      occupiedPositions.add(positionFinale);

      positionsFinales.push({
        game_id: gameId,
        session_game_id: sessionGameId,
        manche: manche,
        rang_priorite: ranking.rank,
        num_joueur: numJoueur,
        nom: player?.display_name || ranking.display_name || `Joueur ${numJoueur}`,
        clan: player?.clan || null,
        mise: ranking.mise_effective || 0,
        position_souhaitee: positionSouhaitee,
        position_finale: positionFinale,
        slot_attaque: action?.slot_attaque || null,
        attaque1: action?.attaque1 || null,
        attaque2: action?.attaque2 || null,
        protection: action?.protection_objet || null,
        slot_protection: action?.slot_protection || null,
      });
    }

    // Verify we have a valid permutation of 1..N
    const finalPositionSet = new Set(positionsFinales.map(p => p.position_finale));
    const expectedPositions = new Set(Array.from({ length: N }, (_, i) => i + 1));
    
    if (finalPositionSet.size !== positionsFinales.length) {
      console.error('[publish-positions] Duplicate positions detected!', positionsFinales.map(p => p.position_finale));
    }
    
    // Log for debugging
    console.log(`[publish-positions] Final positions (N=${N}):`, 
      positionsFinales.map(p => `${p.nom}:${p.position_finale}`).join(', '));

    // Sort by position_finale for display
    positionsFinales.sort((a, b) => a.position_finale - b.position_finale);

    // Insert positions finales
    const { error: insertError } = await supabase
      .from('positions_finales')
      .insert(positionsFinales);

    if (insertError) {
      console.error('[publish-positions] Insert error:', insertError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erreur lors de l\'insertion des positions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Lock phase
    const { error: lockError } = await supabase
      .from('games')
      .update({ phase_locked: true })
      .eq('id', gameId);

    if (lockError) {
      console.error('[publish-positions] Lock error:', lockError);
    }

    // Create public message (WITHOUT revealing targets/attacks/protections)
    const publicRanking = positionsFinales
      .map(p => `${p.nom} (#${p.position_finale})`)
      .join(', ');

    const publicMessage = `🎯 Classement d'attaque établi : ${publicRanking}`;

    // Create MJ detailed log
    const mjDetails = positionsFinales.map(p => ({
      rang: p.rang_priorite,
      num: p.num_joueur,
      nom: p.nom,
      position_finale: p.position_finale,
      slot_attaque: p.slot_attaque,
      attaque1: p.attaque1,
      attaque2: p.attaque2,
      protection: p.protection,
      slot_protection: p.slot_protection,
    }));

    // Insert logs
    await Promise.all([
      // Public event
      supabase.from('session_events').insert({
        game_id: gameId,
        audience: 'ALL',
        type: 'PHASE',
        message: publicMessage,
        payload: { 
          type: 'POSITIONS_FINALES',
          sessionGameId,
          // Only include public info
          ranking: positionsFinales.map(p => ({ 
            position: p.position_finale, 
            nom: p.nom,
            num_joueur: p.num_joueur 
          }))
        },
      }),
      // MJ event
      supabase.from('session_events').insert({
        game_id: gameId,
        audience: 'MJ',
        type: 'SYSTEM',
        message: 'Positions finales publiées',
        payload: { positions: mjDetails, sessionGameId },
      }),
      // Public log
      supabase.from('logs_joueurs').insert({
        game_id: gameId,
        session_game_id: sessionGameId,
        manche: manche,
        type: 'POSITIONS_FINALES',
        message: publicMessage,
      }),
      // MJ log
      supabase.from('logs_mj').insert({
        game_id: gameId,
        session_game_id: sessionGameId,
        manche: manche,
        action: 'POSITIONS_PUBLIEES',
        details: JSON.stringify(mjDetails),
      }),
    ]);

    console.log(`[publish-positions] Published ${positionsFinales.length} positions for game ${gameId}, manche ${manche}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Positions finales publiées',
        positionsCount: positionsFinales.length,
        activePlayerCount: N,
        sessionGameId,
        // Only return public info
        publicRanking: positionsFinales.map(p => ({ 
          position: p.position_finale, 
          nom: p.nom 
        })),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[publish-positions] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erreur inconnue' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
