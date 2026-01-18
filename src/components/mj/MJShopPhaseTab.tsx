import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ForestButton } from '@/components/ui/ForestButton';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, ShoppingBag, RefreshCw, Coins, Sword, Shield, 
  CheckCircle2, AlertCircle, User, Play, Clock, Check, X
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Game {
  id: string;
  status: string;
  manche_active: number;
  phase: string;
  current_session_game_id?: string | null;
}

interface ShopOffer {
  id: string;
  game_id: string;
  manche: number;
  item_ids: string[];
  locked: boolean;
  resolved: boolean;
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

interface ShopRequest {
  id: string;
  player_num: number;
  player_id: string;
  want_buy: boolean;
  item_name: string | null;
  updated_at: string;
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
  const [resolving, setResolving] = useState(false);
  const [shopOffer, setShopOffer] = useState<ShopOffer | null>(null);
  const [prices, setPrices] = useState<ShopPrice[]>([]);
  const [items, setItems] = useState<ItemCatalog[]>([]);
  const [requests, setRequests] = useState<ShopRequest[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedManche, setSelectedManche] = useState(game.manche_active || 1);

  // Reset to current manche when phase changes
  useEffect(() => {
    setSelectedManche(game.manche_active || 1);
  }, [game.manche_active, game.phase]);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel(`mj-shop-${game.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_shop_offers', filter: `game_id=eq.${game.id}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_requests', filter: `game_id=eq.${game.id}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_item_purchases', filter: `game_id=eq.${game.id}` }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [game.id, selectedManche]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [offerRes, pricesRes, itemsRes, requestsRes, purchasesRes, playersRes] = await Promise.all([
        supabase
          .from('game_shop_offers')
          .select('*')
          .eq('game_id', game.id)
          .eq('manche', selectedManche)
          .maybeSingle(),
        supabase.from('shop_prices').select('*'),
        supabase.from('item_catalog').select('name, category, base_damage, base_heal, restockable'),
        supabase
          .from('shop_requests')
          .select('*')
          .eq('game_id', game.id)
          .eq('manche', selectedManche)
          .order('updated_at', { ascending: false }),
        supabase
          .from('game_item_purchases')
          .select('*')
          .eq('game_id', game.id)
          .eq('manche', selectedManche)
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
      setRequests(requestsRes.data || []);
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

  const handleResolveShop = async () => {
    setResolving(true);
    try {
      const { data, error } = await supabase.functions.invoke('resolve-shop', {
        body: { gameId: game.id },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || 'Erreur lors de la résolution');
      }

      if (data.alreadyResolved) {
        toast.info('Shop déjà résolu pour cette manche');
      } else {
        const nextRound = data.nextRound ? ` → Manche ${data.nextRound.manche}` : '';
        toast.success(`Shop résolu ! ${data.stats.approved} achats validés, ${data.stats.refused} refusés${nextRound}`);
      }
      fetchData();
    } catch (error) {
      console.error('Error resolving shop:', error);
      toast.error(error instanceof Error ? error.message : 'Erreur');
    } finally {
      setResolving(false);
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
  const isResolved = shopOffer?.resolved;
  const requestsWithBuy = requests.filter(r => r.want_buy);
  const isViewingHistory = selectedManche < (game.manche_active || 1);
  const mancheOptions = Array.from({ length: game.manche_active || 1 }, (_, i) => i + 1);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Manche Selector */}
      {(game.manche_active || 1) > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Manche :</span>
          {mancheOptions.map((manche) => (
            <button
              key={manche}
              onClick={() => setSelectedManche(manche)}
              className={`px-3 py-1 rounded-md text-sm transition-colors ${
                selectedManche === manche
                  ? 'bg-primary text-primary-foreground'
                  : manche < (game.manche_active || 1)
                    ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                    : 'bg-secondary hover:bg-secondary/80'
              }`}
            >
              {manche}
            </button>
          ))}
        </div>
      )}

      {/* History indicator */}
      {isViewingHistory && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-500" />
          <span className="text-sm text-amber-400">
            Historique de la manche {selectedManche} (lecture seule)
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg flex items-center gap-2">
          <ShoppingBag className="h-5 w-5 text-green-500" />
          Shop Manche {selectedManche}
        </h3>
        <div className="flex items-center gap-2">
          {isResolved && (
            <Badge variant="outline" className="text-green-500 border-green-500">
              <Check className="h-3 w-3 mr-1" />
              Résolu
            </Badge>
          )}
          {!isViewingHistory && (
            <Badge variant={isPhase3 ? 'default' : 'secondary'}>
              {isPhase3 ? 'Phase active' : game.phase}
            </Badge>
          )}
        </div>
      </div>

      {/* Generate button - only show for current manche */}
      {!isViewingHistory && (
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
              disabled={generating || isResolved}
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

          {isResolved && (
            <p className="text-xs text-green-400">
              <CheckCircle2 className="h-3 w-3 inline mr-1" />
              Shop résolu - régénération désactivée
            </p>
          )}
        </div>
      )}

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
              const requestCount = requestsWithBuy.filter(r => r.item_name === itemName).length;

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
                    {requestCount > 0 && !isResolved && (
                      <Badge variant="secondary" className="bg-amber-500/20 text-amber-400">
                        <Clock className="h-3 w-3 mr-1" />
                        {requestCount} souhait{requestCount > 1 ? 's' : ''}
                      </Badge>
                    )}
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

      {/* Requests section - show if shop exists and (not resolved and not viewing history OR viewing history) */}
      {shopOffer && ((!isResolved && !isViewingHistory) || isViewingHistory) && (
        <div className="card-gradient rounded-lg border border-amber-500/30 p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Souhaits d'achat ({requests.length} joueurs)
            </h4>
            
            {/* Only show resolve button for current manche and not resolved */}
            {!isViewingHistory && !isResolved && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <ForestButton
                    disabled={resolving || requests.length === 0}
                    className="bg-amber-600 hover:bg-amber-700"
                  >
                    {resolving ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Play className="h-4 w-4 mr-2" />
                    )}
                    Résoudre le Shop
                  </ForestButton>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Résoudre le Shop ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action va appliquer les achats selon l'ordre de priorité des mises.
                      Les joueurs les plus prioritaires seront servis en premier.
                      <br /><br />
                      <strong>Cette action est irréversible.</strong>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={handleResolveShop}>
                      Confirmer la résolution
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucun souhait enregistré pour cette manche
            </p>
          ) : (
            <div className="space-y-2">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className={`flex items-center justify-between p-2 rounded ${
                    request.want_buy 
                      ? 'bg-green-500/10 border border-green-500/30' 
                      : 'bg-secondary/30'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{getPlayerName(request.player_num)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {request.want_buy ? (
                      <>
                        <Check className="h-4 w-4 text-green-500" />
                        <span className="text-green-400">{request.item_name}</span>
                      </>
                    ) : (
                      <>
                        <X className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Pas d'achat</span>
                      </>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(request.updated_at).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Purchases log - show if resolved or viewing history */}
      {(isResolved || isViewingHistory) && (
        <div className="card-gradient rounded-lg border border-border p-4">
          <h4 className="font-medium mb-4 flex items-center gap-2">
            <User className="h-4 w-4" />
            Achats validés ({purchases.length})
          </h4>

          {purchases.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {shopOffer ? 'Aucun achat validé pour cette manche' : 'Aucun shop pour cette manche'}
            </p>
          ) : (
            <div className="space-y-2">
              {purchases.map((purchase) => (
                <div
                  key={purchase.id}
                  className="flex items-center justify-between p-2 bg-green-500/10 rounded border border-green-500/30"
                >
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
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
      )}
    </div>
  );
}