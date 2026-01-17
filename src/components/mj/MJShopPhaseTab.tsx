import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ForestButton } from '@/components/ui/ForestButton';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, ShoppingBag, RefreshCw, Coins, Sword, Shield, 
  CheckCircle2, AlertCircle, User
} from 'lucide-react';
import { toast } from 'sonner';

interface Game {
  id: string;
  status: string;
  manche_active: number;
  phase: string;
}

interface ShopOffer {
  id: string;
  game_id: string;
  manche: number;
  item_ids: string[];
  locked: boolean;
  generated_at: string;
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
  restockable: boolean;
}

interface Purchase {
  id: string;
  player_num: number;
  item_name: string;
  cost: number;
  purchased_at: string;
}

interface Player {
  player_number: number;
  display_name: string;
  clan: string | null;
}

interface MJShopPhaseTabProps {
  game: Game;
}

export function MJShopPhaseTab({ game }: MJShopPhaseTabProps) {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [shopOffer, setShopOffer] = useState<ShopOffer | null>(null);
  const [prices, setPrices] = useState<ShopPrice[]>([]);
  const [items, setItems] = useState<ItemCatalog[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel(`mj-shop-${game.id}`)
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
      const [offerRes, pricesRes, itemsRes, purchasesRes, playersRes] = await Promise.all([
        supabase
          .from('game_shop_offers')
          .select('*')
          .eq('game_id', game.id)
          .eq('manche', game.manche_active)
          .maybeSingle(),
        supabase.from('shop_prices').select('*'),
        supabase.from('item_catalog').select('name, category, base_damage, base_heal, restockable'),
        supabase
          .from('game_item_purchases')
          .select('*')
          .eq('game_id', game.id)
          .eq('manche', game.manche_active)
          .order('purchased_at', { ascending: false }),
        supabase
          .from('game_players')
          .select('player_number, display_name, clan')
          .eq('game_id', game.id)
          .eq('status', 'ACTIVE')
          .eq('is_host', false),
      ]);

      setShopOffer(offerRes.data);
      setPrices(pricesRes.data || []);
      setItems((itemsRes.data || []) as ItemCatalog[]);
      setPurchases(purchasesRes.data || []);
      setPlayers(playersRes.data || []);
    } catch (error) {
      console.error('Error fetching shop data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateShop = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-shop', {
        body: { gameId: game.id },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || 'Erreur lors de la génération');
      }

      toast.success('Shop généré avec succès !');
      if (data.warnings?.length > 0) {
        data.warnings.forEach((w: string) => toast.warning(w));
      }
      fetchData();
    } catch (error) {
      console.error('Error generating shop:', error);
      toast.error(error instanceof Error ? error.message : 'Erreur');
    } finally {
      setGenerating(false);
    }
  };

  const getPrice = (itemName: string) => {
    return prices.find(p => p.item_name === itemName);
  };

  const getItemInfo = (itemName: string) => {
    return items.find(i => i.name === itemName);
  };

  const getPlayerName = (playerNum: number) => {
    const player = players.find(p => p.player_number === playerNum);
    return player?.display_name || `Joueur ${playerNum}`;
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'ATTAQUE': return <Sword className="h-4 w-4 text-red-500" />;
      case 'PROTECTION': return <Shield className="h-4 w-4 text-blue-500" />;
      default: return null;
    }
  };

  const isPhase3 = game.phase === 'PHASE3_SHOP';

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg flex items-center gap-2">
          <ShoppingBag className="h-5 w-5 text-green-500" />
          Shop Manche {game.manche_active}
        </h3>
        <Badge variant={isPhase3 ? 'default' : 'secondary'}>
          {isPhase3 ? 'Phase active' : game.phase}
        </Badge>
      </div>

      {/* Generate button */}
      <div className="card-gradient rounded-lg border border-border p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="font-medium">Génération du Shop</h4>
            <p className="text-sm text-muted-foreground">
              {shopOffer 
                ? `Shop généré le ${new Date(shopOffer.generated_at).toLocaleString()}`
                : 'Aucun shop généré pour cette manche'}
            </p>
          </div>
          <ForestButton
            onClick={handleGenerateShop}
            disabled={generating || (shopOffer?.locked && purchases.length > 0)}
            className="bg-green-600 hover:bg-green-700"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : shopOffer ? (
              <RefreshCw className="h-4 w-4 mr-2" />
            ) : (
              <ShoppingBag className="h-4 w-4 mr-2" />
            )}
            {shopOffer ? 'Régénérer' : 'Générer le Shop'}
          </ForestButton>
        </div>

        {shopOffer?.locked && purchases.length > 0 && (
          <p className="text-xs text-amber-400">
            <AlertCircle className="h-3 w-3 inline mr-1" />
            Impossible de régénérer : des achats ont été effectués
          </p>
        )}
      </div>

      {/* Shop offer display */}
      {shopOffer && (
        <div className="card-gradient rounded-lg border border-green-500/30 p-4">
          <h4 className="font-medium mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            Objets proposés (5)
          </h4>
          
          <div className="space-y-2">
            {shopOffer.item_ids.map((itemName, index) => {
              const price = getPrice(itemName);
              const info = getItemInfo(itemName);
              const purchaseCount = purchases.filter(p => p.item_name === itemName).length;

              return (
                <div
                  key={`${itemName}-${index}`}
                  className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground text-sm">#{index + 1}</span>
                    {info && getCategoryIcon(info.category)}
                    <span className="font-medium">{itemName}</span>
                    {info?.restockable && (
                      <Badge variant="outline" className="text-xs">Réachetable</Badge>
                    )}
                    {info?.base_damage && info.base_damage > 0 && (
                      <span className="text-xs text-red-400">⚔️{info.base_damage}</span>
                    )}
                    {info?.base_heal && info.base_heal > 0 && (
                      <span className="text-xs text-green-400">💚{info.base_heal}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    {purchaseCount > 0 && (
                      <Badge variant="default" className="bg-green-600">
                        {purchaseCount} vendu{purchaseCount > 1 ? 's' : ''}
                      </Badge>
                    )}
                    <div className="flex items-center gap-1 text-sm">
                      <Coins className="h-3 w-3 text-yellow-500" />
                      <span>{price?.cost_normal || '?'}</span>
                      <span className="text-muted-foreground">/</span>
                      <span className="text-primary">{price?.cost_akila || '?'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Purchases log */}
      <div className="card-gradient rounded-lg border border-border p-4">
        <h4 className="font-medium mb-4 flex items-center gap-2">
          <User className="h-4 w-4" />
          Achats effectués ({purchases.length})
        </h4>

        {purchases.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Aucun achat pour cette manche
          </p>
        ) : (
          <div className="space-y-2">
            {purchases.map((purchase) => (
              <div
                key={purchase.id}
                className="flex items-center justify-between p-2 bg-secondary/30 rounded"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{getPlayerName(purchase.player_num)}</span>
                  <span className="text-muted-foreground">→</span>
                  <span>{purchase.item_name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-yellow-500">{purchase.cost} jetons</span>
                  <span className="text-muted-foreground text-xs">
                    {new Date(purchase.purchased_at).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}