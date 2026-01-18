import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PHASES = ['PHASE1_MISES', 'PHASE2_POSITIONS', 'PHASE3_SHOP', 'PHASE4_COMBAT', 'RESOLUTION'];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { gameId, action } = await req.json();
    
    if (!gameId || !action) {
      return new Response(
        JSON.stringify({ success: false, error: 'gameId et action requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Non autorisé' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user
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

    const sessionGameId = game.current_session_game_id;
    console.log(`[manage-phase] Action ${action} for game ${gameId}, session_game ${sessionGameId}`);

    let updates: Record<string, unknown> = {};
    let publicEvent: string | null = null;
    let mjEvent: string | null = null;

    switch (action) {
      case 'lock_phase': {
        updates = { phase_locked: true };
        publicEvent = `Phase verrouillée: ${game.phase}`;
        mjEvent = `Phase ${game.phase} verrouillée par le MJ`;
        break;
      }

      case 'unlock_phase': {
        updates = { phase_locked: false };
        mjEvent = `Phase ${game.phase} déverrouillée par le MJ`;
        break;
      }

      case 'next_phase': {
        const currentIndex = PHASES.indexOf(game.phase);
        if (currentIndex === -1 || currentIndex >= PHASES.length - 1) {
          return new Response(
            JSON.stringify({ success: false, error: 'Impossible d\'avancer la phase' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const nextPhase = PHASES[currentIndex + 1];
        updates = { phase: nextPhase, phase_locked: false };
        publicEvent = `Nouvelle phase: ${nextPhase}`;
        mjEvent = `Transition de phase: ${game.phase} → ${nextPhase}`;
        break;
      }

      case 'next_round': {
        const newRound = (game.manche_active || 1) + 1;
        updates = { 
          manche_active: newRound, 
          phase: 'PHASE1_MISES', 
          phase_locked: false 
        };
        publicEvent = `Nouvelle manche: Manche ${newRound}`;
        mjEvent = `Démarrage de la manche ${newRound}`;
        break;
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: 'Action non reconnue' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // Update game
    const { error: updateError } = await supabase
      .from('games')
      .update(updates)
      .eq('id', gameId);

    if (updateError) {
      console.error('Update error:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erreur lors de la mise à jour' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update session_games table if we have a session_game_id
    if (sessionGameId && (updates.phase || updates.manche_active)) {
      const sessionGameUpdates: Record<string, unknown> = {};
      if (updates.phase) sessionGameUpdates.phase = updates.phase;
      if (updates.manche_active) sessionGameUpdates.manche_active = updates.manche_active;
      
      await supabase
        .from('session_games')
        .update(sessionGameUpdates)
        .eq('id', sessionGameId);
    }

    // Create events
    const events = [];
    
    if (publicEvent) {
      events.push({
        game_id: gameId,
        audience: 'ALL',
        type: 'PHASE',
        message: publicEvent,
        payload: { action, ...updates, session_game_id: sessionGameId },
      });
    }

    if (mjEvent) {
      events.push({
        game_id: gameId,
        audience: 'MJ',
        type: 'SYSTEM',
        message: mjEvent,
        payload: { action, ...updates, session_game_id: sessionGameId },
      });
    }

    if (events.length > 0) {
      await supabase.from('session_events').insert(events);
    }

    console.log(`[manage-phase] Action ${action} executed for game ${gameId}, session_game ${sessionGameId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        action,
        updates,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erreur inconnue' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
