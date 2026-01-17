import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ForestButton } from '@/components/ui/ForestButton';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, ShoppingBag, Coins, Sword, Shield, 
  Check, Lock, AlertCircle, Clock, Send
} from 'lucide-react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Game {
  id: string;
  manche_active: number;
  phase: string;
  phase_locked: boolean;
}

interface Player {
  playerNumber: number;
  jetons: number;
  clan?: string;
  playerToken?: string;
  playerId?: string;
}

interface ShopPanelProps {
  game: Game;
  player: Player;
  className?: string;
}

interface ShopOffer {
  item_ids: string[];
  resolved: boolean;
}

interface ShopPrice {
  item_name: string;
  cost_normal: number;
  cost_akila: number;
}

interface ItemCatalog {
  name: string;
  category: 'ATTAQUE' | 'PROTECTION';
  base_damage: number | null;
  base_heal: number | null;
  notes: string | null;
  restockable: boolean;
}

interface ShopRequest {
  want_buy: boolean;
  item_name: string | null;
}

interface ApprovedPurchase {
  item_name: string;
}

export function ShopPanel({ game, player, className }: ShopPanelProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [shopOffer, setShopOffer] = useState<ShopOffer | null>(null);
  const [prices, setPrices] = useState<ShopPrice[]>([]);
  const [items, setItems] = useState<ItemCatalog[]>([]);
  const [myRequest, setMyRequest] = useState<ShopRequest | null>(null);
  const [myPurchases, setMyPurchases] = useState<ApprovedPurchase[]>([]);
  
  // Form state
  const [wantBuy, setWantBuy] = useState(false);
  const [selectedItem, setSelectedItem] = useState<string>('');

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel(`player-shop-${game.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_shop_offers', filter: `game_id=eq.${game.id}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_requests', filter: `game_id=eq.${game.id}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_item_purchases', filter: `game_id=eq.${game.id}` }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [game.id, game.manche_active]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [offerRes, pricesRes, itemsRes, requestRes, purchasesRes] = await Promise.all([
        supabase
          .from('game_shop_offers')
          .select('item_ids, resolved')
          .eq('game_id', game.id)
          .eq('manche', game.manche_active)
          .maybeSingle(),
        supabase.from('shop_prices').select('*'),
        supabase.from('item_catalog').select('name, category, base_damage, base_heal, notes, restockable'),
        supabase
          .from('shop_requests')
          .select('want_buy, item_name')
          .eq('game_id', game.id)
          .eq('manche', game.manche_active)
          .eq('player_num', player.playerNumber)
          .maybeSingle(),
        supabase
          .from('game_item_purchases')
          .select('item_name')
          .eq('game_id', game.id)
          .eq('manche', game.manche_active)
          .eq('player_num', player.playerNumber),
      ]);

      setShopOffer(offerRes.data);
      setPrices(pricesRes.data || []);
      setItems((itemsRes.data || []) as ItemCatalog[]);
      
      if (requestRes.data) {
        setMyRequest(requestRes.data);
        setWantBuy(requestRes.data.want_buy);
        setSelectedItem(requestRes.data.item_name || '');
      } else {
        setMyRequest(null);
        setWantBuy(false);
        setSelectedItem('');
      }
      
      setMyPurchases(purchasesRes.data || []);
    } catch (error) {
      console.error('Error fetching shop data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRequest = async () => {
    if (wantBuy && !selectedItem) {
      toast.error('Veuillez sélectionner un objet');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('submit-shop-request', {
        body: { 
          gameId: game.id, 
          playerNumber: player.playerNumber,
          playerToken: player.playerToken,
          wantBuy: wantBuy,
          itemName: wantBuy ? selectedItem : null,
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || 'Erreur lors de l\'enregistrement');
      }

      toast.success(data.message);
      fetchData();
    } catch (error) {
      console.error('Error submitting shop request:', error);
      toast.error(error instanceof Error ? error.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const getPrice = (itemName: string) => {
    return prices.find(p => p.item_name === itemName);
  };

  const getItemInfo = (itemName: string) => {
    return items.find(i => i.name === itemName);
  };

  const getCost = (itemName: string) => {
    const price = getPrice(itemName);
    if (!price) return 0;
    const isAkila = player.clan?.toLowerCase().includes('akila') || false;
    return isAkila ? price.cost_akila : price.cost_normal;
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'ATTAQUE': return <Sword className="h-4 w-4 text-red-500" />;
      case 'PROTECTION': return <Shield className="h-4 w-4 text-blue-500" />;
      default: return null;
    }
  };

  const isLocked = game.phase_locked;
  const isPhase3 = game.phase === 'PHASE3_SHOP';
  const isResolved = shopOffer?.resolved;
  const canSubmitWish = isPhase3 && !isLocked && !isResolved;

  if (loading) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  // No shop generated yet
  if (!shopOffer || shopOffer.item_ids.length === 0) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="text-center py-6">
          <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-sm text-muted-foreground">
            En attente de la génération du shop par le MJ...
          </p>
        </div>
      </div>
    );
  }

  // Show purchases if resolved
  if (isResolved) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="p-3 mb-3 rounded bg-green-500/10 border border-green-500/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-green-500" />
            <span className="font-display text-sm">Boutique - Résolu</span>
          </div>
          <Badge variant="outline" className="text-green-500 border-green-500">
            <Check className="h-3 w-3 mr-1" />
            Terminé
          </Badge>
        </div>
        
        <div className="space-y-3">
          {myPurchases.length > 0 ? (
            <>
              <p className="text-sm text-green-400">
                ✅ Vos achats validés :
              </p>
              {myPurchases.map((purchase, idx) => (
                <div key={idx} className="p-2 bg-green-500/10 rounded border border-green-500/30">
                  <span className="font-medium">{purchase.item_name}</span>
                </div>
              ))}
            </>
          ) : myRequest?.want_buy ? (
            <p className="text-sm text-amber-400">
              ⚠️ Votre demande pour "{myRequest.item_name}" n'a pas pu être validée 
              (objet déjà pris par un joueur plus prioritaire ou jetons insuffisants)
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Vous n'avez pas souhaité acheter d'objet cette manche.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`p-4 ${className}`}>
      {/* Header with balance */}
      <div className="p-3 mb-3 rounded bg-secondary/50 border border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-4 w-4 text-green-500" />
          <span className="font-display text-sm">Boutique</span>
        </div>
        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-yellow-500" />
          <span className="font-bold text-yellow-500">{player.jetons}</span>
          {isLocked && (
            <span className="flex items-center gap-1 text-xs text-amber-500">
              <Lock className="h-3 w-3" />
            </span>
          )}
        </div>
      </div>

      {/* Important notice */}
      <div className="p-2 mb-3 rounded bg-amber-500/10 border border-amber-500/30">
        <p className="text-xs text-amber-400 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>Le MJ résout les achats selon l'ordre de priorité.</span>
        </p>
      </div>

      {/* Shop items list */}
      <div className="space-y-2 mb-4">
        <p className="text-xs text-muted-foreground">Objets disponibles :</p>
        {shopOffer.item_ids.map((itemName, index) => {
          const info = getItemInfo(itemName);
          const cost = getCost(itemName);

          return (
            <div
              key={`${itemName}-${index}`}
              className={`p-2 rounded-lg border transition-colors ${
                selectedItem === itemName && wantBuy
                  ? 'bg-green-500/20 border-green-500/50' 
                  : 'bg-secondary/30 border-border/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {info && getCategoryIcon(info.category)}
                  <span className="font-medium text-sm">{itemName}</span>
                  {info?.restockable && (
                    <Badge variant="outline" className="text-xs">∞</Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Coins className="h-3 w-3 text-yellow-500" />
                  <span className={`text-sm ${cost <= player.jetons ? 'text-yellow-500' : 'text-red-500'}`}>
                    {cost}
                  </span>
                </div>
              </div>
              {info?.notes && (
                <p className="text-xs text-muted-foreground mt-1 pl-6">{info.notes}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Request form - only enabled in Phase 3 */}
      {!isPhase3 ? (
        <div className="pt-3 border-t border-border">
          <div className="p-3 rounded bg-muted/50 border border-border text-center">
            <Lock className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Souhaits d'achat verrouillés
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Disponible en Phase 3 (Shop)
            </p>
          </div>
        </div>
      ) : (
        <div className="pt-3 border-t border-border space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="want-buy" className="text-sm font-medium">
              Souhaitez-vous acheter ?
            </Label>
            <Switch
              id="want-buy"
              checked={wantBuy}
              onCheckedChange={setWantBuy}
              disabled={!canSubmitWish || submitting}
            />
          </div>

          {wantBuy && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Choisir un objet :</Label>
              <Select 
                value={selectedItem} 
                onValueChange={setSelectedItem}
                disabled={!canSubmitWish || submitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un objet..." />
                </SelectTrigger>
                <SelectContent>
                  {shopOffer.item_ids.map((itemName, idx) => {
                    const cost = getCost(itemName);
                    const canAfford = player.jetons >= cost;
                    return (
                      <SelectItem 
                        key={`${itemName}-${idx}`} 
                        value={itemName}
                        disabled={!canAfford}
                      >
                        <span className={!canAfford ? 'text-muted-foreground' : ''}>
                          {itemName} ({cost} jetons)
                          {!canAfford && ' - Insuffisant'}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          <ForestButton
            onClick={handleSubmitRequest}
            disabled={!canSubmitWish || submitting || (wantBuy && !selectedItem)}
            className="w-full"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Enregistrer mon choix
          </ForestButton>

          {myRequest && (
            <p className="text-xs text-center text-muted-foreground">
              {myRequest.want_buy 
                ? `✅ Souhait enregistré : ${myRequest.item_name}`
                : '✅ Enregistré : aucun achat souhaité'}
            </p>
          )}

          {isLocked && (
            <p className="text-xs text-center text-amber-500 pt-2">
              <AlertCircle className="h-3 w-3 inline mr-1" />
              Phase verrouillée - modifications désactivées
            </p>
          )}
        </div>
      )}
    </div>
  );
}
