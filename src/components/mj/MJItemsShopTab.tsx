import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, Sword, Shield, Wrench, Coins, Info } from 'lucide-react';
import { toast } from 'sonner';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface ItemCatalog {
  id: string;
  name: string;
  category: 'ATTAQUE' | 'PROTECTION' | 'UTILITAIRE';
  base_damage: number | null;
  base_heal: number | null;
  target: string | null;
  timing: string | null;
  persistence: string | null;
  ignore_protection: boolean | null;
  special_effect: string | null;
  special_value: string | null;
  consumable: boolean | null;
  notes: string | null;
  purchasable: boolean | null;
}

interface ShopPrice {
  id: string;
  item_name: string;
  cost_normal: number;
  cost_akila: number;
}

interface MJItemsShopTabProps {
  game: {
    id: string;
    status: string;
  };
}

export function MJItemsShopTab({ game }: MJItemsShopTabProps) {
  const [items, setItems] = useState<ItemCatalog[]>([]);
  const [shopPrices, setShopPrices] = useState<ShopPrice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [itemsRes, pricesRes] = await Promise.all([
        supabase.from('item_catalog').select('*').order('category').order('name'),
        supabase.from('shop_prices').select('*'),
      ]);

      if (itemsRes.error) throw itemsRes.error;
      if (pricesRes.error) throw pricesRes.error;

      setItems(itemsRes.data || []);
      setShopPrices(pricesRes.data || []);
    } catch (error) {
      console.error('Error fetching items:', error);
      toast.error('Erreur de chargement des objets');
    } finally {
      setLoading(false);
    }
  };

  const getPrice = (itemName: string): ShopPrice | undefined => {
    return shopPrices.find(p => p.item_name === itemName);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'ATTAQUE': return <Sword className="h-4 w-4 text-red-500" />;
      case 'PROTECTION': return <Shield className="h-4 w-4 text-blue-500" />;
      case 'UTILITAIRE': return <Wrench className="h-4 w-4 text-yellow-500" />;
      default: return null;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'ATTAQUE': return 'bg-red-500/10 text-red-500 border-red-500/30';
      case 'PROTECTION': return 'bg-blue-500/10 text-blue-500 border-blue-500/30';
      case 'UTILITAIRE': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30';
      default: return '';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // Group by category
  const attackItems = items.filter(i => i.category === 'ATTAQUE');
  const protectionItems = items.filter(i => i.category === 'PROTECTION');
  const utilityItems = items.filter(i => i.category === 'UTILITAIRE');

  const renderItemCard = (item: ItemCatalog) => {
    const price = getPrice(item.name);
    const isInShop = price !== undefined;

    return (
      <AccordionItem key={item.id} value={item.id}>
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-3 w-full pr-4">
            {getCategoryIcon(item.category)}
            <span className="flex-1 text-left font-medium">{item.name}</span>
            
            {item.base_damage && item.base_damage > 0 && (
              <Badge variant="outline" className="text-red-500 border-red-500/50">
                {item.base_damage} DMG
              </Badge>
            )}
            {item.base_heal && item.base_heal > 0 && (
              <Badge variant="outline" className="text-green-500 border-green-500/50">
                +{item.base_heal} HP
              </Badge>
            )}
            
            {isInShop && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Coins className="h-3 w-3" />
                <span>{price.cost_normal}</span>
                {price.cost_akila !== price.cost_normal && (
                  <span className="text-primary">/{price.cost_akila}</span>
                )}
              </div>
            )}
            
            {item.ignore_protection && (
              <Badge variant="destructive" className="text-xs">Ignore Prot.</Badge>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="pl-7 space-y-2 text-sm">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {item.target && (
                <div>
                  <span className="text-muted-foreground">Cible:</span>{' '}
                  <span className="font-medium">{item.target}</span>
                </div>
              )}
              {item.timing && (
                <div>
                  <span className="text-muted-foreground">Timing:</span>{' '}
                  <span className="font-medium">{item.timing}</span>
                </div>
              )}
              {item.persistence && item.persistence !== 'AUCUNE' && (
                <div>
                  <span className="text-muted-foreground">Durée:</span>{' '}
                  <span className="font-medium">{item.persistence}</span>
                </div>
              )}
              {item.consumable !== null && (
                <div>
                  <span className="text-muted-foreground">Consommable:</span>{' '}
                  <span className="font-medium">{item.consumable ? 'Oui' : 'Non'}</span>
                </div>
              )}
            </div>

            {item.special_effect && item.special_effect !== 'AUCUN' && (
              <div className="p-2 bg-primary/10 rounded-lg">
                <span className="text-primary font-medium">Effet spécial:</span>{' '}
                {item.special_effect}
                {item.special_value && item.special_value !== '0' && (
                  <span className="ml-1 text-muted-foreground">({item.special_value})</span>
                )}
              </div>
            )}

            {item.notes && (
              <div className="flex items-start gap-2 text-muted-foreground italic">
                <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{item.notes}</span>
              </div>
            )}

            {isInShop && (
              <div className="flex items-center gap-4 p-2 bg-secondary/50 rounded-lg">
                <div className="flex items-center gap-1">
                  <Coins className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Prix Normal:</span>
                  <span className="font-bold">{price.cost_normal}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Prix Akila:</span>
                  <span className="font-bold text-primary">{price.cost_akila}</span>
                </div>
              </div>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg">⚔️ Catalogue d'Objets & Shop</h3>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{items.length} objets</span>
          <span>•</span>
          <span>{shopPrices.length} au shop</span>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Attaque */}
        {attackItems.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Sword className="h-5 w-5 text-red-500" />
              <h4 className="font-medium text-red-500">Attaque ({attackItems.length})</h4>
            </div>
            <div className="card-gradient rounded-lg border border-red-500/20">
              <Accordion type="multiple" className="w-full">
                {attackItems.map(renderItemCard)}
              </Accordion>
            </div>
          </div>
        )}

        {/* Protection */}
        {protectionItems.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-500" />
              <h4 className="font-medium text-blue-500">Protection ({protectionItems.length})</h4>
            </div>
            <div className="card-gradient rounded-lg border border-blue-500/20">
              <Accordion type="multiple" className="w-full">
                {protectionItems.map(renderItemCard)}
              </Accordion>
            </div>
          </div>
        )}

        {/* Utilitaire */}
        {utilityItems.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-yellow-500" />
              <h4 className="font-medium text-yellow-500">Utilitaire ({utilityItems.length})</h4>
            </div>
            <div className="card-gradient rounded-lg border border-yellow-500/20">
              <Accordion type="multiple" className="w-full">
                {utilityItems.map(renderItemCard)}
              </Accordion>
            </div>
          </div>
        )}
      </div>

      {items.length === 0 && (
        <div className="p-8 text-center text-muted-foreground">
          Aucun objet dans le catalogue
        </div>
      )}
    </div>
  );
}
