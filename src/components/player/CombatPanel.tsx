import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ForestButton } from '@/components/ui/ForestButton';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Check, Lock, Swords, Info, AlertCircle, Eye } from 'lucide-react';
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

interface CombatPanelProps {
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

export function CombatPanel({ game, player, className }: CombatPanelProps) {
  const [submitting, setSubmitting] = useState(false);
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

  const isActivePhase = game.phase === 'PHASE2_POSITIONS';
  const isCombatPhase = game.phase === 'PHASE4_COMBAT' || game.phase === 'RESOLUTION';
  const isLocked = game.phase_locked;

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
    fetchActivePlayerCount();
    fetchInventory();
    fetchItemCatalog();
    fetchCurrentAction();

    const channel = supabase
      .channel(`combat-panel-${game.id}-${player.playerNumber}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${game.id}` },
        () => { fetchActivePlayerCount(); }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'inventory', filter: `game_id=eq.${game.id}` },
        () => { fetchInventory(); }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'actions', filter: `game_id=eq.${game.id}` },
        () => { fetchCurrentAction(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [game.id, game.manche_active]);

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
    } else {
      setCurrentAction(null);
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
        console.error('[CombatPanel] Action submission error:', error);
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

  // Combat/Resolution phase - read-only view
  if (isCombatPhase) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="text-center py-6">
          <Eye className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {game.phase === 'PHASE4_COMBAT' 
              ? 'Combat en cours...' 
              : 'Résolution des actions...'}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Observez le champ de bataille et les événements.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-4 ${className}`}>
      {/* Phase indicator */}
      {!isActivePhase && (
        <div className="mb-4 p-3 rounded bg-muted/50 border border-border text-center">
          <AlertCircle className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            La phase d'actions n'est pas active
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Phase actuelle: {game.phase}
          </p>
        </div>
      )}

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
            <Select value={positionSouhaitee} onValueChange={setPositionSouhaitee} disabled={isLocked || !isActivePhase}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Position" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: activePlayerCount }, (_, i) => (
                  <SelectItem key={i + 1} value={(i + 1).toString()}>
                    #{i + 1}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Slot attaque (1-3)</Label>
            <Select value={slotAttaque} onValueChange={setSlotAttaque} disabled={isLocked || !isActivePhase}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Slot" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Slot 1</SelectItem>
                <SelectItem value="2">Slot 2</SelectItem>
                <SelectItem value="3">Slot 3</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Attaque 1 */}
        <div className="space-y-1">
          <Label className="text-xs flex items-center">
            <Swords className="h-3 w-3 mr-1 text-red-500" />
            Attaque 1
            {attaque1 && attaque1 !== 'none' && <ItemInfoTooltip itemName={attaque1} />}
          </Label>
          <Select value={attaque1} onValueChange={setAttaque1} disabled={isLocked || !isActivePhase}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Choisir attaque" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Aucune</SelectItem>
              {attackItems.map(item => renderItemOption(item))}
            </SelectContent>
          </Select>
        </div>

        {/* Attaque 2 (conditional) */}
        <div className="space-y-1">
          <Label className={`text-xs flex items-center ${!isAttaque2Enabled ? 'text-muted-foreground' : ''}`}>
            <Swords className="h-3 w-3 mr-1 text-red-500" />
            Attaque 2
            {!isAttaque2Enabled && <span className="ml-1 text-muted-foreground">(Piqure Berseker requise)</span>}
            {attaque2 && attaque2 !== 'none' && isAttaque2Enabled && <ItemInfoTooltip itemName={attaque2} />}
          </Label>
          <Select
            value={attaque2}
            onValueChange={setAttaque2}
            disabled={isLocked || !isActivePhase || !isAttaque2Enabled}
          >
            <SelectTrigger className={`h-9 ${!isAttaque2Enabled ? 'opacity-50' : ''}`}>
              <SelectValue placeholder={isAttaque2Enabled ? "Choisir attaque 2" : "Non disponible"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Aucune</SelectItem>
              {attackItems
                .filter(item => item.objet !== attaque1)
                .map(item => renderItemOption(item))}
            </SelectContent>
          </Select>
        </div>

        {/* Protection */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs flex items-center">
              🛡️ Protection
              {protectionObjet && protectionObjet !== 'none' && <ItemInfoTooltip itemName={protectionObjet} />}
            </Label>
            <Select value={protectionObjet} onValueChange={setProtectionObjet} disabled={isLocked || !isActivePhase}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Protection" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucune</SelectItem>
                {protectionItems.map(item => renderItemOption(item))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Slot protection</Label>
            <Select
              value={slotProtection}
              onValueChange={setSlotProtection}
              disabled={isLocked || !isActivePhase || !protectionObjet || protectionObjet === 'none'}
            >
              <SelectTrigger className={`h-9 ${!protectionObjet || protectionObjet === 'none' ? 'opacity-50' : ''}`}>
                <SelectValue placeholder="Slot" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Slot 1</SelectItem>
                <SelectItem value="2">Slot 2</SelectItem>
                <SelectItem value="3">Slot 3</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <ForestButton
          onClick={handleSubmitAction}
          disabled={submitting || isLocked || !isActivePhase}
          className="w-full"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Check className="h-4 w-4 mr-2" />
              {currentAction ? 'Modifier mes actions' : 'Valider mes actions'}
            </>
          )}
        </ForestButton>

        {isLocked && isActivePhase && (
          <p className="text-xs text-center text-amber-500">
            <Lock className="h-3 w-3 inline mr-1" />
            Phase verrouillée par le MJ
          </p>
        )}
      </div>
    </div>
  );
}
