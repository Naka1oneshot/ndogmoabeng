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
      .select('*')
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

    // Check if positions already published (idempotence)
    const { data: existingPositions } = await supabase
      .from('positions_finales')
      .select('id')
      .eq('game_id', gameId)
      .eq('manche', game.manche_active)
      .limit(1);

    if (existingPositions && existingPositions.length > 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Positions déjà publiées pour cette manche' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const manche = game.manche_active;
    const nbJoueurs = game.x_nb_joueurs || 6;

    // Get priority rankings (order from Phase 1)
    const { data: rankings, error: rankingsError } = await supabase
      .from('priority_rankings')
      .select('*')
      .eq('game_id', gameId)
      .eq('manche', manche)
      .order('rank', { ascending: true });

    if (rankingsError || !rankings || rankings.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Aucun classement de priorité trouvé. Assurez-vous que la Phase 1 a été clôturée.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get actions for this round
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

    // Get players info
    const { data: players, error: playersError } = await supabase
      .from('game_players')
      .select('player_number, display_name, clan, jetons')
      .eq('game_id', gameId)
      .eq('status', 'ACTIVE')
      .eq('is_host', false);

    if (playersError) {
      console.error('[publish-positions] Error fetching players:', playersError);
    }

    const playerMap = new Map(players?.map(p => [p.player_number, p]) || []);
    const actionMap = new Map(actions?.map(a => [a.num_joueur, a]) || []);

    // Track occupied positions
    const occupiedPositions = new Set<number>();
    const positionsFinales: Array<{
      game_id: string;
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
      
      let positionSouhaitee = action?.position_souhaitee || null;
      let positionFinale: number;

      // Find available position
      if (positionSouhaitee && positionSouhaitee >= 1 && positionSouhaitee <= nbJoueurs && !occupiedPositions.has(positionSouhaitee)) {
        // Desired position is available
        positionFinale = positionSouhaitee;
      } else {
        // Find first available position
        // If desired position is taken, try pos+1, pos+2, ..., nbJoueurs, then 1, 2, ...
        const startPos = positionSouhaitee && positionSouhaitee >= 1 && positionSouhaitee <= nbJoueurs 
          ? positionSouhaitee 
          : 1;
        
        positionFinale = -1;
        // Try from startPos to nbJoueurs
        for (let i = startPos; i <= nbJoueurs; i++) {
          if (!occupiedPositions.has(i)) {
            positionFinale = i;
            break;
          }
        }
        // If not found, try from 1 to startPos-1
        if (positionFinale === -1) {
          for (let i = 1; i < startPos; i++) {
            if (!occupiedPositions.has(i)) {
              positionFinale = i;
              break;
            }
          }
        }
        // Fallback (shouldn't happen if nbJoueurs >= number of players)
        if (positionFinale === -1) {
          positionFinale = occupiedPositions.size + 1;
        }
      }

      occupiedPositions.add(positionFinale);

      positionsFinales.push({
        game_id: gameId,
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
        payload: { positions: mjDetails },
      }),
      // Public log
      supabase.from('logs_joueurs').insert({
        game_id: gameId,
        manche: manche,
        type: 'POSITIONS_FINALES',
        message: publicMessage,
      }),
      // MJ log
      supabase.from('logs_mj').insert({
        game_id: gameId,
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
