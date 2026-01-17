import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ForestButton } from '@/components/ui/ForestButton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Check, Lock, Coins, MapPin, ShoppingBag, Swords, Info } from 'lucide-react';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Game {
  id: string;
  manche_active: number;
  phase: string;
  phase_locked: boolean;
}

interface Player {
  playerNumber: number;
  jetons: number;
}

interface PhasePanelProps {
  game: Game;
  player: Player;
  className?: string;
}

interface InventoryItem {
  objet: string;
  quantite: number;
  disponible: boolean;
  dispo_attaque: boolean;
}

interface CatalogItem {
  name: string;
  category: 'ATTAQUE' | 'PROTECTION';
  base_damage: number;
  base_heal: number;
  target: string;
  timing: string;
  persistence: string;
  ignore_protection: boolean;
  special_effect: string;
  special_value: string;
  consumable: boolean;
  notes: string;
}

interface ShopItem {
  id: string;
  objet: string;
  cout_normal: number;
  cout_akila: number;
  categorie: string;
}

const phaseConfig = {
  PHASE1_MISES: { icon: Coins, label: 'Mises', color: 'text-yellow-500' },
  PHASE2_POSITIONS: { icon: MapPin, label: 'Actions', color: 'text-blue-500' },
  PHASE3_SHOP: { icon: ShoppingBag, label: 'Boutique', color: 'text-green-500' },
  PHASE4_COMBAT: { icon: Swords, label: 'Combat', color: 'text-red-500' },
  RESOLUTION: { icon: Check, label: 'Résolution', color: 'text-purple-500' },
};

export function PhasePanel({ game, player, className }: PhasePanelProps) {
  const [submitting, setSubmitting] = useState(false);
  
  // Phase 1 state
  const [mise, setMise] = useState('0');
  const [currentBet, setCurrentBet] = useState<number | null>(null);
  
  // Phase 2 state
  const [positionSouhaitee, setPositionSouhaitee] = useState<string>('');
  const [slotAttaque, setSlotAttaque] = useState<string>('');
  const [slotProtection, setSlotProtection] = useState<string>('');
  const [attaque1, setAttaque1] = useState<string>('');
  const [attaque2, setAttaque2] = useState<string>('');
  const [protectionObjet, setProtectionObjet] = useState<string>('');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [itemCatalog, setItemCatalog] = useState<CatalogItem[]>([]);
  const [currentAction, setCurrentAction] = useState<Record<string, unknown> | null>(null);
  const [activePlayerCount, setActivePlayerCount] = useState<number>(6);
  
  // Phase 3 state
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [selectedShopItem, setSelectedShopItem] = useState<string>('');

  // Compute filtered attack and protection items
  const attackItems = useMemo(() => {
    return inventory.filter(inv => {
      const catalogItem = itemCatalog.find(c => c.name === inv.objet);
      return catalogItem?.category === 'ATTAQUE' && inv.quantite > 0 && inv.dispo_attaque;
    });
  }, [inventory, itemCatalog]);

  const protectionItems = useMemo(() => {
    return inventory.filter(inv => {
      const catalogItem = itemCatalog.find(c => c.name === inv.objet);
      return catalogItem?.category === 'PROTECTION' && inv.quantite > 0 && inv.disponible;
    });
  }, [inventory, itemCatalog]);

  // Check if Attaque 2 is enabled (only when Attaque 1 is "Piqure Berseker")
  const isAttaque2Enabled = attaque1 === 'Piqure Berseker';

  // Get catalog info for an item
  const getItemInfo = (itemName: string): CatalogItem | undefined => {
    return itemCatalog.find(c => c.name === itemName);
  };

  // Reset Attaque 2 when Attaque 1 changes and isn't Piqure Berseker
  useEffect(() => {
    if (attaque1 !== 'Piqure Berseker' && attaque2 !== '' && attaque2 !== 'none') {
      setAttaque2('none');
    }
  }, [attaque1]);

  // Fetch active player count for position options
  const fetchActivePlayerCount = async () => {
    const { count, error } = await supabase
      .from('game_players')
      .select('*', { count: 'exact', head: true })
      .eq('game_id', game.id)
      .eq('is_host', false)
      .in('status', ['ACTIVE', 'IN_GAME']);
    
    if (!error && count !== null) {
      setActivePlayerCount(count);
    }
  };

  useEffect(() => {
    // Always fetch active player count for reference
    fetchActivePlayerCount();
    
    if (game.phase === 'PHASE1_MISES') {
      fetchCurrentBet();
    } else if (game.phase === 'PHASE2_POSITIONS') {
      fetchInventory();
      fetchItemCatalog();
      fetchCurrentAction();
    } else if (game.phase === 'PHASE3_SHOP') {
      fetchShopItems();
    }
    
    // Subscribe to player changes for real-time count updates
    const channel = supabase
      .channel(`players-count-${game.id}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${game.id}` },
        () => { fetchActivePlayerCount(); }
      )
      .subscribe();
    
    return () => { supabase.removeChannel(channel); };
  }, [game.id, game.phase, game.manche_active]);

  const fetchCurrentBet = async () => {
    const { data } = await supabase
      .from('round_bets')
      .select('mise')
      .eq('game_id', game.id)
      .eq('manche', game.manche_active)
      .eq('num_joueur', player.playerNumber)
      .maybeSingle();
    
    if (data) {
      setCurrentBet(data.mise);
      setMise(data.mise.toString());
    }
  };

  const fetchInventory = async () => {
    const { data } = await supabase
      .from('inventory')
      .select('objet, quantite, disponible, dispo_attaque')
      .eq('game_id', game.id)
      .eq('owner_num', player.playerNumber);
    
    if (data) {
      setInventory(data);
    }
  };

  const fetchItemCatalog = async () => {
    const { data } = await supabase
      .from('item_catalog')
      .select('name, category, base_damage, base_heal, target, timing, persistence, ignore_protection, special_effect, special_value, consumable, notes');
    
    if (data) {
      setItemCatalog(data as CatalogItem[]);
    }
  };

  const fetchCurrentAction = async () => {
    const { data } = await supabase
      .from('actions')
      .select('*')
      .eq('game_id', game.id)
      .eq('manche', game.manche_active)
      .eq('num_joueur', player.playerNumber)
      .maybeSingle();
    
    if (data) {
      setCurrentAction(data);
      setPositionSouhaitee(data.position_souhaitee?.toString() || '');
      setSlotAttaque(data.slot_attaque?.toString() || '');
      setSlotProtection(data.slot_protection?.toString() || '');
      setAttaque1(data.attaque1 || '');
      setAttaque2(data.attaque2 || '');
      setProtectionObjet(data.protection_objet || '');
    }
  };

  const fetchShopItems = async () => {
    const { data } = await supabase
      .from('shop_catalogue')
      .select('id, objet, cout_normal, cout_akila, categorie')
      .eq('game_id', game.id)
      .eq('actif', true);
    
    if (data) {
      setShopItems(data);
    }
  };

  const handleSubmitBet = async () => {
    const miseValue = parseInt(mise, 10);
    if (isNaN(miseValue) || miseValue < 0) {
      toast.error('La mise doit être un nombre positif ou nul');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('round_bets')
        .upsert(
          {
            game_id: game.id,
            manche: game.manche_active,
            num_joueur: player.playerNumber,
            mise: miseValue,
            mise_demandee: miseValue,
            status: 'SUBMITTED',
            submitted_at: new Date().toISOString(),
          },
          { onConflict: 'game_id,manche,num_joueur' }
        );

      if (error) {
        console.error('[PhasePanel] Bet submission error:', error);
        toast.error(`Erreur: ${error.message}`);
        return;
      }

      setCurrentBet(miseValue);
      console.log(`[PhasePanel] Bet submitted: player=${player.playerNumber}, mise=${miseValue}`);
      
      if (miseValue > player.jetons) {
        toast.warning(`Mise enregistrée, mais ${miseValue} > votre solde (${player.jetons}). Elle sera forcée à 0 à la clôture.`);
      } else {
        toast.success('Mise enregistrée !');
      }
    } catch (err) {
      console.error('[PhasePanel] Unexpected error:', err);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitAction = async () => {
    // Validation: force Attaque 2 to none if Attaque 1 is not Piqure Berseker
    const finalAttaque2 = attaque1 === 'Piqure Berseker' ? attaque2 : 'none';
    
    // Validation: if protection is "none", clear slot protection
    const finalSlotProtection = protectionObjet && protectionObjet !== 'none' ? slotProtection : null;

    // Validate attack items exist in inventory with correct category
    if (attaque1 && attaque1 !== 'none') {
      const invItem = inventory.find(i => i.objet === attaque1);
      const catItem = itemCatalog.find(c => c.name === attaque1);
      if (!invItem || invItem.quantite <= 0 || catItem?.category !== 'ATTAQUE') {
        toast.error('Attaque 1 invalide ou non disponible');
        return;
      }
    }

    if (finalAttaque2 && finalAttaque2 !== 'none') {
      const invItem = inventory.find(i => i.objet === finalAttaque2);
      const catItem = itemCatalog.find(c => c.name === finalAttaque2);
      if (!invItem || invItem.quantite <= 0 || catItem?.category !== 'ATTAQUE') {
        toast.error('Attaque 2 invalide ou non disponible');
        return;
      }
    }

    if (protectionObjet && protectionObjet !== 'none') {
      const invItem = inventory.find(i => i.objet === protectionObjet);
      const catItem = itemCatalog.find(c => c.name === protectionObjet);
      if (!invItem || invItem.quantite <= 0 || catItem?.category !== 'PROTECTION') {
        toast.error('Protection invalide ou non disponible');
        return;
      }
      if (!finalSlotProtection) {
        toast.error('Veuillez sélectionner un slot de protection');
        return;
      }
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('actions')
        .upsert(
          {
            game_id: game.id,
            manche: game.manche_active,
            num_joueur: player.playerNumber,
            position_souhaitee: positionSouhaitee ? parseInt(positionSouhaitee) : null,
            slot_attaque: slotAttaque ? parseInt(slotAttaque) : null,
            slot_protection: finalSlotProtection ? parseInt(finalSlotProtection) : null,
            attaque1: attaque1 && attaque1 !== 'none' ? attaque1 : null,
            attaque2: finalAttaque2 && finalAttaque2 !== 'none' ? finalAttaque2 : null,
            protection_objet: protectionObjet && protectionObjet !== 'none' ? protectionObjet : null,
          },
          { onConflict: 'game_id,manche,num_joueur' }
        );

      if (error) {
        console.error('[PhasePanel] Action submission error:', error);
        toast.error(`Erreur: ${error.message}`);
        return;
      }

      setCurrentAction({ submitted: true });
      toast.success('Actions enregistrées !');
    } catch {
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSubmitting(false);
    }
  };

  // Render item with tooltip
  const renderItemOption = (item: InventoryItem, showQuantity: boolean = true) => {
    const info = getItemInfo(item.objet);
    return (
      <SelectItem key={item.objet} value={item.objet}>
        <div className="flex items-center gap-2">
          <span>{item.objet}</span>
          {showQuantity && <span className="text-muted-foreground text-xs">(x{item.quantite})</span>}
          {info && !info.consumable && (
            <span className="text-xs bg-primary/20 text-primary px-1 rounded">∞</span>
          )}
        </div>
      </SelectItem>
    );
  };

  // Render item info tooltip
  const ItemInfoTooltip = ({ itemName }: { itemName: string }) => {
    const info = getItemInfo(itemName);
    if (!info || itemName === 'none') return null;
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="h-3 w-3 text-muted-foreground cursor-help inline ml-1" />
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div className="space-y-1 text-xs">
              <p className="font-semibold">{info.name}</p>
              {info.base_damage > 0 && <p>⚔️ Dégâts: {info.base_damage}</p>}
              {info.base_heal > 0 && <p>💚 Soin: {info.base_heal}</p>}
              <p>🎯 Cible: {info.target}</p>
              <p>⏱️ Timing: {info.timing}</p>
              {info.persistence !== 'AUCUNE' && <p>📌 Persistance: {info.persistence}</p>}
              {info.ignore_protection && <p className="text-amber-400">⚡ Ignore les protections</p>}
              {info.special_effect !== 'AUCUN' && <p>✨ Effet: {info.special_effect}</p>}
              <p className="text-muted-foreground italic mt-1">{info.notes}</p>
              <p className={info.consumable ? 'text-amber-400' : 'text-green-400'}>
                {info.consumable ? '🔥 Usage unique' : '♾️ Permanent'}
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const config = phaseConfig[game.phase as keyof typeof phaseConfig] || phaseConfig.RESOLUTION;
  const Icon = config.icon;
  const isLocked = game.phase_locked;

  return (
    <div className={`card-gradient rounded-lg border border-border ${className}`}>
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${config.color}`} />
          <h3 className="font-display text-sm">{config.label}</h3>
        </div>
        {isLocked && (
          <span className="flex items-center gap-1 text-xs text-amber-500">
            <Lock className="h-3 w-3" />
            Verrouillée
          </span>
        )}
      </div>

      <div className="p-4">
        {/* Phase 1: Mises */}
        {game.phase === 'PHASE1_MISES' && (
          <div className="space-y-4">
            {/* Current balance */}
            <div className="p-3 rounded bg-secondary/50 border border-border text-center">
              <p className="text-xs text-muted-foreground">Votre solde</p>
              <p className="text-xl font-bold text-yellow-500">{player.jetons} jetons</p>
            </div>

            {currentBet !== null && (
              <div className={`p-3 rounded border text-center ${
                currentBet > player.jetons 
                  ? 'bg-amber-500/10 border-amber-500/30' 
                  : 'bg-green-500/10 border-green-500/20'
              }`}>
                <p className={`text-sm ${currentBet > player.jetons ? 'text-amber-400' : 'text-green-400'}`}>
                  Mise soumise
                </p>
                <p className={`text-2xl font-bold ${currentBet > player.jetons ? 'text-amber-500' : 'text-green-500'}`}>
                  {currentBet} jetons
                </p>
                {currentBet > player.jetons && (
                  <p className="text-xs text-amber-400 mt-1">
                    ⚠️ Supérieure à votre solde - sera forcée à 0
                  </p>
                )}
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="mise">Votre mise (max recommandé: {player.jetons})</Label>
              <Input
                id="mise"
                type="number"
                min="0"
                value={mise}
                onChange={(e) => setMise(e.target.value)}
                disabled={isLocked}
                className={`bg-background/50 ${
                  parseInt(mise) > player.jetons ? 'border-amber-500 focus:border-amber-500' : ''
                }`}
              />
              {parseInt(mise) > player.jetons && (
                <p className="text-xs text-amber-500">
                  Attention: cette mise dépasse votre solde et sera forcée à 0 à la clôture
                </p>
              )}
            </div>
            
            <ForestButton
              onClick={handleSubmitBet}
              disabled={submitting || isLocked}
              className="w-full"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  {currentBet !== null ? 'Modifier ma mise' : 'Valider ma mise'}
                </>
              )}
            </ForestButton>

            {isLocked && (
              <p className="text-xs text-center text-amber-500">
                <Lock className="h-3 w-3 inline mr-1" />
                Phase verrouillée par le MJ
              </p>
            )}
          </div>
        )}

        {/* Phase 2: Actions */}
        {game.phase === 'PHASE2_POSITIONS' && (
          <div className="space-y-4">
            {currentAction && (
              <div className="p-2 rounded bg-green-500/10 border border-green-500/20 text-center text-sm text-green-400">
                <Check className="h-4 w-4 inline mr-1" />
                Actions soumises
              </div>
            )}

            {/* Position et Slot Attaque */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Position souhaitée (1-{activePlayerCount})</Label>
                <Select value={positionSouhaitee} onValueChange={setPositionSouhaitee} disabled={isLocked}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Position" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: activePlayerCount }, (_, i) => i + 1).map((n) => (
                      <SelectItem key={n} value={n.toString()}>Position {n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs">Emplacement attaque</Label>
                <Select value={slotAttaque} onValueChange={setSlotAttaque} disabled={isLocked}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Slot" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3].map((n) => (
                      <SelectItem key={n} value={n.toString()}>Slot {n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Attaque 1 - filtered by ATTAQUE category */}
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <Label className="text-xs">Attaque 1</Label>
                {attaque1 && attaque1 !== 'none' && <ItemInfoTooltip itemName={attaque1} />}
              </div>
              <Select value={attaque1} onValueChange={setAttaque1} disabled={isLocked}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Choisir une attaque" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune</SelectItem>
                  {attackItems.map((item) => {
                    const info = getItemInfo(item.objet);
                    return (
                      <SelectItem key={item.objet} value={item.objet}>
                        <div className="flex items-center gap-2">
                          <span>{item.objet}</span>
                          {info && !info.consumable && (
                            <span className="text-xs bg-primary/20 text-primary px-1 rounded">∞</span>
                          )}
                          {info?.base_damage && info.base_damage > 0 && (
                            <span className="text-xs text-red-400">⚔️{info.base_damage}</span>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Attaque 2 - only enabled if Attaque 1 is "Piqure Berseker" */}
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <Label className={`text-xs ${!isAttaque2Enabled ? 'text-muted-foreground' : ''}`}>
                  Attaque 2
                  {!isAttaque2Enabled && (
                    <span className="ml-1 text-xs text-muted-foreground">(requiert Piqure Berseker)</span>
                  )}
                </Label>
                {attaque2 && attaque2 !== 'none' && isAttaque2Enabled && <ItemInfoTooltip itemName={attaque2} />}
              </div>
              <Select 
                value={isAttaque2Enabled ? attaque2 : 'none'} 
                onValueChange={setAttaque2} 
                disabled={isLocked || !isAttaque2Enabled}
              >
                <SelectTrigger className={`h-9 ${!isAttaque2Enabled ? 'opacity-50' : ''}`}>
                  <SelectValue placeholder="Aucune" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune</SelectItem>
                  {isAttaque2Enabled && attackItems
                    .filter(item => item.objet !== 'Piqure Berseker') // Can't use Piqure Berseker twice
                    .map((item) => {
                      const info = getItemInfo(item.objet);
                      return (
                        <SelectItem key={item.objet} value={item.objet}>
                          <div className="flex items-center gap-2">
                            <span>{item.objet}</span>
                            {info && !info.consumable && (
                              <span className="text-xs bg-primary/20 text-primary px-1 rounded">∞</span>
                            )}
                            {info?.base_damage && info.base_damage > 0 && (
                              <span className="text-xs text-red-400">⚔️{info.base_damage}</span>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
            </div>

            {/* Protection - filtered by PROTECTION category */}
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <Label className="text-xs">Protection</Label>
                {protectionObjet && protectionObjet !== 'none' && <ItemInfoTooltip itemName={protectionObjet} />}
              </div>
              <Select value={protectionObjet} onValueChange={setProtectionObjet} disabled={isLocked}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Choisir une protection" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune</SelectItem>
                  {protectionItems.map((item) => {
                    const info = getItemInfo(item.objet);
                    return (
                      <SelectItem key={item.objet} value={item.objet}>
                        <div className="flex items-center gap-2">
                          <span>{item.objet}</span>
                          {info?.base_heal && info.base_heal > 0 && (
                            <span className="text-xs text-green-400">💚{info.base_heal}</span>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Emplacement Protection - only shown if protection is selected */}
            {protectionObjet && protectionObjet !== 'none' && (
              <div className="space-y-1">
                <Label className="text-xs">Emplacement protection</Label>
                <Select value={slotProtection} onValueChange={setSlotProtection} disabled={isLocked}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Choisir un slot" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3].map((n) => (
                      <SelectItem key={n} value={n.toString()}>Slot {n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <ForestButton
              onClick={handleSubmitAction}
              disabled={submitting || isLocked}
              className="w-full"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Valider mes actions
                </>
              )}
            </ForestButton>

            {isLocked && (
              <p className="text-xs text-center text-amber-500">
                <Lock className="h-3 w-3 inline mr-1" />
                Phase verrouillée par le MJ
              </p>
            )}
          </div>
        )}

        {/* Phase 3: Shop */}
        {game.phase === 'PHASE3_SHOP' && (
          <div className="space-y-4">
            {shopItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Boutique non disponible
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  {shopItems.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => !isLocked && setSelectedShopItem(item.id)}
                      className={`p-3 rounded cursor-pointer transition-colors ${
                        selectedShopItem === item.id
                          ? 'bg-primary/20 border-primary'
                          : 'bg-secondary/30 hover:bg-secondary/50'
                      } border`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{item.objet}</span>
                        <span className="text-sm text-yellow-500">{item.cout_normal} jetons</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{item.categorie}</span>
                    </div>
                  ))}
                </div>
                
                <ForestButton
                  disabled={!selectedShopItem || isLocked}
                  className="w-full"
                >
                  Acheter
                </ForestButton>
              </>
            )}
          </div>
        )}

        {/* Phase 4: Combat (read-only) */}
        {game.phase === 'PHASE4_COMBAT' && (
          <div className="text-center py-6">
            <Swords className="h-12 w-12 text-red-400 mx-auto mb-3 animate-pulse" />
            <p className="text-sm text-muted-foreground">
              Combat en cours...
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Consultez les événements pour suivre l'action
            </p>
          </div>
        )}

        {/* Resolution */}
        {game.phase === 'RESOLUTION' && (
          <div className="text-center py-6">
            <Loader2 className="h-12 w-12 text-purple-400 mx-auto mb-3 animate-spin" />
            <p className="text-sm text-muted-foreground">
              Résolution en cours...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}