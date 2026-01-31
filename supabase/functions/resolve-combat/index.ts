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
  created_at?: string;
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
  dotDamage?: number;
  minePlaced?: { slot: number; weapon: string };
  delayedExplosion?: { damage: number; slot: number; weapon: string };
  noMonster?: boolean;
  protectionUsed?: { item: string; slot: number };
  reservedItem?: string; // Item was reserved for a specific clan
}

interface Kill {
  killerName: string;
  killerNum: number;
  monsterName: string;
  monsterId: number;
  slot: number;
  reward: number;
  fromDot?: boolean;
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

// Pending effect types - now includes BRUME_PERSISTENT
interface PendingEffect {
  sourcePlayerNum: number;
  sourcePlayerName: string;
  weaponName: string;
  type: 'DOT' | 'DELAYED' | 'DOT_PERSISTENT' | 'MINE' | 'BRUME_PERSISTENT';
  damage: number;
  targetSlots: number[];
  triggersAfterPlayers: number;
  remainingTriggers: number;
  ignoreProtection?: boolean; // For Totem de Rupture bypass
}

// Voile tracking
interface VoileEffect {
  activatedAt: number;
  playerNum: number;
  slot: number;
}

// Amulette tracking
interface AmuletteEffect {
  playerNum: number;
  mateNum: number;
  position: number;
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
    const sessionGameId = game.current_session_game_id;
    console.log(`[resolve-combat] Processing game ${gameId}, session_game ${sessionGameId}, manche ${manche}`);

    // Check idempotence
    const idempotenceQuery = supabase
      .from('combat_results')
      .select('*')
      .eq('game_id', gameId)
      .eq('manche', manche);
    
    if (sessionGameId) {
      idempotenceQuery.eq('session_game_id', sessionGameId);
    }
    
    const { data: existingResult } = await idempotenceQuery.single();

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
    const monstersQuery = supabase.from('game_state_monsters').select('*').eq('game_id', gameId);
    if (sessionGameId) {
      monstersQuery.eq('session_game_id', sessionGameId);
    }
    
    const inventoryQuery = supabase.from('inventory').select('*').eq('game_id', gameId);
    const positionsQuery = supabase.from('positions_finales').select('*').eq('game_id', gameId).eq('manche', manche);
    positionsQuery.order('position_finale', { ascending: true });
    
    const [
      { data: positions },
      { data: itemCatalog },
      { data: monsters },
      { data: monsterCatalog },
      { data: inventory },
      { data: players },
    ] = await Promise.all([
      positionsQuery,
      supabase.from('item_catalog').select('*'),
      monstersQuery,
      supabase.from('monster_catalog').select('*'),
      inventoryQuery,
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
    
    // Player mate mapping
    const playerMateMap = new Map<number, number>();
    for (const player of players || []) {
      if (player.player_number && player.mate_num) {
        playerMateMap.set(player.player_number, player.mate_num);
      }
    }
    
    // Monster state by slot
    const monsterBySlot = new Map<number, Monster>();
    const monstersById = new Map<string, Monster>();
    const monstersInQueue: Monster[] = [];
    
    for (const m of monsters || []) {
      const monster: Monster = {
        ...m,
        name: monsterNameMap.get(m.monster_id) || `Monstre ${m.monster_id}`,
        reward: monsterRewardMap.get(m.monster_id) || 10,
        created_at: m.created_at,
      };
      monstersById.set(m.id, monster);
      if (m.status === 'EN_BATAILLE' && m.battlefield_slot) {
        monsterBySlot.set(m.battlefield_slot, monster);
      } else if (m.status === 'EN_FILE') {
        monstersInQueue.push(monster);
      }
    }
    
    // Sort queue by monster_id ascending
    monstersInQueue.sort((a, b) => a.monster_id - b.monster_id);

    // Inventory map
    const inventoryMap = new Map<string, number>();
    for (const inv of inventory || []) {
      const key = `${inv.owner_num}_${inv.objet}`;
      inventoryMap.set(key, (inventoryMap.get(key) || 0) + (inv.quantite || 0));
    }

    // Load pending effects from previous round
    const { data: pendingFromDb } = await supabase
      .from('pending_effects')
      .select('*')
      .eq('game_id', gameId)
      .eq('manche', manche);
    
    console.log(`[resolve-combat] Loaded ${pendingFromDb?.length || 0} pending effects from DB for manche ${manche}`);

    // Protection maps
    const shieldBySlot = new Map<number, { activatedAt: number; playerNum: number }>();
    const gazActiveSlots = new Map<number, { activatedAt: number; playerNum: number }>();
    const voileEffects: VoileEffect[] = [];
    const amuletteEffects: AmuletteEffect[] = [];

    const publicActions: PublicAction[] = [];
    const mjActions: MJAction[] = [];
    const kills: Kill[] = [];
    const rewardUpdates: { playerNum: number; reward: number }[] = [];
    const consumedItems: ConsumedItem[] = [];
    
    const PERMANENT_WEAPON = 'Par défaut (+2 si compagnon Akandé)';
    
    const pendingEffects: PendingEffect[] = [];
    const dotLogs: string[] = [];
    
    const playerKillBonusWeapons = new Map<number, { weaponName: string; bonusTokens: number }[]>();
    const killBonusTokens: { playerNum: number; playerName: string; weaponName: string; bonus: number }[] = [];
    const voilePenalties: { playerNum: number; playerName: string; tokens: number; reason: string }[] = [];
    const voileGains: { playerNum: number; playerName: string; tokens: number }[] = [];
    const damageMultipliers = new Map<number, number>();
    
    // ==========================================
    // B1) UNIFIED PROTECTION CHECK HELPER
    // Returns true if slot is protected by ANY protection (unless ignoreProtection)
    // ==========================================
    const isSlotProtected = (
      slot: number, 
      currentPosition: number, 
      ignoreProtection: boolean
    ): { protected: boolean; reason: string | null; ownerNum: number | null } => {
      // Totem de Rupture bypasses ALL protections (choix 15)
      if (ignoreProtection) {
        return { protected: false, reason: null, ownerNum: null };
      }
      
      // Check Gaz Soporifique (affects ALL slots after activation)
      for (const [, gaz] of gazActiveSlots) {
        if (gaz.activatedAt < currentPosition) {
          return { protected: true, reason: 'Gaz Soporifique', ownerNum: gaz.playerNum };
        }
      }
      
      // Check Bouclier rituel (per-slot protection)
      const shield = shieldBySlot.get(slot);
      if (shield && shield.activatedAt < currentPosition) {
        return { protected: true, reason: 'Bouclier rituel', ownerNum: shield.playerNum };
      }
      
      // Check Voile du Gardien (per-slot protection)
      for (const voile of voileEffects) {
        if (voile.slot === slot && voile.activatedAt < currentPosition) {
          return { protected: true, reason: 'Voile du Gardien', ownerNum: voile.playerNum };
        }
      }
      
      return { protected: false, reason: null, ownerNum: null };
    };
    
    // Helper to track item consumption
    const trackItemConsumption = (playerNum: number, playerName: string, itemName: string) => {
      if (!itemName || itemName === 'Aucune' || itemName === '' || itemName === PERMANENT_WEAPON) {
        return;
      }
      const invKey = `${playerNum}_${itemName}`;
      const hasItem = (inventoryMap.get(invKey) || 0) > 0;
      consumedItems.push({
        playerNum,
        playerName,
        itemName,
        wasInInventory: hasItem,
      });
    };
    
    // Helper to promote the next monster from queue to a battlefield slot
    const promoteNextMonsterToSlot = (slot: number): Monster | null => {
      if (monstersInQueue.length === 0) {
        console.log(`[resolve-combat] PROMOTE: No monsters in queue for slot ${slot}`);
        return null;
      }
      
      const nextMonster = monstersInQueue.shift()!;
      nextMonster.status = 'EN_BATAILLE';
      nextMonster.battlefield_slot = slot;
      monsterBySlot.set(slot, nextMonster);
      
      console.log(`[resolve-combat] PROMOTE: Monster ${nextMonster.name} (ID ${nextMonster.monster_id}) promoted to slot ${slot} from queue`);
      return nextMonster;
    };
    
    // Helper to ensure there's an active monster on a slot
    const ensureActiveMonster = (slot: number): Monster | null => {
      const currentMonster = monsterBySlot.get(slot);
      
      if (currentMonster && currentMonster.status === 'EN_BATAILLE') {
        return currentMonster;
      }
      
      return promoteNextMonsterToSlot(slot);
    };
    
    // Helper to apply damage to a monster with IMMEDIATE REPLACEMENT
    const applyDamageToMonster = (
      slot: number, 
      damage: number, 
      attackerNum: number, 
      attackerName: string,
      fromDot: boolean = false
    ): { killed: boolean; monsterName: string | null; damageDealt: number; noMonster: boolean } => {
      const monster = ensureActiveMonster(slot);
      
      if (!monster) {
        console.log(`[resolve-combat] NO MONSTER: Attack on slot ${slot} by ${attackerName} - no monster present, applied 0 damage`);
        return { killed: false, monsterName: null, damageDealt: 0, noMonster: true };
      }
      
      monster.pv_current = Math.max(0, monster.pv_current - damage);
      
      if (monster.pv_current <= 0) {
        monster.status = 'MORT';
        monsterBySlot.delete(slot);
        
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
        
        // Apply kill bonus tokens - only for non-DOT kills
        if (!fromDot) {
          const bonusWeapons = playerKillBonusWeapons.get(attackerNum);
          if (bonusWeapons && bonusWeapons.length > 0) {
            for (const bw of bonusWeapons) {
              killBonusTokens.push({
                playerNum: attackerNum,
                playerName: attackerName,
                weaponName: bw.weaponName,
                bonus: bw.bonusTokens,
              });
            }
          }
        }
        
        // IMMEDIATE REPLACEMENT
        const promotedMonster = promoteNextMonsterToSlot(slot);
        if (promotedMonster) {
          console.log(`[resolve-combat] IMMEDIATE REPLACEMENT: ${monster.name} died on slot ${slot}, ${promotedMonster.name} takes its place`);
        } else {
          console.log(`[resolve-combat] SLOT NOW EMPTY: ${monster.name} died on slot ${slot}, no more monsters in queue`);
        }
        
        return { killed: true, monsterName: monster.name || null, damageDealt: damage, noMonster: false };
      }
      
      return { killed: false, monsterName: monster.name || null, damageDealt: damage, noMonster: false };
    };
    
    const delayedExplosions: Map<number, { damage: number; slot: number; weapon: string }> = new Map();
    
    // ==========================================
    // PROCESS PENDING EFFECTS (DOT, DELAYED, BRUME)
    // Now respects Gaz + Bouclier + Voile (B6, B7, B9, B12)
    // ==========================================
    const processPendingEffects = (afterPosition: number): string[] => {
      const effectLogs: string[] = [];
      
      for (const effect of pendingEffects) {
        if (effect.remainingTriggers > 0) {
          const ignoresProtection = effect.ignoreProtection === true;
          
          // BRUME_PERSISTENT: 1 dmg per remaining player tick (choix 10-C)
          if (effect.type === 'BRUME_PERSISTENT') {
            const killedMonsters: string[] = [];
            const blockedSlots: number[] = [];
            
            for (const slot of effect.targetSlots) {
              const protCheck = isSlotProtected(slot, afterPosition, ignoresProtection);
              
              if (protCheck.protected) {
                // Voile gains/losses for blocked BRUME (B11, B13)
                if (protCheck.reason === 'Voile du Gardien' && protCheck.ownerNum) {
                  voilePenalties.push({
                    playerNum: effect.sourcePlayerNum,
                    playerName: effect.sourcePlayerName,
                    tokens: effect.damage,
                    reason: `Voile du Gardien (${effect.weaponName} BRUME)`,
                  });
                  const voileOwnerName = players?.find(p => p.player_number === protCheck.ownerNum)?.display_name || `Joueur ${protCheck.ownerNum}`;
                  voileGains.push({
                    playerNum: protCheck.ownerNum,
                    playerName: voileOwnerName,
                    tokens: effect.damage,
                  });
                }
                blockedSlots.push(slot);
                console.log(`[resolve-combat] BRUME blocked on slot ${slot} by ${protCheck.reason}`);
                continue;
              }
              
              const result = applyDamageToMonster(slot, effect.damage, effect.sourcePlayerNum, effect.sourcePlayerName, true);
              if (result.noMonster) {
                effectLogs.push(`🌫️ ${effect.weaponName} BRUME tick sur slot ${slot} — pas de monstre`);
              } else if (result.killed && result.monsterName) {
                killedMonsters.push(`${result.monsterName} (Slot ${slot})`);
              }
            }
            
            const appliedSlots = effect.targetSlots.filter(s => !blockedSlots.includes(s));
            if (appliedSlots.length > 0) {
              let logMsg = `🌫️ ${effect.weaponName} BRUME tick ${effect.triggersAfterPlayers - effect.remainingTriggers + 1}/${effect.triggersAfterPlayers} : ${effect.damage} dégât(s) sur slot ${appliedSlots.join(', ')}`;
              if (killedMonsters.length > 0) {
                logMsg += ` — ⚔️ KILL: ${killedMonsters.join(', ')}`;
              }
              effectLogs.push(logMsg);
            }
            if (blockedSlots.length > 0) {
              effectLogs.push(`🛡️ BRUME bloquée sur slot ${blockedSlots.join(', ')} (${effect.targetSlots.map(s => blockedSlots.includes(s) ? isSlotProtected(s, afterPosition, false).reason : '').filter(Boolean).join('/')})`);
            }
            effect.remainingTriggers--;
          }
          // DOT_PERSISTENT triggers after every player
          else if (effect.type === 'DOT_PERSISTENT') {
            const killedMonsters: string[] = [];
            const blockedSlots: number[] = [];
            
            for (const slot of effect.targetSlots) {
              const protCheck = isSlotProtected(slot, afterPosition, ignoresProtection);
              
              if (protCheck.protected) {
                if (protCheck.reason === 'Voile du Gardien' && protCheck.ownerNum) {
                  voilePenalties.push({
                    playerNum: effect.sourcePlayerNum,
                    playerName: effect.sourcePlayerName,
                    tokens: effect.damage,
                    reason: `Voile du Gardien (${effect.weaponName})`,
                  });
                  const voileOwnerName = players?.find(p => p.player_number === protCheck.ownerNum)?.display_name || `Joueur ${protCheck.ownerNum}`;
                  voileGains.push({
                    playerNum: protCheck.ownerNum,
                    playerName: voileOwnerName,
                    tokens: effect.damage,
                  });
                }
                blockedSlots.push(slot);
                effectLogs.push(`🛡️ DOT bloqué sur slot ${slot} (${protCheck.reason})`);
                console.log(`[resolve-combat] DOT blocked on slot ${slot} by ${protCheck.reason}`);
                continue;
              }
              
              const result = applyDamageToMonster(slot, effect.damage, effect.sourcePlayerNum, effect.sourcePlayerName, true);
              if (result.noMonster) {
                effectLogs.push(`🔥 ${effect.weaponName} DOT sur slot ${slot} — pas de monstre`);
              } else if (result.killed && result.monsterName) {
                killedMonsters.push(`${result.monsterName} (Slot ${slot})`);
              }
            }
            
            const appliedSlots = effect.targetSlots.filter(s => !blockedSlots.includes(s));
            if (appliedSlots.length > 0) {
              let logMsg = `🌫️ ${effect.weaponName} de ${effect.sourcePlayerName} inflige ${effect.damage} dégâts sur slot ${appliedSlots.join(', ')}`;
              if (killedMonsters.length > 0) {
                logMsg += ` — ⚔️ KILL: ${killedMonsters.join(', ')}`;
              }
              effectLogs.push(logMsg);
            }
            effect.remainingTriggers--;
          }
          // DOT triggers after each of the next N players (Grenade incendiaire)
          else if (effect.type === 'DOT') {
            effect.remainingTriggers--;
            
            const killedMonsters: string[] = [];
            const blockedSlots: number[] = [];
            
            for (const slot of effect.targetSlots) {
              const protCheck = isSlotProtected(slot, afterPosition, ignoresProtection);
              
              if (protCheck.protected) {
                if (protCheck.reason === 'Voile du Gardien' && protCheck.ownerNum) {
                  voilePenalties.push({
                    playerNum: effect.sourcePlayerNum,
                    playerName: effect.sourcePlayerName,
                    tokens: effect.damage,
                    reason: `Voile du Gardien (${effect.weaponName})`,
                  });
                  const voileOwnerName = players?.find(p => p.player_number === protCheck.ownerNum)?.display_name || `Joueur ${protCheck.ownerNum}`;
                  voileGains.push({
                    playerNum: protCheck.ownerNum,
                    playerName: voileOwnerName,
                    tokens: effect.damage,
                  });
                }
                blockedSlots.push(slot);
                effectLogs.push(`🛡️ DOT bloqué sur slot ${slot} (${protCheck.reason})`);
                console.log(`[resolve-combat] DOT blocked on slot ${slot} by ${protCheck.reason}`);
                continue;
              }
              
              const result = applyDamageToMonster(slot, effect.damage, effect.sourcePlayerNum, effect.sourcePlayerName, true);
              if (result.noMonster) {
                effectLogs.push(`🔥 ${effect.weaponName} DOT sur slot ${slot} — pas de monstre`);
              } else if (result.killed && result.monsterName) {
                killedMonsters.push(`${result.monsterName} (Slot ${slot})`);
              }
            }
            
            const appliedSlots = effect.targetSlots.filter(s => !blockedSlots.includes(s));
            const slotsStr = appliedSlots.length === 3 ? 'tous les slots' : `slot ${appliedSlots.join(', ')}`;
            if (appliedSlots.length > 0) {
              let logMsg = `🔥 ${effect.weaponName} de ${effect.sourcePlayerName} inflige ${effect.damage} dégâts sur ${slotsStr}`;
              if (killedMonsters.length > 0) {
                logMsg += ` — ⚔️ KILL: ${killedMonsters.join(', ')}`;
              }
              effectLogs.push(logMsg);
            }
          }
          // DELAYED triggers only after N players (Grenade Frag) - B6: blocked by Gaz + Bouclier
          else if (effect.type === 'DELAYED') {
            effect.remainingTriggers--;
            
            if (effect.remainingTriggers === 0) {
              const killedMonsters: string[] = [];
              const blockedSlots: number[] = [];
              
              for (const slot of effect.targetSlots) {
                const protCheck = isSlotProtected(slot, afterPosition, ignoresProtection);
                
                if (protCheck.protected) {
                  if (protCheck.reason === 'Voile du Gardien' && protCheck.ownerNum) {
                    voilePenalties.push({
                      playerNum: effect.sourcePlayerNum,
                      playerName: effect.sourcePlayerName,
                      tokens: effect.damage,
                      reason: `Voile du Gardien (${effect.weaponName})`,
                    });
                    const voileOwnerName = players?.find(p => p.player_number === protCheck.ownerNum)?.display_name || `Joueur ${protCheck.ownerNum}`;
                    voileGains.push({
                      playerNum: protCheck.ownerNum,
                      playerName: voileOwnerName,
                      tokens: effect.damage,
                    });
                  }
                  blockedSlots.push(slot);
                  effectLogs.push(`🛡️ Explosion retardée bloquée sur slot ${slot} (${protCheck.reason})`);
                  console.log(`[resolve-combat] DELAYED explosion blocked on slot ${slot} by ${protCheck.reason}`);
                  continue;
                }
                
                const result = applyDamageToMonster(slot, effect.damage, effect.sourcePlayerNum, effect.sourcePlayerName, true);
                if (result.noMonster) {
                  effectLogs.push(`💥 ${effect.weaponName} explose sur slot ${slot} — pas de monstre`);
                } else if (result.killed && result.monsterName) {
                  killedMonsters.push(`${result.monsterName} (Slot ${slot})`);
                }
              }
              
              const appliedSlots = effect.targetSlots.filter(s => !blockedSlots.includes(s));
              if (appliedSlots.length > 0) {
                delayedExplosions.set(effect.sourcePlayerNum, {
                  damage: effect.damage,
                  slot: appliedSlots[0],
                  weapon: effect.weaponName,
                });
                
                let logMsg = `💥 ${effect.weaponName} de ${effect.sourcePlayerName} explose : ${effect.damage} dégâts sur slot ${appliedSlots.join(', ')}`;
                if (killedMonsters.length > 0) {
                  logMsg += ` — ⚔️ KILL: ${killedMonsters.join(', ')}`;
                }
                effectLogs.push(logMsg);
              }
            }
          }
        }
      }
      
      return effectLogs;
    };
    
    const berserkerPlayers: number[] = [];
    const berserkerDefaultAttack2: number[] = []; // Track players who got default attack2
    const totalPlayers = (positions as PositionFinale[]).length;

    // ==========================================
    // B5) APPLY PENDING EFFECTS FROM PREVIOUS ROUND (Mines) via applyDamageToMonster
    // ==========================================
    const mineKills: Kill[] = [];
    const mineLogs: string[] = [];
    
    if (pendingFromDb && pendingFromDb.length > 0) {
      for (const effect of pendingFromDb) {
        if (effect.type === 'MINE' && effect.slot) {
          const mineItem = itemMap.get(effect.weapon || 'Mine');
          const damage = mineItem?.base_damage || 10;
          const attackerName = players?.find(p => p.player_number === effect.by_num)?.display_name || `Joueur ${effect.by_num}`;
          
          console.log(`[resolve-combat] MINE: Applying via applyDamageToMonster - slot ${effect.slot}, damage ${damage}, by ${attackerName}`);
          
          // B5: Use applyDamageToMonster for immediate replacement
          const result = applyDamageToMonster(effect.slot, damage, effect.by_num || 0, attackerName, true);
          
          let mineLog = `💣 Mine de ${attackerName} explose sur slot ${effect.slot}`;
          
          if (result.noMonster) {
            mineLog += ` — pas de monstre (0 dégâts)`;
          } else {
            mineLog += ` : ${damage} dégâts`;
            if (result.killed && result.monsterName) {
              mineLog += ` — ⚔️ KILL: ${result.monsterName}`;
              // Note: kills are already added by applyDamageToMonster
            }
          }
          
          mineLogs.push(mineLog);
        }
      }
      
      // Delete processed pending effects
      const effectIds = pendingFromDb.map(e => e.id);
      if (effectIds.length > 0) {
        await supabase
          .from('pending_effects')
          .delete()
          .in('id', effectIds);
        console.log(`[resolve-combat] Deleted ${effectIds.length} processed pending effects`);
      }
    }

    // First pass: collect Amulette effects
    for (const pos of positions as PositionFinale[]) {
      if (pos.attaque1 === 'Amulette de soutien' || pos.attaque2 === 'Amulette de soutien') {
        const mateNum = playerMateMap.get(pos.num_joueur);
        if (mateNum) {
          amuletteEffects.push({
            playerNum: pos.num_joueur,
            mateNum: mateNum,
            position: pos.position_finale,
          });
          damageMultipliers.set(mateNum, (damageMultipliers.get(mateNum) || 1) * 2);
          console.log(`[resolve-combat] Amulette: Player ${pos.num_joueur} doubles damage for mate ${mateNum}`);
        }
      }
    }

    // Process each player in order of position_finale
    for (let i = 0; i < totalPlayers; i++) {
      const pos = (positions as PositionFinale[])[i];
      
      // B4: Berseker - force default attack2 if missing
      let effectiveAttack2 = pos.attaque2;
      const hasBerseker = pos.attaque1 === 'Piqure Berseker' || pos.attaque2 === 'Piqure Berseker';
      
      if (hasBerseker && (!effectiveAttack2 || effectiveAttack2 === 'Aucune' || effectiveAttack2 === '')) {
        effectiveAttack2 = PERMANENT_WEAPON;
        berserkerDefaultAttack2.push(pos.num_joueur);
        console.log(`[resolve-combat] BERSEKER: Player ${pos.num_joueur} has no attack2, forcing default weapon "${PERMANENT_WEAPON}"`);
      }
      
      const mjAction: MJAction = {
        position: pos.position_finale,
        nom: pos.nom,
        num_joueur: pos.num_joueur,
        slot_attaque: pos.slot_attaque,
        attaque1: pos.attaque1,
        attaque2: effectiveAttack2,
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

      // Process protection first
      if (pos.protection && pos.slot_protection && pos.protection !== 'Aucune' && pos.protection !== PERMANENT_WEAPON) {
        const protItem = itemMap.get(pos.protection);
        if (protItem) {
          // Bouclier rituel: blocks all damage after this position (B9: extended to DOT/delayed/BRUME)
          if (protItem.special_effect === 'INVULNERABILITE_APRES' || protItem.special_effect === 'BOUCLIER_MIROIR' || pos.protection === 'Bouclier rituel') {
            shieldBySlot.set(pos.slot_protection, { activatedAt: pos.position_finale, playerNum: pos.num_joueur });
            console.log(`[resolve-combat] Bouclier rituel: Slot ${pos.slot_protection} protected after position ${pos.position_finale}`);
          } else if (protItem.special_effect === 'RENVOI_JETONS' || pos.protection === 'Voile du Gardien') {
            voileEffects.push({
              activatedAt: pos.position_finale,
              playerNum: pos.num_joueur,
              slot: pos.slot_protection,
            });
          } else if (protItem.special_effect === 'ANNULATION_ATTAQUE' || protItem.special_effect === 'GAZ_ANNULATION' || pos.protection === 'Gaz Soporifique') {
            // B12: Gaz also cancels delayed/DOT triggered after activation
            for (let slot = 1; slot <= 3; slot++) {
              gazActiveSlots.set(slot, { activatedAt: pos.position_finale, playerNum: pos.num_joueur });
            }
          } else if (protItem.special_effect === 'SOIN_DEPASSE_MAX' || pos.protection === 'Essence de Ndogmoabeng') {
            // B10: Promote from queue if slot empty before healing
            const healAmount = protItem.base_heal || 6;
            let monster = monsterBySlot.get(pos.slot_protection);
            
            if (!monster || monster.status !== 'EN_BATAILLE') {
              // Promote from queue first
              const promoted = ensureActiveMonster(pos.slot_protection);
              if (promoted) {
                monster = promoted;
                console.log(`[resolve-combat] Essence de Ndogmoabeng: Promoted ${monster.name} to slot ${pos.slot_protection} before healing`);
              }
            }
            
            if (monster && monster.status === 'EN_BATAILLE') {
              monster.pv_current += healAmount;
              console.log(`[resolve-combat] Essence de Ndogmoabeng: ${pos.nom} heals monster on slot ${pos.slot_protection} for ${healAmount} PV (now ${monster.pv_current})`);
              dotLogs.push(`💚 ${pos.nom} utilise Essence de Ndogmoabeng : +${healAmount} PV au monstre du slot ${pos.slot_protection}`);
            } else {
              console.log(`[resolve-combat] Essence de Ndogmoabeng: No monster on slot ${pos.slot_protection} and none in queue — heal=0`);
              dotLogs.push(`💚 ${pos.nom} utilise Essence de Ndogmoabeng sur slot ${pos.slot_protection} — pas de monstre (0 soin)`);
            }
          }
          
          trackItemConsumption(pos.num_joueur, pos.nom, pos.protection);
          publicAction.protectionUsed = { item: pos.protection, slot: pos.slot_protection };
        }
      }

      // Check if attacks are cancelled by protections
      const targetSlot = pos.slot_attaque;
      let attackCancelled = false;
      let cancelReason = '';
      let ignoreProtection = false;

      // Check for items that ignore protection (Totem de Rupture - choix 15)
      const att1Item = pos.attaque1 ? itemMap.get(pos.attaque1) : null;
      const att2Item = effectiveAttack2 ? itemMap.get(effectiveAttack2) : null;
      if (att1Item?.ignore_protection || att2Item?.ignore_protection) {
        ignoreProtection = true;
        console.log(`[resolve-combat] TOTEM DE RUPTURE: Player ${pos.num_joueur} ignores ALL protections`);
      }

      if (targetSlot && !ignoreProtection) {
        const protCheck = isSlotProtected(targetSlot, pos.position_finale, false);
        if (protCheck.protected && protCheck.reason) {
          attackCancelled = true;
          cancelReason = protCheck.reason;
        }
      }

      // Process attacks
      let damage1 = 0;
      let damage2 = 0;
      let aoeImmediate1 = 0;
      let aoeImmediate2 = 0;
      let reservedItemNote: string | null = null;

      const processAttack = (attackName: string | null, isSecondAttack: boolean = false): { damage: number; isAoe: boolean; aoeDamage: number; reserved?: boolean } => {
        if (!attackName || attackName === 'Aucune') {
          return { damage: 0, isAoe: false, aoeDamage: 0 };
        }
        
        const item = itemMap.get(attackName);
        if (!item) {
          console.log(`[resolve-combat] WARNING: Item "${attackName}" not found in catalog for ${pos.nom}`);
          return { damage: 0, isAoe: false, aoeDamage: 0 };
        }
        
        console.log(`[resolve-combat] Processing attack "${attackName}" by ${pos.nom} (pos ${pos.position_finale}), slot_attaque=${targetSlot}, special_effect=${item.special_effect}, timing=${item.timing}`);
        
        // B3: Sniper Akila reserved for clan Akila
        if (item.special_effect === 'RESERVE_AKILA' || attackName.includes('Sniper Akila')) {
          if (pos.clan !== 'Akila') {
            console.log(`[resolve-combat] SNIPER AKILA: Reserved for Akila clan, player ${pos.nom} (clan: ${pos.clan}) — damage=0`);
            reservedItemNote = 'réservé Akila';
            trackItemConsumption(pos.num_joueur, pos.nom, attackName);
            return { damage: 0, isAoe: false, aoeDamage: 0, reserved: true };
          }
        }
        
        // Akande clan bonus
        let bonus = 0;
        if (pos.clan === 'Akandé' && attackName === PERMANENT_WEAPON) {
          bonus = 2;
        }
        
        let baseDamage = (item.base_damage || 0) + bonus;
        
        // Apply damage multiplier from Amulette (8-A: stacking allowed)
        const multiplier = damageMultipliers.get(pos.num_joueur) || 1;
        if (multiplier > 1) {
          baseDamage = baseDamage * multiplier;
          console.log(`[resolve-combat] Amulette multiplier applied: ${pos.nom} damage x${multiplier} = ${baseDamage}`);
        }
        
        // === SPECIAL EFFECTS ===
        
        // Flèche du Crépuscule: AOE_3 immediate damage
        if (item.target === 'AOE_3' && item.special_effect !== 'DOT') {
          return { damage: 0, isAoe: true, aoeDamage: baseDamage };
        }
        
        // Grenade incendiaire: AOE_3 with DOT
        if (item.target === 'AOE_3' && item.special_effect === 'DOT') {
          const dotDamage = parseInt(item.special_value || '1', 10);
          const dotTicks = 2;
          
          pendingEffects.push({
            sourcePlayerNum: pos.num_joueur,
            sourcePlayerName: pos.nom,
            weaponName: attackName,
            type: 'DOT',
            damage: dotDamage,
            targetSlots: [1, 2, 3],
            triggersAfterPlayers: dotTicks,
            remainingTriggers: dotTicks,
            ignoreProtection: ignoreProtection,
          });
          
          return { damage: 0, isAoe: true, aoeDamage: baseDamage };
        }
        
        // B8: Canon de Brume BRUME_PERSISTENT - 1 dmg per remaining player
        if (item.special_effect === 'BRUME' || item.persistence === 'BRUME') {
          const remainingPlayersCount = totalPlayers - (i + 1); // Players after current
          const tickDamage = 1;
          
          if (remainingPlayersCount > 0 && targetSlot) {
            pendingEffects.push({
              sourcePlayerNum: pos.num_joueur,
              sourcePlayerName: pos.nom,
              weaponName: attackName,
              type: 'BRUME_PERSISTENT',
              damage: tickDamage,
              targetSlots: [targetSlot],
              triggersAfterPlayers: remainingPlayersCount,
              remainingTriggers: remainingPlayersCount,
              ignoreProtection: ignoreProtection,
            });
            console.log(`[resolve-combat] BRUME: ${attackName} by ${pos.nom} will tick ${remainingPlayersCount} times on slot ${targetSlot}`);
          } else if (remainingPlayersCount === 0 && targetSlot) {
            // Last player: apply immediate 1 dmg
            console.log(`[resolve-combat] BRUME: ${attackName} by ${pos.nom} is last player, applying 1 dmg immediately`);
            return { damage: tickDamage, isAoe: false, aoeDamage: 0 };
          }
          
          // Immediate base damage still applies
          return { damage: baseDamage, isAoe: false, aoeDamage: 0 };
        }
        
        // Grenade Frag: delayed damage
        if (item.timing === 'DELAYED' || item.special_effect === 'DELAYED') {
          const delayTicks = parseInt(item.special_value || '2', 10);
          
          if (targetSlot) {
            pendingEffects.push({
              sourcePlayerNum: pos.num_joueur,
              sourcePlayerName: pos.nom,
              weaponName: attackName,
              type: 'DELAYED',
              damage: baseDamage,
              targetSlots: [targetSlot],
              triggersAfterPlayers: delayTicks,
              remainingTriggers: delayTicks,
              ignoreProtection: ignoreProtection,
            });
          }
          
          return { damage: 0, isAoe: false, aoeDamage: 0 };
        }
        
        // Mine: stores for next round
        if (item.special_effect === 'MINE' || item.persistence === 'MINE') {
          if (targetSlot) {
            pendingEffects.push({
              sourcePlayerNum: pos.num_joueur,
              sourcePlayerName: pos.nom,
              weaponName: attackName,
              type: 'MINE',
              damage: baseDamage,
              targetSlots: [targetSlot],
              triggersAfterPlayers: 0,
              remainingTriggers: 0,
              ignoreProtection: ignoreProtection,
            });
            publicAction.minePlaced = { slot: targetSlot, weapon: attackName };
          }
          return { damage: 0, isAoe: false, aoeDamage: 0 };
        }
        
        // Berseker penalty tracking
        if (item.special_effect === 'BERSEKER') {
          berserkerPlayers.push(pos.num_joueur);
        }
        
        // Track weapons with BONUS_KILL_JETONS (Sabre Akila) - now 15 from DB
        if (item.special_effect === 'BONUS_KILL_JETONS' && item.special_value) {
          const bonusTokens = parseInt(item.special_value, 10) || 15; // Default to 15 if parsing fails
          if (bonusTokens > 0) {
            const existing = playerKillBonusWeapons.get(pos.num_joueur) || [];
            existing.push({ weaponName: attackName, bonusTokens });
            playerKillBonusWeapons.set(pos.num_joueur, existing);
          }
        }
        
        return { damage: baseDamage, isAoe: false, aoeDamage: 0 };
      };

      if (pos.attaque1 && pos.attaque1 !== 'Aucune') {
        publicAction.weapons.push(pos.attaque1);
        const result = processAttack(pos.attaque1, false);
        damage1 = result.damage;
        aoeImmediate1 = result.aoeDamage;
        if (result.reserved) {
          publicAction.reservedItem = reservedItemNote || undefined;
        }
        trackItemConsumption(pos.num_joueur, pos.nom, pos.attaque1);
      }

      if (effectiveAttack2 && effectiveAttack2 !== 'Aucune') {
        if (!publicAction.weapons.includes(effectiveAttack2)) {
          publicAction.weapons.push(effectiveAttack2);
        }
        const result = processAttack(effectiveAttack2, true);
        damage2 = result.damage;
        aoeImmediate2 = result.aoeDamage;
        if (result.reserved) {
          publicAction.reservedItem = reservedItemNote || undefined;
        }
        if (effectiveAttack2 !== PERMANENT_WEAPON) {
          trackItemConsumption(pos.num_joueur, pos.nom, effectiveAttack2);
        }
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
      
      // B13: Apply AOE immediate damage - slots with protection take 0 damage (choix 16)
      const totalAoeDamage = aoeImmediate1 + aoeImmediate2;
      if (totalAoeDamage > 0 && !attackCancelled) {
        let totalAoeApplied = 0;
        const protectedSlots: number[] = [];
        
        for (const slot of [1, 2, 3]) {
          const protCheck = isSlotProtected(slot, pos.position_finale, ignoreProtection);
          
          if (protCheck.protected) {
            protectedSlots.push(slot);
            console.log(`[resolve-combat] AOE: Slot ${slot} protected by ${protCheck.reason}, damage=0`);
            
            // Voile gains on AOE if applicable
            if (protCheck.reason === 'Voile du Gardien' && protCheck.ownerNum) {
              voilePenalties.push({
                playerNum: pos.num_joueur,
                playerName: pos.nom,
                tokens: totalAoeDamage,
                reason: `Voile du Gardien (AOE)`,
              });
              const voileOwnerName = players?.find(p => p.player_number === protCheck.ownerNum)?.display_name || `Joueur ${protCheck.ownerNum}`;
              voileGains.push({
                playerNum: protCheck.ownerNum,
                playerName: voileOwnerName,
                tokens: totalAoeDamage,
              });
            }
            continue;
          }
          
          const result = applyDamageToMonster(slot, totalAoeDamage, pos.num_joueur, pos.nom, false);
          if (!result.noMonster) {
            totalAoeApplied += totalAoeDamage;
          }
          if (result.killed && result.monsterName) {
            mjAction.killed = (mjAction.killed ? mjAction.killed + ', ' : '') + result.monsterName;
          }
        }
        
        // Log AOE application
        const aoeWeapon = [pos.attaque1, effectiveAttack2].find(w => {
          const item = w ? itemMap.get(w) : null;
          return item?.target === 'AOE_3';
        });
        
        if (protectedSlots.length > 0) {
          dotLogs.push(`🎯 ${pos.nom} utilise ${aoeWeapon || 'AOE'} : ${totalAoeDamage} dégâts sur slots non protégés (slot ${protectedSlots.join(', ')} protégé)`);
        } else {
          dotLogs.push(`🎯 ${pos.nom} utilise ${aoeWeapon || 'AOE'} : ${totalAoeDamage} dégâts sur tous les slots`);
        }
        
        publicAction.totalDamage = totalDirectDamage + totalAoeApplied;
      } else {
        publicAction.totalDamage = totalDirectDamage;
      }

      mjAction.totalDamage = totalDirectDamage;

      // Check Voile du Gardien for direct attacks
      let voileBlocked = false;
      if (targetSlot && totalDirectDamage > 0 && !attackCancelled && !ignoreProtection) {
        for (const voile of voileEffects) {
          if (voile.slot === targetSlot && voile.activatedAt < pos.position_finale) {
            voilePenalties.push({
              playerNum: pos.num_joueur,
              playerName: pos.nom,
              tokens: totalDirectDamage,
              reason: 'Voile du Gardien',
            });
            const voileOwnerName = players?.find(p => p.player_number === voile.playerNum)?.display_name || `Joueur ${voile.playerNum}`;
            voileGains.push({
              playerNum: voile.playerNum,
              playerName: voileOwnerName,
              tokens: totalDirectDamage,
            });
            voileBlocked = true;
            mjAction.cancelled = true;
            mjAction.cancelReason = 'Voile du Gardien';
            publicAction.cancelled = true;
            publicAction.cancelReason = 'Voile du Gardien';
            console.log(`[resolve-combat] Voile du Gardien: ${pos.nom} loses ${totalDirectDamage} jetons, ${voileOwnerName} gains ${totalDirectDamage} jetons, attack blocked`);
            break;
          }
        }
      }

      // Apply direct damage to target monster
      if (targetSlot && totalDirectDamage > 0 && !attackCancelled && !voileBlocked) {
        const result = applyDamageToMonster(targetSlot, totalDirectDamage, pos.num_joueur, pos.nom, false);
        
        if (result.noMonster) {
          publicAction.noMonster = true;
          publicAction.totalDamage = 0;
          mjAction.targetMonster = null;
          mjAction.totalDamage = 0;
          console.log(`[resolve-combat] ${pos.nom} attacked empty slot ${targetSlot} - no monster present`);
        } else {
          mjAction.targetMonster = result.monsterName;
          if (result.killed && result.monsterName) {
            mjAction.killed = (mjAction.killed ? mjAction.killed + ', ' : '') + result.monsterName;
          }
        }
      }

      publicActions.push(publicAction);
      mjActions.push(mjAction);
      
      // Process pending DOT/delayed effects after this player's turn
      const effectLogs = processPendingEffects(pos.position_finale);
      if (effectLogs.length > 0) {
        dotLogs.push(...effectLogs);
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

    // B4: Berserker penalty: -10 jetons if no kill (including those with default attack2)
    const killersNums = new Set(kills.map(k => k.killerNum));
    const berserkerPenalties: { playerNum: number; penalty: number }[] = [];
    for (const playerNum of berserkerPlayers) {
      if (!killersNums.has(playerNum)) {
        berserkerPenalties.push({ playerNum, penalty: -10 });
        console.log(`[resolve-combat] BERSEKER PENALTY: Player ${playerNum} used Piqure Berseker but no kill — -10 jetons`);
      }
    }

    // Update game_state_monsters
    const monsterUpdates = Array.from(monstersById.values()).map(m => ({
      id: m.id,
      pv_current: m.pv_current,
      status: m.status,
      battlefield_slot: m.battlefield_slot,
    }));

    for (const update of monsterUpdates) {
      await supabase
        .from('game_state_monsters')
        .update({ 
          pv_current: update.pv_current, 
          status: update.status,
          battlefield_slot: update.battlefield_slot,
        })
        .eq('id', update.id);
    }

    console.log(`[resolve-combat] Monster updates complete. Immediate replacement already handled during combat.`);

    // Update player rewards
    for (const reward of rewardUpdates) {
      const { data: playerData } = await supabase
        .from('game_players')
        .select('recompenses, mate_num')
        .eq('game_id', gameId)
        .eq('player_number', reward.playerNum)
        .single();
      
      if (playerData) {
        await supabase
          .from('game_players')
          .update({ recompenses: (playerData.recompenses || 0) + reward.reward })
          .eq('game_id', gameId)
          .eq('player_number', reward.playerNum);
        
        if (playerData.mate_num) {
          const { data: mateData } = await supabase
            .from('game_players')
            .select('recompenses')
            .eq('game_id', gameId)
            .eq('player_number', playerData.mate_num)
            .single();
          
          if (mateData) {
            await supabase
              .from('game_players')
              .update({ recompenses: (mateData.recompenses || 0) + reward.reward })
              .eq('game_id', gameId)
              .eq('player_number', playerData.mate_num);
            
            console.log(`[resolve-combat] Cooperative reward: mate #${playerData.mate_num} also receives ${reward.reward} recompenses`);
          }
        }
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

    // Apply kill bonus tokens (Sabre Akila - now 15)
    for (const bonus of killBonusTokens) {
      const { data: playerData } = await supabase
        .from('game_players')
        .select('jetons')
        .eq('game_id', gameId)
        .eq('player_number', bonus.playerNum)
        .single();
      
      if (playerData) {
        await supabase
          .from('game_players')
          .update({ jetons: (playerData.jetons || 0) + bonus.bonus })
          .eq('game_id', gameId)
          .eq('player_number', bonus.playerNum);
        
        console.log(`[resolve-combat] Applied kill bonus: ${bonus.playerName} +${bonus.bonus} jetons (${bonus.weaponName})`);
      }
    }

    // Apply Voile du Gardien penalties
    for (const penalty of voilePenalties) {
      const { data: playerData } = await supabase
        .from('game_players')
        .select('jetons')
        .eq('game_id', gameId)
        .eq('player_number', penalty.playerNum)
        .single();
      
      if (playerData) {
        await supabase
          .from('game_players')
          .update({ jetons: Math.max(0, (playerData.jetons || 0) - penalty.tokens) })
          .eq('game_id', gameId)
          .eq('player_number', penalty.playerNum);
        
        console.log(`[resolve-combat] Applied Voile penalty: ${penalty.playerName} -${penalty.tokens} jetons`);
      }
    }

    // Apply Voile du Gardien gains - aggregated
    const voileGainsAggregated = new Map<number, { playerName: string; totalTokens: number }>();
    for (const gain of voileGains) {
      const existing = voileGainsAggregated.get(gain.playerNum);
      if (existing) {
        existing.totalTokens += gain.tokens;
      } else {
        voileGainsAggregated.set(gain.playerNum, { playerName: gain.playerName, totalTokens: gain.tokens });
      }
    }
    
    for (const [playerNum, gainData] of voileGainsAggregated) {
      const { data: playerData } = await supabase
        .from('game_players')
        .select('jetons')
        .eq('game_id', gameId)
        .eq('player_number', playerNum)
        .single();
      
      if (playerData) {
        await supabase
          .from('game_players')
          .update({ jetons: (playerData.jetons || 0) + gainData.totalTokens })
          .eq('game_id', gameId)
          .eq('player_number', playerNum);
        
        console.log(`[resolve-combat] Applied Voile gain: ${gainData.playerName} +${gainData.totalTokens} jetons`);
      }
    }

    // Store Mine effects for next round
    const mineEffects = pendingEffects.filter(e => e.type === 'MINE');
    for (const mine of mineEffects) {
      await supabase.from('pending_effects').insert({
        game_id: gameId,
        session_game_id: sessionGameId,
        manche: manche + 1,
        type: 'MINE',
        slot: mine.targetSlots[0],
        weapon: mine.weaponName,
        by_num: mine.sourcePlayerNum,
      });
      console.log(`[resolve-combat] Stored Mine effect for manche ${manche + 1}: slot ${mine.targetSlots[0]} by ${mine.sourcePlayerName}`);
    }

    // ==========================================
    // CONSUME ITEMS FROM INVENTORY
    // ==========================================
    console.log(`[resolve-combat] Processing ${consumedItems.length} item consumptions`);
    
    const consumptionLogs: string[] = [];
    const itemsMissingFromInventory: ConsumedItem[] = [];
    
    for (const item of consumedItems) {
      const invQuery = supabase
        .from('inventory')
        .select('*')
        .eq('game_id', gameId)
        .eq('owner_num', item.playerNum)
        .eq('objet', item.itemName);
      if (sessionGameId) {
        invQuery.eq('session_game_id', sessionGameId);
      }
      const { data: invRow, error: invError } = await invQuery.single();
      
      if (invError || !invRow) {
        console.log(`[resolve-combat] Item not found in inventory: ${item.itemName} for player ${item.playerNum}`);
        itemsMissingFromInventory.push(item);
        continue;
      }
      
      const currentQty = invRow.quantite || 1;
      
      if (currentQty > 1) {
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

    // Log missing items to MJ
    if (itemsMissingFromInventory.length > 0) {
      const missingItemsMsg = itemsMissingFromInventory.map(
        i => `${i.playerName} (J${i.playerNum}): ${i.itemName} non trouvé en inventaire`
      ).join('\n');
      
      await supabase.from('logs_mj').insert({
        game_id: gameId,
        session_game_id: sessionGameId,
        manche: manche,
        action: 'OBJET_ABSENT_INVENTAIRE',
        details: missingItemsMsg,
      });
    }

    // Log consumption to MJ
    if (consumptionLogs.length > 0) {
      await supabase.from('logs_mj').insert({
        game_id: gameId,
        session_game_id: sessionGameId,
        manche: manche,
        action: 'INVENTAIRE_CONSO',
        details: consumptionLogs.join('\n'),
      });
    }

    // Calculate forest state
    const forestQuery = supabase
      .from('game_state_monsters')
      .select('pv_current, status')
      .eq('game_id', gameId);
    if (sessionGameId) {
      forestQuery.eq('session_game_id', sessionGameId);
    }
    const { data: updatedMonsters } = await forestQuery;

    const totalPvCurrent = updatedMonsters?.reduce((sum, m) => sum + (m.pv_current || 0), 0) || 0;
    
    const hasMonsters = updatedMonsters && updatedMonsters.length > 0;
    const allMonstersDead = hasMonsters && updatedMonsters.every(m => m.status === 'MORT');
    
    console.log(`[resolve-combat] Monster check: hasMonsters=${hasMonsters}, count=${updatedMonsters?.length || 0}, allDead=${allMonstersDead}`);
    
    const forestState = {
      totalPvRemaining: totalPvCurrent,
      monstersKilled: kills.length,
      itemsConsumed: consumedItems.filter(i => i.wasInInventory).length,
      allMonstersDead: allMonstersDead,
    };

    // Build public summary with mine tracking
    const mineExplosionEntries: { position: number; nom: string; weapons: string[]; totalDamage: number; cancelled: boolean; cancelReason?: string; minePlaced?: { slot: number; weapon: string }; mineExplosion?: boolean }[] = [];
    
    if (pendingFromDb && pendingFromDb.length > 0) {
      for (const effect of pendingFromDb) {
        if (effect.type === 'MINE' && effect.slot) {
          const attackerName = players?.find(p => p.player_number === effect.by_num)?.display_name || `Joueur ${effect.by_num}`;
          const mineItem = itemMap.get(effect.weapon || 'Mine');
          const damage = mineItem?.base_damage || 10;
          
          mineExplosionEntries.push({
            position: 0,
            nom: attackerName,
            weapons: [effect.weapon || 'Mine'],
            totalDamage: damage,
            cancelled: false,
            mineExplosion: true,
          });
        }
      }
    }

    // Add delayed explosions to public actions
    for (const [playerNum, explosion] of delayedExplosions) {
      const action = publicActions.find(a => a.num_joueur === playerNum);
      if (action) {
        action.delayedExplosion = explosion;
      }
    }

    const publicSummary = [
      ...mineExplosionEntries,
      ...publicActions.map(a => ({
        position: a.position,
        nom: a.nom,
        weapons: a.weapons,
        totalDamage: a.totalDamage,
        cancelled: a.cancelled,
        cancelReason: a.cancelReason,
        minePlaced: a.minePlaced,
        mineExplosion: false,
        protectionUsed: a.protectionUsed,
        delayedExplosion: a.delayedExplosion,
        noMonster: a.noMonster,
        reservedItem: a.reservedItem,
      }))
    ];

    // Store combat results
    await supabase.from('combat_results').insert({
      game_id: gameId,
      session_game_id: sessionGameId,
      manche: manche,
      public_summary: publicSummary,
      kills: kills,
      forest_state: forestState,
      mj_summary: mjActions,
      resolved_at: new Date().toISOString(),
    });

    // Log messages
    const publicAttackMessages = publicActions.map(a => {
      if (a.noMonster) {
        const weaponsStr = a.weapons.length > 0 ? `"${a.weapons.join('" + "')}"` : 'aucune arme';
        return `${a.nom} a utilisé ${weaponsStr} — pas de monstre (0 dégâts)`;
      }
      
      if (a.reservedItem) {
        const weaponsStr = a.weapons.length > 0 ? `"${a.weapons.join('" + "')}"` : 'aucune arme';
        return `${a.nom} a utilisé ${weaponsStr} — ${a.reservedItem} (0 dégâts)`;
      }
      
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

    const killMessages = kills.map(k => {
      const dotSuffix = k.fromDot ? ' (effet retardé)' : '';
      return `⚔️ ${k.killerName} a éliminé le monstre du Slot ${k.slot}. Récompense ${k.reward}.${dotSuffix}`;
    }).join('\n');

    const bersekerPenaltyMessages = berserkerPenalties.length > 0 
      ? berserkerPenalties.map(p => {
          const playerName = positions?.find((pos: PositionFinale) => pos.num_joueur === p.playerNum)?.nom || `Joueur ${p.playerNum}`;
          return `💀 ${playerName} a utilisé Piqure Berseker sans coup de grâce : -10 jetons`;
        }).join('\n')
      : '';

    const dotPublicMessages = dotLogs.length > 0 ? dotLogs.join('\n') : '';

    const killBonusMessages = killBonusTokens.length > 0
      ? killBonusTokens.map(b => `🗡️ ${b.playerName} obtient +${b.bonus} jetons bonus (${b.weaponName})`).join('\n')
      : '';

    const voilePenaltyMessages = voilePenalties.length > 0
      ? voilePenalties.map(p => `🛡️ ${p.playerName} perd ${p.tokens} jetons (${p.reason})`).join('\n')
      : '';

    const amuletteMessages = amuletteEffects.length > 0
      ? amuletteEffects.map(a => {
          const playerName = positions?.find((pos: PositionFinale) => pos.num_joueur === a.playerNum)?.nom || `Joueur ${a.playerNum}`;
          const mateName = positions?.find((pos: PositionFinale) => pos.num_joueur === a.mateNum)?.nom || `Joueur ${a.mateNum}`;
          return `💎 ${playerName} utilise Amulette de soutien : dégâts de ${mateName} doublés`;
        }).join('\n')
      : '';

    const mineMessages = mineEffects.length > 0
      ? mineEffects.map(m => `💣 ${m.sourcePlayerName} a posé une Mine sur le Slot ${m.targetSlots[0]} (explosera au début de la prochaine manche)`).join('\n')
      : '';

    // MJ summary
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

    // Check if game should end
    if (allMonstersDead) {
      console.log('[resolve-combat] All monsters are dead!');
      
      const isAdventureMode = game.mode === 'ADVENTURE';
      
      if (isAdventureMode) {
        console.log('[resolve-combat] Adventure mode detected - marking Forêt session as complete, NOT ending adventure');
        
        const { error: sessionEndError } = await supabase
          .from('games')
          .update({ 
            phase: 'SESSION_COMPLETE',
            phase_locked: true
          })
          .eq('id', gameId);

        if (sessionEndError) {
          console.error('[resolve-combat] Error marking session as complete:', sessionEndError);
        }
        
        if (sessionGameId) {
          await supabase
            .from('session_games')
            .update({ 
              status: 'ENDED',
              ended_at: new Date().toISOString()
            })
            .eq('id', sessionGameId);
        }
        
        // =========================================================================
        // SAVE ADVENTURE SCORES - Critical for cumulative PVic tracking
        // =========================================================================
        console.log('[resolve-combat] Saving adventure_scores for Forêt session...');
        
        // Get updated player data with current recompenses (exclude host and removed players)
        const { data: adventurePlayers } = await supabase
          .from('game_players')
          .select('id, player_number, recompenses, pvic')
          .eq('game_id', gameId)
          .eq('status', 'ACTIVE')
          .eq('is_host', false)
          .is('removed_at', null)
          .not('player_number', 'is', null);
        
        console.log(`[resolve-combat] Adventure players for scores: ${adventurePlayers?.length || 0} (excluding host)`);
        
        if (adventurePlayers && sessionGameId) {
          for (const player of adventurePlayers) {
            const scoreForThisGame = player.recompenses || 0;
            
            // Skip if no score to save
            if (scoreForThisGame === 0) {
              console.log(`[resolve-combat] Player ${player.player_number}: no recompenses to save`);
              continue;
            }
            
            // Check for existing adventure score
            const { data: existingScore } = await supabase
              .from('adventure_scores')
              .select('id, total_score_value, breakdown')
              .eq('session_id', gameId)
              .eq('game_player_id', player.id)
              .single();
            
            if (existingScore) {
              // Update existing score - add this game's score to breakdown
              const breakdown = (existingScore.breakdown as Record<string, number>) || {};
              breakdown[sessionGameId] = scoreForThisGame;
              
              // Recalculate total from breakdown
              const newTotal = Object.values(breakdown).reduce((sum: number, val: number) => sum + (Number(val) || 0), 0);
              
              await supabase
                .from('adventure_scores')
                .update({
                  total_score_value: newTotal,
                  breakdown,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existingScore.id);
              
              console.log(`[resolve-combat] Player ${player.player_number}: updated adventure_scores, breakdown now includes FORET=${scoreForThisGame}, total=${newTotal}`);
            } else {
              // Create new score entry
              await supabase.from('adventure_scores').insert({
                session_id: gameId,
                game_player_id: player.id,
                total_score_value: scoreForThisGame,
                breakdown: { [sessionGameId]: scoreForThisGame },
              });
              
              console.log(`[resolve-combat] Player ${player.player_number}: created adventure_scores with FORET=${scoreForThisGame}`);
            }
          }
        }
        
        await Promise.all([
          supabase.from('session_events').insert({
            game_id: gameId,
            audience: 'ALL',
            type: 'SESSION_COMPLETE',
            message: '🌲 La forêt de Ndogmoabeng a été nettoyée ! L\'aventure continue...',
            payload: { 
              type: 'SESSION_COMPLETE',
              reason: 'ALL_MONSTERS_DEAD',
              forestState,
              gameTypeCode: 'FORET',
              isAdventure: true,
            },
          }),
          supabase.from('logs_joueurs').insert({
            game_id: gameId,
            session_game_id: sessionGameId,
            manche: manche,
            type: 'FIN_SESSION',
            message: '🌲 Session Forêt terminée ! Tous les monstres ont été vaincus. Préparez-vous pour la prochaine étape de l\'aventure.',
          }),
          supabase.from('logs_mj').insert({
            game_id: gameId,
            manche: manche,
            action: 'SESSION_TERMINEE',
            details: 'Session Forêt terminée. Tous les monstres ont été éliminés. Le MJ peut maintenant passer au jeu suivant de l\'aventure.',
          }),
        ]);
      } else {
        console.log('[resolve-combat] Single game mode - ending game...');
        
        const sortedPlayers = [...(players || [])].sort((a, b) => {
          const scoreA = (a.jetons || 0) + (a.recompenses || 0);
          const scoreB = (b.jetons || 0) + (b.recompenses || 0);
          return scoreB - scoreA;
        });
        const winnerUserId = sortedPlayers[0]?.user_id || null;
        
        const { error: endGameError } = await supabase
          .from('games')
          .update({ 
            status: 'ENDED', 
            phase: 'FINISHED',
            phase_locked: true,
            winner_declared: true
          })
          .eq('id', gameId);

        if (endGameError) {
          console.error('[resolve-combat] Error ending game:', endGameError);
        }
        
        try {
          const { error: statsError } = await supabase.rpc('update_player_stats_on_game_end', {
            p_game_id: gameId,
            p_winner_user_id: winnerUserId
          });
          if (statsError) {
            console.error('[resolve-combat] Error updating player stats:', statsError);
          } else {
            console.log('[resolve-combat] Player stats updated successfully');
          }
        } catch (statsErr) {
          console.error('[resolve-combat] Exception updating player stats:', statsErr);
        }
        
        await Promise.all([
          supabase.from('session_events').insert({
            game_id: gameId,
            audience: 'ALL',
            type: 'GAME_END',
            message: '🏆 VICTOIRE ! Tous les monstres ont été vaincus !',
            payload: { 
              type: 'GAME_ENDED',
              reason: 'ALL_MONSTERS_DEAD',
              forestState,
            },
          }),
          supabase.from('logs_joueurs').insert({
            game_id: gameId,
            session_game_id: sessionGameId,
            manche: manche,
            type: 'FIN_PARTIE',
            message: '🏆 VICTOIRE ! La forêt de Ndogmoabeng a été conquise ! Tous les monstres ont été vaincus.',
          }),
          supabase.from('logs_mj').insert({
            game_id: gameId,
            manche: manche,
            action: 'PARTIE_TERMINEE',
            details: 'Tous les monstres ont été éliminés. La partie est terminée automatiquement.',
          }),
        ]);
      }
    } else {
      const { error: phaseError } = await supabase
        .from('games')
        .update({ phase: 'PHASE3_SHOP', phase_locked: false })
        .eq('id', gameId);

      if (phaseError) {
        console.error('[resolve-combat] Error transitioning to Phase 3:', phaseError);
      }
      
      await supabase.from('session_events').insert({
        game_id: gameId,
        audience: 'ALL',
        type: 'PHASE',
        message: '🛒 Phase 3 : Le marché est ouvert !',
        payload: { type: 'PHASE_CHANGE', phase: 'PHASE3_SHOP' },
      });
    }

    await Promise.all([
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
          voilePenalties: voilePenalties.map(p => ({ playerNum: p.playerNum, tokens: p.tokens })),
          gameEnded: allMonstersDead,
        },
      }),
      mineLogs.length > 0 ? supabase.from('logs_joueurs').insert({
        game_id: gameId,
        session_game_id: sessionGameId,
        manche: manche,
        type: 'MINE_EXPLOSION',
        message: mineLogs.join('\n'),
      }) : Promise.resolve(),
      supabase.from('logs_joueurs').insert({
        game_id: gameId,
        session_game_id: sessionGameId,
        manche: manche,
        type: 'ATTAQUES_RESUME',
        message: publicAttackMessages,
      }),
      kills.length > 0 ? supabase.from('logs_joueurs').insert({
        game_id: gameId,
        session_game_id: sessionGameId,
        manche: manche,
        type: 'COUP_DE_GRACE',
        message: killMessages,
      }) : Promise.resolve(),
      bersekerPenaltyMessages ? supabase.from('logs_joueurs').insert({
        game_id: gameId,
        session_game_id: sessionGameId,
        manche: manche,
        type: 'PENALITE_BERSEKER',
        message: bersekerPenaltyMessages,
      }) : Promise.resolve(),
      dotPublicMessages ? supabase.from('logs_joueurs').insert({
        game_id: gameId,
        session_game_id: sessionGameId,
        manche: manche,
        type: 'EFFETS_RETARDES',
        message: dotPublicMessages,
      }) : Promise.resolve(),
      killBonusMessages ? supabase.from('logs_joueurs').insert({
        game_id: gameId,
        session_game_id: sessionGameId,
        manche: manche,
        type: 'BONUS_KILL',
        message: killBonusMessages,
      }) : Promise.resolve(),
      voilePenaltyMessages ? supabase.from('logs_joueurs').insert({
        game_id: gameId,
        session_game_id: sessionGameId,
        manche: manche,
        type: 'PENALITE_VOILE',
        message: voilePenaltyMessages,
      }) : Promise.resolve(),
      amuletteMessages ? supabase.from('logs_joueurs').insert({
        game_id: gameId,
        session_game_id: sessionGameId,
        manche: manche,
        type: 'AMULETTE_SOUTIEN',
        message: amuletteMessages,
      }) : Promise.resolve(),
      mineMessages ? supabase.from('logs_joueurs').insert({
        game_id: gameId,
        session_game_id: sessionGameId,
        manche: manche,
        type: 'MINE_POSEE',
        message: mineMessages,
      }) : Promise.resolve(),
      supabase.from('logs_joueurs').insert({
        game_id: gameId,
        session_game_id: sessionGameId,
        manche: manche,
        type: 'ETAT_FORET',
        message: `🌲 État de la forêt: ${forestState.totalPvRemaining} PV restants (${kills.length} monstre(s) éliminé(s))`,
      }),
      supabase.from('logs_joueurs').insert({
        game_id: gameId,
        session_game_id: sessionGameId,
        manche: manche,
        type: 'PHASE',
        message: '🛒 Phase 3 : Le marché est ouvert !',
      }),
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
        details: JSON.stringify({ kills, rewards: rewardUpdates, berserkerPenalties, killBonusTokens, voilePenalties, amuletteEffects, mineEffects: mineEffects.map(m => ({ slot: m.targetSlots[0], player: m.sourcePlayerNum })), dotEffects: dotLogs }),
      }),
    ]);

    console.log(`[resolve-combat] Combat resolved for game ${gameId} manche ${manche}: ${kills.length} kills, ${voilePenalties.length} voile penalties, ${amuletteEffects.length} amulette effects`);

    return new Response(
      JSON.stringify({
        success: true,
        publicSummary,
        kills,
        forestState,
        berserkerPenalties,
        killBonusTokens,
        voilePenalties,
        amuletteEffects: amuletteEffects.length,
        minesPlaced: mineEffects.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[resolve-combat] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
