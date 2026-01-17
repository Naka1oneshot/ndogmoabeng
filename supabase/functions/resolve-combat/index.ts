import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ItemCatalog {
  name: string;
  category: string;
  base_damage: number;
  base_heal: number;
  target: string;
  timing: string;
  persistence: string;
  ignore_protection: boolean;
  special_effect: string;
  consumable: boolean;
}

interface PositionFinale {
  num_joueur: number;
  nom: string;
  clan: string | null;
  position_finale: number;
  slot_attaque: number | null;
  attaque1: string | null;
  attaque2: string | null;
  protection: string | null;
  slot_protection: number | null;
}

interface Monster {
  id: string;
  monster_id: number;
  pv_current: number;
  status: string;
  battlefield_slot: number | null;
  name?: string;
  reward?: number;
}

interface PublicAction {
  position: number;
  nom: string;
  num_joueur: number;
  weapons: string[];
  totalDamage: number;
  totalHeal: number;
  cancelled: boolean;
  cancelReason?: string;
}

interface Kill {
  killerName: string;
  killerNum: number;
  monsterName: string;
  monsterId: number;
  slot: number;
  reward: number;
}

interface ConsumedItem {
  playerNum: number;
  playerName: string;
  itemName: string;
  wasInInventory: boolean;
}

interface MJAction {
  position: number;
  nom: string;
  num_joueur: number;
  slot_attaque: number | null;
  attaque1: string | null;
  attaque2: string | null;
  protection: string | null;
  slot_protection: number | null;
  damage1: number;
  damage2: number;
  totalDamage: number;
  targetMonster: string | null;
  cancelled: boolean;
  cancelReason?: string;
  killed?: string;
}

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

    // Verify phase and lock
    if (game.phase !== 'PHASE2_POSITIONS') {
      return new Response(
        JSON.stringify({ success: false, error: 'Cette action n\'est disponible qu\'en Phase 2' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!game.phase_locked) {
      return new Response(
        JSON.stringify({ success: false, error: 'Vous devez d\'abord publier les positions finales' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const manche = game.manche_active;

    // Check idempotence
    const { data: existingResult } = await supabase
      .from('combat_results')
      .select('*')
      .eq('game_id', gameId)
      .eq('manche', manche)
      .single();

    if (existingResult) {
      console.log('[resolve-combat] Already resolved, returning cached result');
      return new Response(
        JSON.stringify({ 
          success: true, 
          cached: true,
          publicSummary: existingResult.public_summary,
          kills: existingResult.kills,
          forestState: existingResult.forest_state,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Load data
    const [
      { data: positions },
      { data: itemCatalog },
      { data: monsters },
      { data: monsterCatalog },
      { data: inventory },
      { data: players },
    ] = await Promise.all([
      supabase.from('positions_finales').select('*').eq('game_id', gameId).eq('manche', manche).order('position_finale', { ascending: true }),
      supabase.from('item_catalog').select('*'),
      supabase.from('game_state_monsters').select('*').eq('game_id', gameId),
      supabase.from('monster_catalog').select('*'),
      supabase.from('inventory').select('*').eq('game_id', gameId),
      supabase.from('game_players').select('*').eq('game_id', gameId).eq('status', 'ACTIVE'),
    ]);

    if (!positions || positions.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Aucune position finale trouvée' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build maps
    const itemMap = new Map<string, ItemCatalog>(itemCatalog?.map((i: ItemCatalog) => [i.name, i]) || []);
    const monsterNameMap = new Map<number, string>(monsterCatalog?.map((m: { id: number; name: string }) => [m.id, m.name]) || []);
    const monsterRewardMap = new Map<number, number>(monsterCatalog?.map((m: { id: number; reward_default: number }) => [m.id, m.reward_default]) || []);
    
    // Monster state by slot
    const monsterBySlot = new Map<number, Monster>();
    const monstersById = new Map<string, Monster>();
    for (const m of monsters || []) {
      const monster: Monster = {
        ...m,
        name: monsterNameMap.get(m.monster_id) || `Monstre ${m.monster_id}`,
        reward: monsterRewardMap.get(m.monster_id) || 10,
      };
      monstersById.set(m.id, monster);
      if (m.status === 'EN_BATAILLE' && m.battlefield_slot) {
        monsterBySlot.set(m.battlefield_slot, monster);
      }
    }

    // Inventory map
    const inventoryMap = new Map<string, number>();
    for (const inv of inventory || []) {
      const key = `${inv.owner_num}_${inv.objet}`;
      inventoryMap.set(key, (inventoryMap.get(key) || 0) + (inv.quantite || 0));
    }

    // Protection maps (track when protections are activated)
    const shieldBySlot = new Map<number, { activatedAt: number; playerNum: number }>();
    const voileBySlot = new Map<number, { activatedAt: number; playerNum: number }>();
    const gazBySlot = new Map<number, { activatedAt: number; playerNum: number }>();

    const publicActions: PublicAction[] = [];
    const mjActions: MJAction[] = [];
    const kills: Kill[] = [];
    const rewardUpdates: { playerNum: number; reward: number }[] = [];
    const consumedItems: ConsumedItem[] = [];
    
    // Permanent item that should never be consumed
    const PERMANENT_WEAPON = 'Par défaut (+2 si compagnon Akandé)';
    
    // Helper function to track item consumption
    const trackItemConsumption = (playerNum: number, playerName: string, itemName: string) => {
      if (!itemName || itemName === 'Aucune' || itemName === '' || itemName === PERMANENT_WEAPON) {
        return;
      }
      // Check if player has item in inventory
      const invKey = `${playerNum}_${itemName}`;
      const hasItem = (inventoryMap.get(invKey) || 0) > 0;
      consumedItems.push({
        playerNum,
        playerName,
        itemName,
        wasInInventory: hasItem,
      });
    };
    const berserkerPlayers: number[] = [];

    // Process each player in order of position_finale
    for (const pos of positions as PositionFinale[]) {
      const mjAction: MJAction = {
        position: pos.position_finale,
        nom: pos.nom,
        num_joueur: pos.num_joueur,
        slot_attaque: pos.slot_attaque,
        attaque1: pos.attaque1,
        attaque2: pos.attaque2,
        protection: pos.protection,
        slot_protection: pos.slot_protection,
        damage1: 0,
        damage2: 0,
        totalDamage: 0,
        targetMonster: null,
        cancelled: false,
      };

      const publicAction: PublicAction = {
        position: pos.position_finale,
        nom: pos.nom,
        num_joueur: pos.num_joueur,
        weapons: [],
        totalDamage: 0,
        totalHeal: 0,
        cancelled: false,
      };

      // Process protection first (activates for subsequent attacks)
      if (pos.protection && pos.slot_protection && pos.protection !== 'Aucune' && pos.protection !== PERMANENT_WEAPON) {
        const protItem = itemMap.get(pos.protection);
        if (protItem) {
          if (protItem.special_effect === 'BOUCLIER_MIROIR' || pos.protection.toLowerCase().includes('bouclier')) {
            shieldBySlot.set(pos.slot_protection, { activatedAt: pos.position_finale, playerNum: pos.num_joueur });
          } else if (protItem.special_effect === 'VOILE_PENALITE' || pos.protection.toLowerCase().includes('voile')) {
            voileBySlot.set(pos.slot_protection, { activatedAt: pos.position_finale, playerNum: pos.num_joueur });
          } else if (protItem.special_effect === 'GAZ_ANNULATION' || pos.protection.toLowerCase().includes('gaz')) {
            gazBySlot.set(pos.slot_protection, { activatedAt: pos.position_finale, playerNum: pos.num_joueur });
          }
          
          // Track protection item for consumption (ALL protections are consumed when used)
          trackItemConsumption(pos.num_joueur, pos.nom, pos.protection);
        }
      }

      // Check if attacks are cancelled by protections
      const targetSlot = pos.slot_attaque;
      let attackCancelled = false;
      let cancelReason = '';

      if (targetSlot) {
        // Check gaz (cancels attacks after activation)
        const gaz = gazBySlot.get(targetSlot);
        if (gaz && gaz.activatedAt < pos.position_finale) {
          attackCancelled = true;
          cancelReason = 'Gaz Asphyxiant';
        }

        // Check voile (cancels attack + penalty)
        const voile = voileBySlot.get(targetSlot);
        if (voile && voile.activatedAt < pos.position_finale) {
          attackCancelled = true;
          cancelReason = 'Voile de Brume';
          // Note: penalty would be applied to jetons but we need damage first
        }
      }

      // Process attacks
      let damage1 = 0;
      let damage2 = 0;

      if (pos.attaque1 && pos.attaque1 !== 'Aucune') {
        const item1 = itemMap.get(pos.attaque1);
        if (item1) {
          publicAction.weapons.push(pos.attaque1);
          
          // Akande clan bonus (only for default weapon)
          let bonus = 0;
          if (pos.clan === 'Akandé' && pos.attaque1 === PERMANENT_WEAPON) {
            bonus = 2;
          }
          
          damage1 = (item1.base_damage || 0) + bonus;
          
          // Check if ignore_protection
          if (item1.ignore_protection && targetSlot) {
            // Totem de Rupture ignores shield
            const shield = shieldBySlot.get(targetSlot);
            if (!shield || shield.activatedAt >= pos.position_finale) {
              // Shield not active yet or doesn't apply
            }
            // Ignore protection regardless
            attackCancelled = false;
            cancelReason = '';
          }
          
          // Track Piqure Berseker
          if (pos.attaque1 === 'Piqure Berseker') {
            berserkerPlayers.push(pos.num_joueur);
          }

          // Track attack item for consumption (ALL attacks except permanent weapon)
          trackItemConsumption(pos.num_joueur, pos.nom, pos.attaque1);
        }
      }

      if (pos.attaque2 && pos.attaque2 !== 'Aucune') {
        const item2 = itemMap.get(pos.attaque2);
        if (item2) {
          publicAction.weapons.push(pos.attaque2);
          
          // Akande clan bonus (only for default weapon)
          let bonus = 0;
          if (pos.clan === 'Akandé' && pos.attaque2 === PERMANENT_WEAPON) {
            bonus = 2;
          }
          
          damage2 = (item2.base_damage || 0) + bonus;

          // Track attack item for consumption (ALL attacks except permanent weapon)
          trackItemConsumption(pos.num_joueur, pos.nom, pos.attaque2);
        }
      }

      mjAction.damage1 = damage1;
      mjAction.damage2 = damage2;

      // Apply cancellation
      if (attackCancelled) {
        mjAction.cancelled = true;
        mjAction.cancelReason = cancelReason;
        publicAction.cancelled = true;
        publicAction.cancelReason = cancelReason;
        damage1 = 0;
        damage2 = 0;
      }

      const totalDamage = damage1 + damage2;
      mjAction.totalDamage = totalDamage;
      publicAction.totalDamage = totalDamage;

      // Apply damage to monster
      if (targetSlot && totalDamage > 0) {
        const monster = monsterBySlot.get(targetSlot);
        if (monster && monster.status === 'EN_BATAILLE') {
          mjAction.targetMonster = monster.name || null;
          
          // Check shield (blocks damage, reflects some)
          const shield = shieldBySlot.get(targetSlot);
          if (shield && shield.activatedAt < pos.position_finale) {
            // Damage blocked by shield
            mjAction.cancelled = true;
            mjAction.cancelReason = 'Bouclier Miroir';
            publicAction.cancelled = true;
            publicAction.cancelReason = 'Attaque bloquée';
            publicAction.totalDamage = 0;
          } else {
            // Apply damage
            monster.pv_current = Math.max(0, monster.pv_current - totalDamage);
            
            // Check kill
            if (monster.pv_current <= 0) {
              monster.status = 'MORT';
              mjAction.killed = monster.name;
              
              kills.push({
                killerName: pos.nom,
                killerNum: pos.num_joueur,
                monsterName: monster.name || `Monstre ${monster.monster_id}`,
                monsterId: monster.monster_id,
                slot: targetSlot,
                reward: monster.reward || 10,
              });
              
              rewardUpdates.push({ playerNum: pos.num_joueur, reward: monster.reward || 10 });
            }
          }
        }
      }

      publicActions.push(publicAction);
      mjActions.push(mjAction);
    }

    // Berserker penalty: -10 jetons if no kill
    const killersNums = new Set(kills.map(k => k.killerNum));
    const berserkerPenalties: { playerNum: number; penalty: number }[] = [];
    for (const playerNum of berserkerPlayers) {
      if (!killersNums.has(playerNum)) {
        berserkerPenalties.push({ playerNum, penalty: -10 });
      }
    }

    // Update game_state_monsters
    const monsterUpdates = Array.from(monstersById.values()).map(m => ({
      id: m.id,
      pv_current: m.pv_current,
      status: m.status,
    }));

    for (const update of monsterUpdates) {
      await supabase
        .from('game_state_monsters')
        .update({ pv_current: update.pv_current, status: update.status })
        .eq('id', update.id);
    }

    // Replace dead monsters with queue
    for (const kill of kills) {
      const { data: nextMonster } = await supabase
        .from('game_state_monsters')
        .select('*')
        .eq('game_id', gameId)
        .eq('status', 'EN_FILE')
        .is('battlefield_slot', null)
        .order('monster_id', { ascending: true })
        .limit(1)
        .single();
      
      if (nextMonster) {
        await supabase
          .from('game_state_monsters')
          .update({ 
            battlefield_slot: kill.slot, 
            status: 'EN_BATAILLE' 
          })
          .eq('id', nextMonster.id);
      }
    }

    // Update player rewards
    for (const reward of rewardUpdates) {
      const { data: playerData } = await supabase
        .from('game_players')
        .select('recompenses')
        .eq('game_id', gameId)
        .eq('player_number', reward.playerNum)
        .single();
      
      if (playerData) {
        await supabase
          .from('game_players')
          .update({ recompenses: (playerData.recompenses || 0) + reward.reward })
          .eq('game_id', gameId)
          .eq('player_number', reward.playerNum);
      }
    }

    // Apply berserker penalties
    for (const penalty of berserkerPenalties) {
      const { data: playerData } = await supabase
        .from('game_players')
        .select('jetons')
        .eq('game_id', gameId)
        .eq('player_number', penalty.playerNum)
        .single();
      
      if (playerData) {
        await supabase
          .from('game_players')
          .update({ jetons: Math.max(0, (playerData.jetons || 0) + penalty.penalty) })
          .eq('game_id', gameId)
          .eq('player_number', penalty.playerNum);
      }
    }

    // ==========================================
    // CONSUME ITEMS FROM INVENTORY
    // ==========================================
    console.log(`[resolve-combat] Processing ${consumedItems.length} item consumptions`);
    
    const consumptionLogs: string[] = [];
    const itemsMissingFromInventory: ConsumedItem[] = [];
    
    for (const item of consumedItems) {
      // Find the inventory entry for this player and item
      const { data: invRow, error: invError } = await supabase
        .from('inventory')
        .select('*')
        .eq('game_id', gameId)
        .eq('owner_num', item.playerNum)
        .eq('objet', item.itemName)
        .single();
      
      if (invError || !invRow) {
        // Item not found in inventory - log and continue (don't crash)
        console.log(`[resolve-combat] Item not found in inventory: ${item.itemName} for player ${item.playerNum}`);
        itemsMissingFromInventory.push(item);
        continue;
      }
      
      const currentQty = invRow.quantite || 1;
      
      if (currentQty > 1) {
        // Decrement quantity
        const { error: updateError } = await supabase
          .from('inventory')
          .update({ 
            quantite: currentQty - 1,
            dispo_attaque: currentQty - 1 > 0 
          })
          .eq('id', invRow.id);
        
        if (!updateError) {
          consumptionLogs.push(`Joueur ${item.playerNum} (${item.playerName}): -1 ${item.itemName} (reste: ${currentQty - 1})`);
          console.log(`[resolve-combat] Decremented ${item.itemName} for player ${item.playerNum}: ${currentQty} -> ${currentQty - 1}`);
        }
      } else {
        // Delete the row entirely
        const { error: deleteError } = await supabase
          .from('inventory')
          .delete()
          .eq('id', invRow.id);
        
        if (!deleteError) {
          consumptionLogs.push(`Joueur ${item.playerNum} (${item.playerName}): -1 ${item.itemName} (épuisé)`);
          console.log(`[resolve-combat] Deleted ${item.itemName} for player ${item.playerNum} (was last one)`);
        }
      }
    }

    // Log missing items to MJ if any
    if (itemsMissingFromInventory.length > 0) {
      const missingItemsMsg = itemsMissingFromInventory.map(
        i => `${i.playerName} (J${i.playerNum}): ${i.itemName} non trouvé en inventaire`
      ).join('\n');
      
      await supabase.from('logs_mj').insert({
        game_id: gameId,
        manche: manche,
        action: 'OBJET_ABSENT_INVENTAIRE',
        details: missingItemsMsg,
      });
    }

    // Log consumption to MJ
    if (consumptionLogs.length > 0) {
      await supabase.from('logs_mj').insert({
        game_id: gameId,
        manche: manche,
        action: 'INVENTAIRE_CONSO',
        details: consumptionLogs.join('\n'),
      });
    }

    // Calculate forest state
    const { data: updatedMonsters } = await supabase
      .from('game_state_monsters')
      .select('pv_current, status')
      .eq('game_id', gameId);

    const totalPvCurrent = updatedMonsters?.reduce((sum, m) => sum + (m.pv_current || 0), 0) || 0;
    const forestState = {
      totalPvRemaining: totalPvCurrent,
      monstersKilled: kills.length,
      itemsConsumed: consumedItems.filter(i => i.wasInInventory).length,
    };

    // Build public summary (NO TARGET INFO)
    const publicSummary = publicActions.map(a => ({
      position: a.position,
      nom: a.nom,
      weapons: a.weapons,
      totalDamage: a.cancelled ? 0 : a.totalDamage,
      cancelled: a.cancelled,
      cancelReason: a.cancelReason,
    }));

    // Build MJ summary (FULL DETAILS)
    const mjSummary = mjActions;

    // Store combat results
    await supabase.from('combat_results').insert({
      game_id: gameId,
      manche: manche,
      public_summary: publicSummary,
      mj_summary: mjSummary,
      kills: kills,
      forest_state: forestState,
    });

    // Create logs - NEW FORMAT: one line per player showing what they used and damage dealt
    // Format: "NomJoueur a utilisé "Arme" inflige X dégâts."
    const publicAttackMessages = publicActions.map(a => {
      if (a.cancelled) {
        const weaponsStr = a.weapons.length > 0 ? `"${a.weapons.join('" + "')}"` : 'aucune arme';
        return `${a.nom} a utilisé ${weaponsStr} — Attaque annulée (${a.cancelReason})`;
      }
      
      if (a.weapons.length === 0) {
        return `${a.nom} n'a pas attaqué`;
      }
      
      const weaponsStr = a.weapons.map(w => `"${w}"`).join(' + ');
      return `${a.nom} a utilisé ${weaponsStr} inflige ${a.totalDamage} dégâts.`;
    }).join('\n');

    // Kill messages for public log - show slot and reward
    const killMessages = kills.map(k => 
      `⚔️ ${k.killerName} a éliminé le monstre du Slot ${k.slot}. Récompense ${k.reward}.`
    ).join('\n');

    // MJ summary with full details (slots, targets, etc.)
    const mjAttackMessages = mjActions.map(a => {
      const slotInfo = a.slot_attaque ? `[Slot ${a.slot_attaque}${a.targetMonster ? ` → ${a.targetMonster}` : ''}]` : '[Pas d\'attaque]';
      const weaponsInfo = [a.attaque1, a.attaque2].filter(w => w && w !== 'Aucune').map(w => `"${w}"`).join(' + ') || 'Aucune arme';
      const protInfo = a.protection && a.protection !== 'Aucune' ? ` | Protection: "${a.protection}" sur slot ${a.slot_protection}` : '';
      
      if (a.cancelled) {
        return `#${a.position} ${a.nom} (J${a.num_joueur}) ${slotInfo} — ${weaponsInfo} — ANNULÉ (${a.cancelReason})${protInfo}`;
      }
      
      const killInfo = a.killed ? ` — ⚔️ KILL: ${a.killed}` : '';
      return `#${a.position} ${a.nom} (J${a.num_joueur}) ${slotInfo} — ${weaponsInfo} — ${a.totalDamage} dégâts${killInfo}${protInfo}`;
    }).join('\n');

    await Promise.all([
      // Public events
      supabase.from('session_events').insert({
        game_id: gameId,
        audience: 'ALL',
        type: 'COMBAT',
        message: '⚔️ Résolution du combat terminée',
        payload: { 
          type: 'COMBAT_RESOLVED',
          summary: publicSummary,
          kills: kills.map(k => ({ killer: k.killerName, monster: k.monsterName })),
          forestState,
        },
      }),
      // Public logs - new format without revealing slots
      supabase.from('logs_joueurs').insert({
        game_id: gameId,
        manche: manche,
        type: 'ATTAQUES_RESUME',
        message: publicAttackMessages,
      }),
      kills.length > 0 ? supabase.from('logs_joueurs').insert({
        game_id: gameId,
        manche: manche,
        type: 'COUP_DE_GRACE',
        message: killMessages,
      }) : Promise.resolve(),
      supabase.from('logs_joueurs').insert({
        game_id: gameId,
        manche: manche,
        type: 'ETAT_FORET',
        message: `🌲 État de la forêt: ${forestState.totalPvRemaining} PV restants (${kills.length} monstre(s) éliminé(s))`,
      }),
      // MJ logs - detailed version with slots and targets
      supabase.from('logs_mj').insert({
        game_id: gameId,
        manche: manche,
        action: 'COMBAT_RESOLU',
        details: mjAttackMessages,
      }),
      supabase.from('logs_mj').insert({
        game_id: gameId,
        manche: manche,
        action: 'COMBAT_DATA',
        details: JSON.stringify({ kills, rewards: rewardUpdates, berserkerPenalties }),
      }),
    ]);

    // Update game phase
    await supabase
      .from('games')
      .update({ phase: 'PHASE3_SHOP', phase_locked: false })
      .eq('id', gameId);

    console.log(`[resolve-combat] Combat resolved for game ${gameId}, manche ${manche}. Kills: ${kills.length}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Combat résolu',
        publicSummary,
        kills: kills.map(k => ({ killer: k.killerName, monster: k.monsterName })),
        forestState,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[resolve-combat] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erreur inconnue' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
