import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Bot name generator
const BOT_PREFIXES = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Omega', 'Zeta', 'Sigma', 'Theta', 'Lambda', 'Kappa'];
const BOT_SUFFIXES = ['Bot', 'AI', 'Droid', 'Unit', 'Agent', 'Node', 'Core', 'Prime', 'Zero', 'One'];

// Available clans for random assignment
const CLANS = ['Royaux', 'Zoulous', 'Keryndes', 'Akandé', 'Aseyra', 'Akila', 'Ezkar'];

function generateBotName(index: number): string {
  const prefix = BOT_PREFIXES[index % BOT_PREFIXES.length];
  const suffix = BOT_SUFFIXES[Math.floor(index / BOT_PREFIXES.length) % BOT_SUFFIXES.length];
  const num = Math.floor(index / (BOT_PREFIXES.length * BOT_SUFFIXES.length)) + 1;
  return num > 1 ? `${prefix}${suffix}${num}` : `${prefix}${suffix}`;
}

function getRandomClan(): string {
  return CLANS[Math.floor(Math.random() * CLANS.length)];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { gameId, count, withClans = false, withMates = false } = await req.json();

    if (!gameId || !count || count < 1 || count > 50) {
      return new Response(
        JSON.stringify({ success: false, error: 'gameId et count (1-50) requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate user
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

    // Check if user is admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    const isAdmin = !!roleData;

    // Get game and verify host or admin
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('id, status, starting_tokens, host_user_id')
      .eq('id', gameId)
      .single();

    if (gameError || !game) {
      return new Response(
        JSON.stringify({ success: false, error: 'Partie non trouvée' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (game.host_user_id !== user.id && !isAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: 'Non autorisé - admin ou hôte requis' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (game.status !== 'LOBBY') {
      return new Response(
        JSON.stringify({ success: false, error: 'Les bots ne peuvent être ajoutés qu\'en lobby' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get current max player number
    const { data: existingPlayers } = await supabase
      .from('game_players')
      .select('player_number')
      .eq('game_id', gameId)
      .eq('is_host', false)
      .order('player_number', { ascending: false })
      .limit(1);

    let startNum = 1;
    if (existingPlayers && existingPlayers.length > 0 && existingPlayers[0].player_number) {
      startNum = existingPlayers[0].player_number + 1;
    }

    // Count existing bots for naming
    const { count: existingBotCount } = await supabase
      .from('game_players')
      .select('id', { count: 'exact' })
      .eq('game_id', gameId)
      .eq('is_bot', true);

    const botStartIndex = existingBotCount || 0;

    // Create bots with player_numbers first
    const bots = [];
    for (let i = 0; i < count; i++) {
      const playerNumber = startNum + i;
      const botName = generateBotName(botStartIndex + i);
      const botToken = crypto.randomUUID();
      const assignedClan = withClans ? getRandomClan() : null;
      
      // Apply Royaux clan bonus: 1.5x starting tokens
      const baseTokens = game.starting_tokens || 50;
      const finalTokens = assignedClan === 'Royaux' 
        ? Math.floor(baseTokens * 1.5) 
        : baseTokens;

      bots.push({
        game_id: gameId,
        display_name: `🤖 ${botName}`,
        player_number: playerNumber,
        player_token: botToken,
        is_host: false,
        is_bot: true,
        status: 'ACTIVE',
        jetons: finalTokens,
        joined_at: new Date().toISOString(),
        clan: assignedClan,
        clan_locked: withClans ? true : false,
        mate_num: null, // Will be assigned after all bots are created
      });
    }

    const { data: insertedBots, error: insertError } = await supabase
      .from('game_players')
      .insert(bots)
      .select('id, display_name, player_number, clan');

    if (insertError) {
      console.error('[add-bots] Insert error:', insertError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erreur lors de l\'ajout des bots' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If withMates is enabled, assign random mates between the new bots
    if (withMates && insertedBots && insertedBots.length >= 2) {
      // Get all bot player numbers
      const botPlayerNumbers = insertedBots.map(b => b.player_number);
      
      // Shuffle and pair up
      const shuffled = [...botPlayerNumbers].sort(() => Math.random() - 0.5);
      const pairs: Array<[number, number]> = [];
      
      for (let i = 0; i < shuffled.length - 1; i += 2) {
        pairs.push([shuffled[i], shuffled[i + 1]]);
      }
      
      // Update each bot with its mate
      for (const [num1, num2] of pairs) {
        const bot1 = insertedBots.find(b => b.player_number === num1);
        const bot2 = insertedBots.find(b => b.player_number === num2);
        
        if (bot1 && bot2) {
          await supabase
            .from('game_players')
            .update({ mate_num: num2 })
            .eq('id', bot1.id);
          
          await supabase
            .from('game_players')
            .update({ mate_num: num1 })
            .eq('id', bot2.id);
        }
      }
      
      console.log(`[add-bots] Assigned ${pairs.length} mate pairs`);
    }

    console.log(`[add-bots] Added ${count} bots to game ${gameId} (clans: ${withClans}, mates: ${withMates})`);

    return new Response(
      JSON.stringify({
        success: true,
        botsAdded: count,
        bots: insertedBots,
        options: { withClans, withMates },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[add-bots] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erreur inconnue' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
