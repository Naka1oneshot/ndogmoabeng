import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Player {
  id: string;
  player_number: number;
  display_name: string;
  jetons: number;
  status: string;
}

interface Bet {
  id: string;
  num_joueur: number;
  mise: number;
  mise_demandee: number | null;
  mise_effective: number | null;
  status: string;
  submitted_at: string | null;
}

interface RankedPlayer {
  player: Player;
  bet: Bet | null;
  miseEffective: number;
  rank: number;
  tieGroupId: number;
  note: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const errorId = crypto.randomUUID().slice(0, 8);

  try {
    const { gameId } = await req.json();
    console.log(`[close-phase1] Starting for game ${gameId}, errorId: ${errorId}`);

    if (!gameId) {
      return new Response(
        JSON.stringify({ success: false, error: 'gameId requis', errorId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error(`[close-phase1] No auth header, errorId: ${errorId}`);
      return new Response(
        JSON.stringify({ success: false, error: 'Non autorisé', errorId }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error(`[close-phase1] Auth failed, errorId: ${errorId}`, authError);
      return new Response(
        JSON.stringify({ success: false, error: 'Non autorisé', errorId }),
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
      console.error(`[close-phase1] Game not found, errorId: ${errorId}`, gameError);
      return new Response(
        JSON.stringify({ success: false, error: 'Partie non trouvée', errorId }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (game.host_user_id !== user.id) {
      console.error(`[close-phase1] Not host, errorId: ${errorId}`);
      return new Response(
        JSON.stringify({ success: false, error: 'Non autorisé - vous n\'êtes pas l\'hôte', errorId }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify current phase
    if (game.phase !== 'PHASE1_MISES') {
      console.error(`[close-phase1] Wrong phase: ${game.phase}, errorId: ${errorId}`);
      return new Response(
        JSON.stringify({ success: false, error: `Phase actuelle: ${game.phase}. Clôture uniquement possible en PHASE1_MISES.`, errorId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already locked for this round
    if (game.phase_locked) {
      console.log(`[close-phase1] Phase already locked, errorId: ${errorId}`);
      return new Response(
        JSON.stringify({ success: false, error: 'Phase déjà verrouillée pour cette manche', errorId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const manche = game.manche_active || 1;
    console.log(`[close-phase1] Processing manche ${manche}`);

    // Get active players (IN_GAME equivalent = ACTIVE, not LEFT/KICKED/REMOVED)
    const { data: players, error: playersError } = await supabase
      .from('game_players')
      .select('id, player_number, display_name, jetons, status')
      .eq('game_id', gameId)
      .eq('is_host', false)
      .in('status', ['ACTIVE', 'IN_GAME'])
      .order('player_number', { ascending: true });

    if (playersError) {
      console.error(`[close-phase1] Failed to fetch players, errorId: ${errorId}`, playersError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erreur lors de la récupération des joueurs', errorId }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!players || players.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Aucun joueur actif dans la partie', errorId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[close-phase1] Found ${players.length} active players`);

    // Get all bets for this round
    const { data: bets, error: betsError } = await supabase
      .from('round_bets')
      .select('*')
      .eq('game_id', gameId)
      .eq('manche', manche);

    if (betsError) {
      console.error(`[close-phase1] Failed to fetch bets, errorId: ${errorId}`, betsError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erreur lors de la récupération des mises', errorId }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[close-phase1] Found ${bets?.length || 0} bets`);

    // Map bets by player_number
    const betsByPlayer = new Map<number, Bet>();
    for (const bet of (bets || [])) {
      const existing = betsByPlayer.get(bet.num_joueur);
      // Keep the most recent bet
      if (!existing || (bet.submitted_at && (!existing.submitted_at || bet.submitted_at > existing.submitted_at))) {
        betsByPlayer.set(bet.num_joueur, bet);
      }
    }

    // Calculate effective bets for each player
    const rankedPlayers: RankedPlayer[] = [];
    
    for (const player of players) {
      const bet = betsByPlayer.get(player.player_number) || null;
      let miseEffective = 0;
      let note: string | null = null;

      if (bet) {
        const miseDemandee = bet.mise_demandee ?? bet.mise ?? 0;
        
        // Rule: if bet > tokens, effective = 0
        if (miseDemandee > (player.jetons || 0)) {
          miseEffective = 0;
          note = `Mise demandée (${miseDemandee}) > solde (${player.jetons}), forcée à 0`;
        } else {
          miseEffective = miseDemandee;
        }
      } else {
        // No bet submitted = 0
        note = 'Aucune mise soumise';
      }

      rankedPlayers.push({
        player,
        bet,
        miseEffective,
        rank: 0,
        tieGroupId: 0,
        note,
      });
    }

    // Sort by mise_effective descending
    rankedPlayers.sort((a, b) => b.miseEffective - a.miseEffective);

    // Calculate ranks with alternating tie-breaking
    // Get tie direction from game settings (default ASC)
    let currentTieDirection = (game.sens_depart_egalite === 'DESC') ? 'DESC' : 'ASC';
    let currentRank = 1;
    let currentTieGroup = 1;
    let i = 0;

    while (i < rankedPlayers.length) {
      // Find all players with the same mise_effective
      const currentMise = rankedPlayers[i].miseEffective;
      const tieGroup: RankedPlayer[] = [];
      
      while (i < rankedPlayers.length && rankedPlayers[i].miseEffective === currentMise) {
        tieGroup.push(rankedPlayers[i]);
        i++;
      }

      // Sort tie group by player_number based on current direction
      if (currentTieDirection === 'ASC') {
        tieGroup.sort((a, b) => a.player.player_number - b.player.player_number);
      } else {
        tieGroup.sort((a, b) => b.player.player_number - a.player.player_number);
      }

      // Assign ranks
      for (const rp of tieGroup) {
        rp.rank = currentRank;
        rp.tieGroupId = tieGroup.length > 1 ? currentTieGroup : 0;
        currentRank++;
      }

      // Alternate direction for next tie group
      if (tieGroup.length > 1) {
        currentTieDirection = currentTieDirection === 'ASC' ? 'DESC' : 'ASC';
        currentTieGroup++;
      }
    }

    // Re-sort by final rank for output
    rankedPlayers.sort((a, b) => a.rank - b.rank);

    console.log(`[close-phase1] Rankings calculated:`, rankedPlayers.map(rp => 
      `#${rp.rank} ${rp.player.display_name} (P${rp.player.player_number}): ${rp.miseEffective}`
    ));

    // === Begin atomic updates ===

    // 1. Update bets with effective amounts and lock them
    for (const rp of rankedPlayers) {
      if (rp.bet) {
        const { error: updateBetError } = await supabase
          .from('round_bets')
          .update({
            mise_effective: rp.miseEffective,
            status: 'LOCKED',
            note: rp.note,
          })
          .eq('id', rp.bet.id);

        if (updateBetError) {
          console.error(`[close-phase1] Failed to update bet ${rp.bet.id}`, updateBetError);
        }
      } else {
        // Create a locked bet record for players who didn't submit
        const { error: insertBetError } = await supabase
          .from('round_bets')
          .insert({
            game_id: gameId,
            manche,
            num_joueur: rp.player.player_number,
            mise: 0,
            mise_demandee: 0,
            mise_effective: 0,
            status: 'LOCKED',
            note: rp.note,
            submitted_at: new Date().toISOString(),
          });

        if (insertBetError) {
          console.error(`[close-phase1] Failed to create bet for player ${rp.player.player_number}`, insertBetError);
        }
      }
    }

    // 2. Debit tokens from players
    for (const rp of rankedPlayers) {
      if (rp.miseEffective > 0) {
        const newJetons = Math.max(0, (rp.player.jetons || 0) - rp.miseEffective);
        
        const { error: updatePlayerError } = await supabase
          .from('game_players')
          .update({ jetons: newJetons })
          .eq('id', rp.player.id);

        if (updatePlayerError) {
          console.error(`[close-phase1] Failed to debit player ${rp.player.id}`, updatePlayerError);
        } else {
          console.log(`[close-phase1] Debited ${rp.miseEffective} from ${rp.player.display_name}, new balance: ${newJetons}`);
        }
      }
    }

    // 3. Insert priority rankings
    const rankings = rankedPlayers.map(rp => ({
      game_id: gameId,
      manche,
      player_id: rp.player.id,
      num_joueur: rp.player.player_number,
      display_name: rp.player.display_name,
      rank: rp.rank,
      mise_effective: rp.miseEffective,
      tie_group_id: rp.tieGroupId || null,
    }));

    const { error: rankingsError } = await supabase
      .from('priority_rankings')
      .insert(rankings);

    if (rankingsError) {
      console.error(`[close-phase1] Failed to insert rankings`, rankingsError);
    }

    // 4. Lock phase and advance to PHASE2_POSITIONS
    const { error: gameUpdateError } = await supabase
      .from('games')
      .update({ 
        phase: 'PHASE2_POSITIONS', 
        phase_locked: false 
      })
      .eq('id', gameId);

    if (gameUpdateError) {
      console.error(`[close-phase1] Failed to update game phase`, gameUpdateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erreur lors de la mise à jour de la phase', errorId }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Create logs

    // MJ log (detailed with amounts)
    const mjLogDetails = rankedPlayers.map(rp => 
      `${rp.player.display_name}(#${rp.player.player_number})=${rp.miseEffective}${rp.note ? ` [${rp.note}]` : ''}`
    ).join(' ; ');
    
    const mjLogMessage = `Phase 1 clôturée. Classement priorité (mises effectives) : ${mjLogDetails}`;

    // Player log - NEW FORMAT: "Classement mise Phase 1 : Nom1 #1, Nom2 #2, ..."
    const playerLogRanking = rankedPlayers.map(rp => 
      `${rp.player.display_name} #${rp.rank}`
    ).join(', ');
    const playerLogMessage = `Classement mise Phase 1 : ${playerLogRanking}`;

    // Insert into logs_mj
    await supabase.from('logs_mj').insert({
      game_id: gameId,
      manche,
      action: 'PHASE1_CLOSED',
      details: mjLogMessage,
    });

    // Insert into logs_joueurs with new type PRIORITE_MISES
    await supabase.from('logs_joueurs').insert({
      game_id: gameId,
      manche,
      type: 'PRIORITE_MISES',
      message: playerLogMessage,
    });

    // Insert session events
    const events = [
      {
        game_id: gameId,
        audience: 'ALL',
        type: 'PRIORITE_MISES',
        message: playerLogMessage,
        payload: { 
          phase: 'PHASE1_MISES', 
          action: 'closed',
          newPhase: 'PHASE2_POSITIONS',
          rankings: rankedPlayers.map(rp => ({ 
            rank: rp.rank, 
            name: rp.player.display_name,
            playerNumber: rp.player.player_number 
          }))
        },
      },
      {
        game_id: gameId,
        audience: 'MJ',
        type: 'PHASE',
        message: mjLogMessage,
        payload: { 
          phase: 'PHASE1_MISES', 
          action: 'closed',
          rankings: rankedPlayers.map(rp => ({ 
            rank: rp.rank, 
            name: rp.player.display_name,
            playerNumber: rp.player.player_number,
            miseEffective: rp.miseEffective,
            note: rp.note
          }))
        },
      },
    ];

    await supabase.from('session_events').insert(events);

    console.log(`[close-phase1] Successfully closed Phase 1 for game ${gameId}, manche ${manche}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        manche,
        playerCount: players.length,
        rankings: rankedPlayers.map(rp => ({
          rank: rp.rank,
          playerNumber: rp.player.player_number,
          displayName: rp.player.display_name,
          miseEffective: rp.miseEffective,
          note: rp.note,
        })),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error(`[close-phase1] Unexpected error, errorId: ${errorId}`, error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        errorId 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
