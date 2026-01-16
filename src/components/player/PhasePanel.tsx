import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ForestButton } from '@/components/ui/ForestButton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Check, Lock, Coins, MapPin, ShoppingBag, Swords } from 'lucide-react';
import { toast } from 'sonner';

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
  dispo_attaque: boolean;
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
  PHASE2_POSITIONS: { icon: MapPin, label: 'Positions', color: 'text-blue-500' },
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
  const [currentAction, setCurrentAction] = useState<Record<string, unknown> | null>(null);
  
  // Phase 3 state
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [selectedShopItem, setSelectedShopItem] = useState<string>('');

  useEffect(() => {
    if (game.phase === 'PHASE1_MISES') {
      fetchCurrentBet();
    } else if (game.phase === 'PHASE2_POSITIONS') {
      fetchInventory();
      fetchCurrentAction();
    } else if (game.phase === 'PHASE3_SHOP') {
      fetchShopItems();
    }
  }, [game.phase, game.manche_active]);

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
      .select('objet, quantite, dispo_attaque')
      .eq('game_id', game.id)
      .eq('owner_num', player.playerNumber)
      .eq('disponible', true);
    
    if (data) {
      setInventory(data);
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
      await supabase
        .from('round_bets')
        .upsert(
          {
            game_id: game.id,
            manche: game.manche_active,
            num_joueur: player.playerNumber,
            mise: miseValue,
          },
          { onConflict: 'game_id,manche,num_joueur' }
        );

      setCurrentBet(miseValue);
      toast.success('Mise enregistrée !');
    } catch {
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitAction = async () => {
    setSubmitting(true);
    try {
      await supabase
        .from('actions')
        .upsert(
          {
            game_id: game.id,
            manche: game.manche_active,
            num_joueur: player.playerNumber,
            position_souhaitee: positionSouhaitee ? parseInt(positionSouhaitee) : null,
            slot_attaque: slotAttaque ? parseInt(slotAttaque) : null,
            slot_protection: slotProtection ? parseInt(slotProtection) : null,
            attaque1: attaque1 || null,
            attaque2: attaque2 || null,
            protection_objet: protectionObjet || null,
          },
          { onConflict: 'game_id,manche,num_joueur' }
        );

      setCurrentAction({ submitted: true });
      toast.success('Actions enregistrées !');
    } catch {
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSubmitting(false);
    }
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
            {currentBet !== null && (
              <div className="p-3 rounded bg-green-500/10 border border-green-500/20 text-center">
                <p className="text-sm text-green-400">Mise actuelle</p>
                <p className="text-2xl font-bold text-green-500">{currentBet} jetons</p>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="mise">Votre mise (max: {player.jetons})</Label>
              <Input
                id="mise"
                type="number"
                min="0"
                max={player.jetons}
                value={mise}
                onChange={(e) => setMise(e.target.value)}
                disabled={isLocked}
                className="bg-background/50"
              />
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
          </div>
        )}

        {/* Phase 2: Positions */}
        {game.phase === 'PHASE2_POSITIONS' && (
          <div className="space-y-4">
            {currentAction && (
              <div className="p-2 rounded bg-green-500/10 border border-green-500/20 text-center text-sm text-green-400">
                <Check className="h-4 w-4 inline mr-1" />
                Actions soumises
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Position souhaitée</Label>
                <Select value={positionSouhaitee} onValueChange={setPositionSouhaitee} disabled={isLocked}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Position" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <SelectItem key={n} value={n.toString()}>Position {n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs">Slot attaque</Label>
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Attaque 1</Label>
                <Select value={attaque1} onValueChange={setAttaque1} disabled={isLocked}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Objet" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune</SelectItem>
                    {inventory.filter(i => i.dispo_attaque).map((item) => (
                      <SelectItem key={item.objet} value={item.objet}>
                        {item.objet} (x{item.quantite})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs">Attaque 2</Label>
                <Select value={attaque2} onValueChange={setAttaque2} disabled={isLocked}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Objet" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune</SelectItem>
                    {inventory.filter(i => i.dispo_attaque).map((item) => (
                      <SelectItem key={item.objet} value={item.objet}>
                        {item.objet} (x{item.quantite})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Slot protection</Label>
                <Select value={slotProtection} onValueChange={setSlotProtection} disabled={isLocked}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Slot" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {[1, 2, 3].map((n) => (
                      <SelectItem key={n} value={n.toString()}>Slot {n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs">Objet protection</Label>
                <Select value={protectionObjet} onValueChange={setProtectionObjet} disabled={isLocked}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Objet" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {inventory.map((item) => (
                      <SelectItem key={item.objet} value={item.objet}>
                        {item.objet} (x{item.quantite})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

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