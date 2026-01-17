import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ForestButton } from '@/components/ui/ForestButton';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, ShoppingBag, Coins, Sword, Shield, 
  Check, X, Lock, AlertCircle
} from 'lucide-react';
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
  clan?: string;
  playerToken?: string;
}

interface ShopPanelProps {
  game: Game;
  player: Player;
  className?: string;
}

interface ShopOffer {
  item_ids: string[];
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

interface Purchase {
  item_name: string;
}

export function ShopPanel({ game, player, className }: ShopPanelProps) {
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [shopOffer, setShopOffer] = useState<ShopOffer | null>(null);
  const [prices, setPrices] = useState<ShopPrice[]>([]);
  const [items, setItems] = useState<ItemCatalog[]>([]);
  const [myPurchases, setMyPurchases] = useState<Purchase[]>([]);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel(`player-shop-${game.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_shop_offers', filter: `game_id=eq.${game.id}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_item_purchases', filter: `game_id=eq.${game.id}` }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [game.id, game.manche_active]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [offerRes, pricesRes, itemsRes, purchasesRes] = await Promise.all([
        supabase
          .from('game_shop_offers')
          .select('item_ids')
          .eq('game_id', game.id)
          .eq('manche', game.manche_active)
          .maybeSingle(),
        supabase.from('shop_prices').select('*'),
        supabase.from('item_catalog').select('name, category, base_damage, base_heal, notes, restockable'),
        supabase
          .from('game_item_purchases')
          .select('item_name')
          .eq('game_id', game.id)
          .eq('player_num', player.playerNumber),
      ]);

      setShopOffer(offerRes.data);
      setPrices(pricesRes.data || []);
      setItems((itemsRes.data || []) as ItemCatalog[]);
      setMyPurchases(purchasesRes.data || []);
    } catch (error) {
      console.error('Error fetching shop data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (itemName: string) => {
    setPurchasing(itemName);
    try {
      const { data, error } = await supabase.functions.invoke('purchase-item', {
        body: { 
          gameId: game.id, 
          playerNumber: player.playerNumber,
          itemName,
          playerToken: player.playerToken,
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || 'Erreur lors de l\'achat');
      }

      toast.success(`${itemName} acheté ! Nouveau solde: ${data.newBalance} jetons`);
      fetchData();
    } catch (error) {
      console.error('Error purchasing item:', error);
      toast.error(error instanceof Error ? error.message : 'Erreur');
    } finally {
      setPurchasing(null);
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

  const canPurchase = (itemName: string) => {
    const info = getItemInfo(itemName);
    const cost = getCost(itemName);
    
    // Check if already purchased (unless restockable)
    if (!info?.restockable && myPurchases.some(p => p.item_name === itemName)) {
      return { can: false, reason: 'Déjà acheté' };
    }
    
    // Check tokens
    if (player.jetons < cost) {
      return { can: false, reason: 'Jetons insuffisants' };
    }

    return { can: true, reason: null };
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

  if (loading) {
    return (
      <div className={`card-gradient rounded-lg border border-border p-4 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!isPhase3) {
    return (
      <div className={`card-gradient rounded-lg border border-border p-4 ${className}`}>
        <div className="text-center py-6">
          <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-sm text-muted-foreground">
            La boutique n'est pas ouverte
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Phase actuelle: {game.phase}
          </p>
        </div>
      </div>
    );
  }

  if (!shopOffer || shopOffer.item_ids.length === 0) {
    return (
      <div className={`card-gradient rounded-lg border border-border p-4 ${className}`}>
        <div className="text-center py-6">
          <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-sm text-muted-foreground">
            En attente de l'ouverture du shop par le MJ...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`card-gradient rounded-lg border border-green-500/30 ${className}`}>
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-4 w-4 text-green-500" />
          <h3 className="font-display text-sm">Boutique</h3>
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

      <div className="p-4 space-y-3">
        {shopOffer.item_ids.map((itemName, index) => {
          const info = getItemInfo(itemName);
          const price = getPrice(itemName);
          const cost = getCost(itemName);
          const { can, reason } = canPurchase(itemName);
          const isPurchasing = purchasing === itemName;

          return (
            <div
              key={`${itemName}-${index}`}
              className={`p-3 rounded-lg border transition-colors ${
                can 
                  ? 'bg-secondary/50 border-border hover:border-green-500/50' 
                  : 'bg-secondary/20 border-border/50 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {info && getCategoryIcon(info.category)}
                    <span className="font-medium truncate">{itemName}</span>
                    {info?.restockable && (
                      <Badge variant="outline" className="text-xs shrink-0">∞</Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {info?.base_damage && info.base_damage > 0 && (
                      <span className="text-red-400">⚔️{info.base_damage} DMG</span>
                    )}
                    {info?.base_heal && info.base_heal > 0 && (
                      <span className="text-green-400">💚+{info.base_heal} HP</span>
                    )}
                  </div>
                  
                  {info?.notes && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {info.notes}
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="flex items-center gap-1">
                    <Coins className="h-3 w-3 text-yellow-500" />
                    <span className={`font-bold ${cost <= player.jetons ? 'text-yellow-500' : 'text-red-500'}`}>
                      {cost}
                    </span>
                  </div>

                  {can ? (
                    <ForestButton
                      size="sm"
                      onClick={() => handlePurchase(itemName)}
                      disabled={isPurchasing || isLocked}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {isPurchasing ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <Check className="h-3 w-3 mr-1" />
                          Acheter
                        </>
                      )}
                    </ForestButton>
                  ) : (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <X className="h-3 w-3" />
                      <span>{reason}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {isLocked && (
          <p className="text-xs text-center text-amber-500 pt-2">
            <AlertCircle className="h-3 w-3 inline mr-1" />
            Phase verrouillée - achats désactivés
          </p>
        )}
      </div>
    </div>
  );
}