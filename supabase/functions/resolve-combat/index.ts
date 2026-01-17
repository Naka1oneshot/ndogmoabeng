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
  special_value: string | null;
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
  dotDamage?: number; // Extra damage from DOT effects
}

interface Kill {
  killerName: string;
  killerNum: number;
  monsterName: string;
  monsterId: number;
  slot: number;
  reward: number;
  fromDot?: boolean; // Kill from DOT effect
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
  dotDamage?: number;
  dotKills?: string[];
}

// Pending effect for DOT/delayed damage
interface PendingEffect {
  sourcePlayerNum: number;
  sourcePlayerName: string;
  weaponName: string;
  type: 'DOT' | 'DELAYED';
  damage: number;
  targetSlots: number[]; // [1,2,3] for AOE, or [slot] for single
  triggersAfterPlayers: number; // Number of players that must attack before this triggers
  remainingTriggers: number; // How many more triggers remain
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
    
    // Pending DOT/delayed effects
    const pendingEffects: PendingEffect[] = [];
    const dotLogs: string[] = [];
    
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
    
    // Helper to apply damage to a monster and check for kill
    const applyDamageToMonster = (
      slot: number, 
      damage: number, 
      attackerNum: number, 
      attackerName: string,
      fromDot: boolean = false
    ): { killed: boolean; monsterName: string | null } => {
      const monster = monsterBySlot.get(slot);
      if (!monster || monster.status !== 'EN_BATAILLE') {
        return { killed: false, monsterName: null };
      }
      
      monster.pv_current = Math.max(0, monster.pv_current - damage);
      
      if (monster.pv_current <= 0) {
        monster.status = 'MORT';
        
        kills.push({
          killerName: attackerName,
          killerNum: attackerNum,
          monsterName: monster.name || `Monstre ${monster.monster_id}`,
          monsterId: monster.monster_id,
          slot: slot,
          reward: monster.reward || 10,
          fromDot,
        });
        
        rewardUpdates.push({ playerNum: attackerNum, reward: monster.reward || 10 });
        return { killed: true, monsterName: monster.name || null };
      }
      
      return { killed: false, monsterName: monster.name || null };
    };
    
    // Helper to process pending DOT effects after a player's turn
    const processPendingEffects = (afterPosition: number): string[] => {
      const effectLogs: string[] = [];
      
      for (const effect of pendingEffects) {
        if (effect.remainingTriggers > 0) {
          effect.remainingTriggers--;
          
          if (effect.remainingTriggers === 0 || effect.type === 'DOT') {
            // Apply the effect
            const killedMonsters: string[] = [];
            
            for (const slot of effect.targetSlots) {
              const result = applyDamageToMonster(
                slot, 
                effect.damage, 
                effect.sourcePlayerNum, 
                effect.sourcePlayerName,
                true
              );
              if (result.killed && result.monsterName) {
                killedMonsters.push(`${result.monsterName} (Slot ${slot})`);
              }
            }
            
            const slotsStr = effect.targetSlots.length === 3 ? 'tous les slots' : `slot ${effect.targetSlots.join(', ')}`;
            let logMsg = `🔥 ${effect.weaponName} de ${effect.sourcePlayerName} inflige ${effect.damage} dégâts sur ${slotsStr}`;
            
            if (killedMonsters.length > 0) {
              logMsg += ` — ⚔️ KILL: ${killedMonsters.join(', ')}`;
            }
            
            effectLogs.push(logMsg);
            
            // For DOT effects that continue, reset the trigger counter
            if (effect.type === 'DOT' && effect.triggersAfterPlayers > 0) {
              effect.triggersAfterPlayers--;
              if (effect.triggersAfterPlayers > 0) {
                effect.remainingTriggers = 1; // Reset for next player
              }
            }
          }
        }
      }
      
      return effectLogs;
    };
    
    const berserkerPlayers: number[] = [];

    // Process each player in order of position_finale
    for (let i = 0; i < (positions as PositionFinale[]).length; i++) {
      const pos = (positions as PositionFinale[])[i];
      
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
        dotDamage: 0,
        dotKills: [],
      };

      const publicAction: PublicAction = {
        position: pos.position_finale,
        nom: pos.nom,
        num_joueur: pos.num_joueur,
        weapons: [],
        totalDamage: 0,
        totalHeal: 0,
        cancelled: false,
        dotDamage: 0,
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
        }
      }

      // Process attacks
      let damage1 = 0;
      let damage2 = 0;
      let aoeImmediate1 = 0;
      let aoeImmediate2 = 0;

      // Helper to process a single attack
      const processAttack = (attackName: string | null): { damage: number; isAoe: boolean; aoeDamage: number } => {
        if (!attackName || attackName === 'Aucune') {
          return { damage: 0, isAoe: false, aoeDamage: 0 };
        }
        
        const item = itemMap.get(attackName);
        if (!item) {
          return { damage: 0, isAoe: false, aoeDamage: 0 };
        }
        
        // Akande clan bonus (only for default weapon)
        let bonus = 0;
        if (pos.clan === 'Akandé' && attackName === PERMANENT_WEAPON) {
          bonus = 2;
        }
        
        const baseDamage = (item.base_damage || 0) + bonus;
        
        // Check for special effects
        if (item.special_effect === 'DOT' && item.target === 'AOE_3') {
          // Grenade incendiaire: 1 damage to all 3 slots immediately + DOT for 2 next players
          const numPlayers = parseInt(item.special_value || '2', 10);
          
          // Register pending DOT effect
          pendingEffects.push({
            sourcePlayerNum: pos.num_joueur,
            sourcePlayerName: pos.nom,
            weaponName: attackName,
            type: 'DOT',
            damage: baseDamage,
            targetSlots: [1, 2, 3],
            triggersAfterPlayers: numPlayers,
            remainingTriggers: 1, // Trigger after each of the next N players
          });
          
          return { damage: 0, isAoe: true, aoeDamage: baseDamage }; // Immediate AOE damage
        }
        
        if (item.special_effect === 'DEGATS_RETARDES') {
          // Grenade Frag: delayed damage at end of next player's turn
          const numPlayers = parseInt(item.special_value || '1', 10);
          
          pendingEffects.push({
            sourcePlayerNum: pos.num_joueur,
            sourcePlayerName: pos.nom,
            weaponName: attackName,
            type: 'DELAYED',
            damage: baseDamage,
            targetSlots: targetSlot ? [targetSlot] : [],
            triggersAfterPlayers: numPlayers,
            remainingTriggers: numPlayers,
          });
          
          return { damage: 0, isAoe: false, aoeDamage: 0 }; // No immediate damage
        }
        
        // Check if ignore_protection
        if (item.ignore_protection && targetSlot) {
          attackCancelled = false;
          cancelReason = '';
        }
        
        // Track Piqure Berseker
        if (attackName === 'Piqure Berseker') {
          berserkerPlayers.push(pos.num_joueur);
        }
        
        return { damage: baseDamage, isAoe: false, aoeDamage: 0 };
      };

      if (pos.attaque1 && pos.attaque1 !== 'Aucune') {
        publicAction.weapons.push(pos.attaque1);
        const result = processAttack(pos.attaque1);
        damage1 = result.damage;
        aoeImmediate1 = result.aoeDamage;
        trackItemConsumption(pos.num_joueur, pos.nom, pos.attaque1);
      }

      if (pos.attaque2 && pos.attaque2 !== 'Aucune') {
        publicAction.weapons.push(pos.attaque2);
        const result = processAttack(pos.attaque2);
        damage2 = result.damage;
        aoeImmediate2 = result.aoeDamage;
        trackItemConsumption(pos.num_joueur, pos.nom, pos.attaque2);
      }

      mjAction.damage1 = damage1;
      mjAction.damage2 = damage2;

      // Apply cancellation to direct damage only
      if (attackCancelled) {
        mjAction.cancelled = true;
        mjAction.cancelReason = cancelReason;
        publicAction.cancelled = true;
        publicAction.cancelReason = cancelReason;
        damage1 = 0;
        damage2 = 0;
      }

      const totalDirectDamage = damage1 + damage2;
      
      // Apply AOE immediate damage (Grenade incendiaire) - not affected by cancellation on single slot
      const totalAoeDamage = aoeImmediate1 + aoeImmediate2;
      if (totalAoeDamage > 0) {
        for (const slot of [1, 2, 3]) {
          const result = applyDamageToMonster(slot, totalAoeDamage, pos.num_joueur, pos.nom, false);
          if (result.killed && result.monsterName) {
            mjAction.killed = (mjAction.killed ? mjAction.killed + ', ' : '') + result.monsterName;
          }
        }
        dotLogs.push(`🔥 ${pos.nom} lance Grenade incendiaire : ${totalAoeDamage} dégâts immédiats sur tous les slots`);
      }

      mjAction.totalDamage = totalDirectDamage;
      publicAction.totalDamage = totalDirectDamage + (totalAoeDamage * 3); // Total damage including AOE

      // Apply direct damage to target monster
      if (targetSlot && totalDirectDamage > 0) {
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
            publicAction.totalDamage = totalAoeDamage * 3; // Only AOE damage counts
          } else {
            // Apply damage
            const result = applyDamageToMonster(targetSlot, totalDirectDamage, pos.num_joueur, pos.nom, false);
            if (result.killed && result.monsterName) {
              mjAction.killed = (mjAction.killed ? mjAction.killed + ', ' : '') + result.monsterName;
            }
          }
        }
      }

      publicActions.push(publicAction);
      mjActions.push(mjAction);
      
      // Process pending DOT/delayed effects after this player's turn
      const effectLogs = processPendingEffects(pos.position_finale);
      if (effectLogs.length > 0) {
        dotLogs.push(...effectLogs);
        // Update the MJ action with DOT kills
        for (const log of effectLogs) {
          if (log.includes('KILL:')) {
            const killMatch = log.match(/KILL: (.+)$/);
            if (killMatch) {
              mjAction.dotKills = mjAction.dotKills || [];
              mjAction.dotKills.push(killMatch[1]);
            }
          }
        }
      }
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
    const killMessages = kills.map(k => {
      const dotSuffix = k.fromDot ? ' (effet retardé)' : '';
      return `⚔️ ${k.killerName} a éliminé le monstre du Slot ${k.slot}. Récompense ${k.reward}.${dotSuffix}`;
    }).join('\n');

    // Berseker penalty messages for public log
    const bersekerPenaltyMessages = berserkerPenalties.length > 0 
      ? berserkerPenalties.map(p => {
          const playerName = positions?.find((pos: PositionFinale) => pos.num_joueur === p.playerNum)?.nom || `Joueur ${p.playerNum}`;
          return `💀 ${playerName} a utilisé Piqure Berseker sans coup de grâce : -10 jetons`;
        }).join('\n')
      : '';

    // DOT effects log for public
    const dotPublicMessages = dotLogs.length > 0 ? dotLogs.join('\n') : '';

    // MJ summary with full details (slots, targets, etc.)
    const mjAttackMessages = mjActions.map(a => {
      const slotInfo = a.slot_attaque ? `[Slot ${a.slot_attaque}${a.targetMonster ? ` → ${a.targetMonster}` : ''}]` : '[Pas d\'attaque]';
      const weaponsInfo = [a.attaque1, a.attaque2].filter(w => w && w !== 'Aucune').map(w => `"${w}"`).join(' + ') || 'Aucune arme';
      const protInfo = a.protection && a.protection !== 'Aucune' ? ` | Protection: "${a.protection}" sur slot ${a.slot_protection}` : '';
      
      if (a.cancelled) {
        return `#${a.position} ${a.nom} (J${a.num_joueur}) ${slotInfo} — ${weaponsInfo} — ANNULÉ (${a.cancelReason})${protInfo}`;
      }
      
      const killInfo = a.killed ? ` — ⚔️ KILL: ${a.killed}` : '';
      const dotKillInfo = a.dotKills && a.dotKills.length > 0 ? ` — 🔥 DOT KILL: ${a.dotKills.join(', ')}` : '';
      return `#${a.position} ${a.nom} (J${a.num_joueur}) ${slotInfo} — ${weaponsInfo} — ${a.totalDamage} dégâts${killInfo}${dotKillInfo}${protInfo}`;
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
          kills: kills.map(k => ({ killer: k.killerName, monster: k.monsterName, fromDot: k.fromDot })),
          forestState,
          berserkerPenalties: berserkerPenalties.map(p => p.playerNum),
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
      bersekerPenaltyMessages ? supabase.from('logs_joueurs').insert({
        game_id: gameId,
        manche: manche,
        type: 'PENALITE_BERSEKER',
        message: bersekerPenaltyMessages,
      }) : Promise.resolve(),
      dotPublicMessages ? supabase.from('logs_joueurs').insert({
        game_id: gameId,
        manche: manche,
        type: 'EFFETS_RETARDES',
        message: dotPublicMessages,
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
        details: JSON.stringify({ kills, rewards: rewardUpdates, berserkerPenalties, dotEffects: dotLogs }),
      }),
    ]);

    // Update game phase
    await supabase
      .from('games')
      .update({ phase: 'PHASE3_SHOP', phase_locked: false })
      .eq('id', gameId);

    console.log(`[resolve-combat] Combat resolved for game ${gameId}, manche ${manche}. Kills: ${kills.length}, DOT effects: ${dotLogs.length}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Combat résolu',
        publicSummary,
        kills: kills.map(k => ({ killer: k.killerName, monster: k.monsterName, fromDot: k.fromDot })),
        forestState,
        dotEffects: dotLogs,
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
