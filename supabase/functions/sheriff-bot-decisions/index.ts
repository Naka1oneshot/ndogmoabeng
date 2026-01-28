import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BotDecisionRequest {
  gameId: string;
  sessionGameId: string;
  action: 'choices' | 'duels' | 'duels_all' | 'final_duel_tokens'; // Which action to generate decisions for
  duelId?: string; // Optional for specific duel
}

interface SheriffBotConfig {
  visa_pv_chance: number;
  illegal_tokens_chance: number;
  search_chance: number;
  search_if_suspicious: number;
}

const DEFAULT_CONFIG: SheriffBotConfig = {
  visa_pv_chance: 60,
  illegal_tokens_chance: 30,
  search_chance: 35,
  search_if_suspicious: 60,
};

interface PlayerChoice {
  id: string;
  player_number: number;
  visa_choice: string | null;
  tokens_entering: number | null;
}

interface Duel {
  id: string;
  duel_order: number;
  player1_number: number;
  player2_number: number;
  player1_searches: boolean | null;
  player2_searches: boolean | null;
  status: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { gameId, sessionGameId, action, duelId } = await req.json() as BotDecisionRequest;

    if (!gameId || !sessionGameId || !action) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get user and check permissions
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ success: false, error: 'User not authenticated' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Check host or admin
    const { data: hostPlayer } = await supabase
      .from('game_players')
      .select('is_host')
      .eq('game_id', gameId)
      .eq('user_id', user.id)
      .maybeSingle();

    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    const { data: isSuper } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'super_admin'
    });

    if (!hostPlayer?.is_host && !isAdmin && !isSuper) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized - must be host or admin' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // Get bot players
    const { data: botPlayers } = await supabase
      .from('game_players')
      .select('id, player_number, pvic')
      .eq('game_id', gameId)
      .eq('is_bot', true)
      .eq('status', 'ACTIVE')
      .is('removed_at', null);

    if (!botPlayers || botPlayers.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No bots found', decisions_made: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const botNumbers = new Set(botPlayers.map(p => p.player_number));
    const results: any[] = [];

    if (action === 'choices') {
      // Generate choice decisions for bots
      const { data: roundState } = await supabase
        .from('sheriff_round_state')
        .select('phase, bot_config')
        .eq('session_game_id', sessionGameId)
        .single();

      if (!roundState || roundState.phase !== 'CHOICES') {
        return new Response(
          JSON.stringify({ success: false, error: 'Not in CHOICES phase' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Use config from round state or defaults
      const config: SheriffBotConfig = { ...DEFAULT_CONFIG, ...(roundState.bot_config as Partial<SheriffBotConfig> || {}) };

      // Get existing choices to find bots who haven't decided
      const { data: existingChoices } = await supabase
        .from('sheriff_player_choices')
        .select('player_number, visa_choice')
        .eq('session_game_id', sessionGameId);

      const decidedPlayers = new Set(
        existingChoices?.filter(c => c.visa_choice !== null).map(c => c.player_number) || []
      );

      // Generate decisions for each undecided bot
      for (const bot of botPlayers) {
        if (!bot.player_number || decidedPlayers.has(bot.player_number)) continue;

        // Use config probabilities
        const visaChoice = Math.random() * 100 < config.visa_pv_chance ? 'VICTORY_POINTS' : 'COMMON_POOL';
        
        // Use config for illegal tokens probability
        const tokensEntering = Math.random() * 100 < config.illegal_tokens_chance ? 30 : 20;
        const hasIllegalTokens = tokensEntering > 20;

        // Calculate visa cost
        let visaCostApplied = 0;
        if (visaChoice === 'VICTORY_POINTS') {
          visaCostApplied = (bot.pvic || 0) * 0.2;
        } else {
          visaCostApplied = 10;
        }

        // Update choice
        const { error: updateError } = await supabase
          .from('sheriff_player_choices')
          .update({
            visa_choice: visaChoice,
            visa_cost_applied: visaCostApplied,
            tokens_entering: tokensEntering,
            has_illegal_tokens: hasIllegalTokens,
            updated_at: new Date().toISOString(),
          })
          .eq('session_game_id', sessionGameId)
          .eq('player_number', bot.player_number);

        if (!updateError) {
          results.push({
            player_number: bot.player_number,
            visa_choice: visaChoice,
            tokens_entering: tokensEntering,
            has_illegal_tokens: hasIllegalTokens,
          });
        }
      }

      // Log action
      await supabase.from('logs_mj').insert({
        game_id: gameId,
        session_game_id: sessionGameId,
        type: 'BOT_SHERIFF_CHOICES',
        message: `${results.length} bots ont fait leurs choix`,
        payload: { results },
      });

    } else if (action === 'duels') {
      // Generate duel decisions for bots (only active duel)

      // Get round state for config
      const { data: roundState } = await supabase
        .from('sheriff_round_state')
        .select('bot_config')
        .eq('session_game_id', sessionGameId)
        .single();

      const config: SheriffBotConfig = { ...DEFAULT_CONFIG, ...(roundState?.bot_config as Partial<SheriffBotConfig> || {}) };

      // Get active duel(s) based on duelId or current active
      let duelsToProcess: Duel[] = [];
      
      if (duelId) {
        const { data: specificDuel } = await supabase
          .from('sheriff_duels')
          .select('*')
          .eq('id', duelId)
          .single();
        
        if (specificDuel && specificDuel.status === 'ACTIVE') {
          duelsToProcess = [specificDuel];
        }
      } else {
        // Get all active duels
        const { data: activeDuels } = await supabase
          .from('sheriff_duels')
          .select('*')
          .eq('session_game_id', sessionGameId)
          .eq('status', 'ACTIVE');
        
        if (activeDuels) {
          duelsToProcess = activeDuels;
        }
      }

      // Get player choices to know who has illegal tokens
      const { data: allChoices } = await supabase
        .from('sheriff_player_choices')
        .select('player_number, has_illegal_tokens')
        .eq('session_game_id', sessionGameId);

      const illegalMap = new Map(
        allChoices?.map(c => [c.player_number, c.has_illegal_tokens]) || []
      );

      for (const duel of duelsToProcess) {
        const p1IsBot = botNumbers.has(duel.player1_number);
        const p2IsBot = botNumbers.has(duel.player2_number);

        const updates: Record<string, boolean> = {};

        // Player 1 decision (if bot and hasn't decided)
        if (p1IsBot && duel.player1_searches === null) {
          // Check if opponent seems suspicious (has illegal tokens)
          const opponentSuspicious = illegalMap.get(duel.player2_number) === true;
          const searchChance = opponentSuspicious ? config.search_if_suspicious : config.search_chance;
          updates.player1_searches = Math.random() * 100 < searchChance;
        }

        // Player 2 decision (if bot and hasn't decided)
        if (p2IsBot && duel.player2_searches === null) {
          const opponentSuspicious = illegalMap.get(duel.player1_number) === true;
          const searchChance = opponentSuspicious ? config.search_if_suspicious : config.search_chance;
          updates.player2_searches = Math.random() * 100 < searchChance;
        }

        if (Object.keys(updates).length > 0) {
          const { error: duelError } = await supabase
            .from('sheriff_duels')
            .update(updates)
            .eq('id', duel.id);

          if (!duelError) {
            results.push({
              duel_id: duel.id,
              duel_order: duel.duel_order,
              ...updates,
            });
          }
        }
      }

      // Log action
      if (results.length > 0) {
        await supabase.from('logs_mj').insert({
          game_id: gameId,
          session_game_id: sessionGameId,
          type: 'BOT_SHERIFF_DUELS',
          message: `${results.length} décisions de duel par les bots`,
          payload: { results },
        });
      }

    } else if (action === 'duels_all') {
      // Generate decisions for ALL pending/active duels involving bots

      // Get round state for config
      const { data: roundState } = await supabase
        .from('sheriff_round_state')
        .select('bot_config')
        .eq('session_game_id', sessionGameId)
        .single();

      const config: SheriffBotConfig = { ...DEFAULT_CONFIG, ...(roundState?.bot_config as Partial<SheriffBotConfig> || {}) };

      // Get ALL duels (PENDING or ACTIVE) that involve bots
      const { data: allDuels } = await supabase
        .from('sheriff_duels')
        .select('*')
        .eq('session_game_id', sessionGameId)
        .in('status', ['PENDING', 'ACTIVE'])
        .order('duel_order', { ascending: true });

      // Get player choices to know who has illegal tokens
      const { data: allChoices } = await supabase
        .from('sheriff_player_choices')
        .select('player_number, has_illegal_tokens')
        .eq('session_game_id', sessionGameId);

      const illegalMap = new Map(
        allChoices?.map(c => [c.player_number, c.has_illegal_tokens]) || []
      );

      // Process each duel that involves at least one bot with pending decision
      for (const duel of allDuels || []) {
        const p1IsBot = botNumbers.has(duel.player1_number);
        const p2IsBot = botNumbers.has(duel.player2_number);

        // Skip duels with no bots
        if (!p1IsBot && !p2IsBot) continue;

        const updates: Record<string, boolean> = {};

        // Player 1 decision (if bot and hasn't decided)
        if (p1IsBot && duel.player1_searches === null) {
          const opponentSuspicious = illegalMap.get(duel.player2_number) === true;
          const searchChance = opponentSuspicious ? config.search_if_suspicious : config.search_chance;
          updates.player1_searches = Math.random() * 100 < searchChance;
        }

        // Player 2 decision (if bot and hasn't decided)
        if (p2IsBot && duel.player2_searches === null) {
          const opponentSuspicious = illegalMap.get(duel.player1_number) === true;
          const searchChance = opponentSuspicious ? config.search_if_suspicious : config.search_chance;
          updates.player2_searches = Math.random() * 100 < searchChance;
        }

        if (Object.keys(updates).length > 0) {
          const { error: duelError } = await supabase
            .from('sheriff_duels')
            .update(updates)
            .eq('id', duel.id);

          if (!duelError) {
            results.push({
              duel_id: duel.id,
              duel_order: duel.duel_order,
              ...updates,
            });
          }
        }
      }

      // Log action
      if (results.length > 0) {
        await supabase.from('logs_mj').insert({
          game_id: gameId,
          session_game_id: sessionGameId,
          type: 'BOT_SHERIFF_DUELS_ALL',
          message: `${results.length} décisions pré-remplies pour tous les duels bots`,
          payload: { results },
        });
      }

    } else if (action === 'final_duel_tokens') {
      // Generate final duel tokens for a bot challenger

      // Get round state to check final duel status and challenger
      const { data: roundState } = await supabase
        .from('sheriff_round_state')
        .select('final_duel_status, final_duel_challenger_num, unpaired_player_num, total_duels, bot_config')
        .eq('session_game_id', sessionGameId)
        .single();

      if (!roundState || roundState.final_duel_status !== 'PENDING_RECHOICE') {
        return new Response(
          JSON.stringify({ success: false, error: `Not in PENDING_RECHOICE status: ${roundState?.final_duel_status}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      const challengerNum = roundState.final_duel_challenger_num;
      if (!challengerNum) {
        return new Response(
          JSON.stringify({ success: false, error: 'No challenger designated' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Check if challenger is a bot
      const challengerBot = botPlayers.find(b => b.player_number === challengerNum);
      if (!challengerBot) {
        return new Response(
          JSON.stringify({ success: true, message: 'Challenger is not a bot', decisions_made: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Use config probabilities for illegal tokens
      const config: SheriffBotConfig = { ...DEFAULT_CONFIG, ...(roundState.bot_config as Partial<SheriffBotConfig> || {}) };
      
      // For final duel, bot must choose 21-30 tokens
      // Use illegal_tokens_chance to decide: random between 21-30
      const tokensEnteringFinal = Math.random() * 100 < config.illegal_tokens_chance 
        ? Math.floor(Math.random() * 10) + 21 // Random 21-30
        : 21; // Minimum illegal (1 illegal token)

      // Update player choice with final tokens
      const { error: choiceError } = await supabase
        .from('sheriff_player_choices')
        .update({
          tokens_entering_final: tokensEnteringFinal,
          tokens_entering_final_confirmed: true,
          updated_at: new Date().toISOString(),
        })
        .eq('session_game_id', sessionGameId)
        .eq('player_number', challengerNum);

      if (choiceError) throw choiceError;

      // Create the final duel
      const { data: newDuel, error: duelInsertError } = await supabase
        .from('sheriff_duels')
        .insert({
          game_id: gameId,
          session_game_id: sessionGameId,
          duel_order: roundState.total_duels + 1,
          player1_number: roundState.unpaired_player_num,
          player2_number: challengerNum,
          status: 'PENDING',
          is_final: true,
        })
        .select()
        .single();

      if (duelInsertError) throw duelInsertError;

      // Update round state to READY
      const { error: updateError } = await supabase
        .from('sheriff_round_state')
        .update({
          final_duel_id: newDuel.id,
          final_duel_status: 'READY',
          total_duels: roundState.total_duels + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('session_game_id', sessionGameId);

      if (updateError) throw updateError;

      // Get player names for logging
      const { data: players } = await supabase
        .from('game_players')
        .select('player_number, display_name')
        .eq('game_id', gameId)
        .in('player_number', [roundState.unpaired_player_num, challengerNum]);

      const unpairedName = players?.find(p => p.player_number === roundState.unpaired_player_num)?.display_name || `Joueur ${roundState.unpaired_player_num}`;
      const challengerName = players?.find(p => p.player_number === challengerNum)?.display_name || `Joueur ${challengerNum}`;
      const illegalCount = tokensEnteringFinal - 20;

      results.push({
        player_number: challengerNum,
        tokens_entering_final: tokensEnteringFinal,
        illegal_count: illegalCount,
        final_duel_id: newDuel.id,
      });

      // Log event
      await supabase.from('session_events').insert({
        game_id: gameId,
        session_game_id: sessionGameId,
        type: 'SHERIFF_FINAL_DUEL_READY',
        message: `[Bot] ${challengerName} entre avec ${tokensEnteringFinal} jetons (${illegalCount} illégaux) pour le dernier duel contre ${unpairedName}`,
        audience: 'ALL',
      });

      await supabase.from('logs_mj').insert({
        game_id: gameId,
        session_game_id: sessionGameId,
        type: 'BOT_SHERIFF_FINAL_TOKENS',
        message: `Bot ${challengerName} a choisi ${tokensEnteringFinal} jetons pour le dernier duel`,
        payload: { challengerNum, tokensEnteringFinal, illegalCount },
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        decisions_made: results.length,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('sheriff-bot-decisions error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
