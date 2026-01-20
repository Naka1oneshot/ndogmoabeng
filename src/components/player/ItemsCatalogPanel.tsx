import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sword, Shield, Wrench, Coins, Zap, Heart, Info } from 'lucide-react';
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
  detailed_description: string | null;
}

interface ShopPrice {
  item_name: string;
  cost_normal: number;
  cost_akila: number;
}

interface ItemsCatalogPanelProps {
  playerClan?: string | null;
}

export function ItemsCatalogPanel({ playerClan }: ItemsCatalogPanelProps) {
  const [items, setItems] = useState<ItemCatalog[]>([]);
  const [shopPrices, setShopPrices] = useState<ShopPrice[]>([]);
  const [loading, setLoading] = useState(true);

  const isAkila = playerClan?.toLowerCase().includes('akila');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [itemsRes, pricesRes] = await Promise.all([
        supabase.from('item_catalog').select('*').order('category').order('name'),
        supabase.from('shop_prices').select('item_name, cost_normal, cost_akila'),
      ]);

      if (itemsRes.error) throw itemsRes.error;
      if (pricesRes.error) throw pricesRes.error;

      setItems(itemsRes.data || []);
      setShopPrices(pricesRes.data || []);
    } catch (error) {
      console.error('Error fetching items:', error);
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
    const isInShop = price !== undefined && price.cost_normal > 0;
    const displayPrice = isAkila ? price?.cost_akila : price?.cost_normal;

    return (
      <AccordionItem key={item.id} value={item.id} className="border-b border-border/50">
        <AccordionTrigger className="hover:no-underline py-3 px-2">
          <div className="flex items-center gap-2 w-full pr-2 text-left">
            {getCategoryIcon(item.category)}
            <span className="flex-1 font-medium text-sm">{item.name}</span>
            
            <div className="flex items-center gap-1 flex-shrink-0">
              {item.base_damage && item.base_damage > 0 && (
                <Badge variant="outline" className="text-red-500 border-red-500/50 text-xs px-1.5 py-0">
                  <Zap className="h-3 w-3 mr-0.5" />
                  {item.base_damage}
                </Badge>
              )}
              {item.base_heal && item.base_heal > 0 && (
                <Badge variant="outline" className="text-green-500 border-green-500/50 text-xs px-1.5 py-0">
                  <Heart className="h-3 w-3 mr-0.5" />
                  +{item.base_heal}
                </Badge>
              )}
              
              {isInShop && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0">
                  <Coins className="h-3 w-3 mr-0.5" />
                  {displayPrice}
                </Badge>
              )}
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="px-2 pb-2 space-y-2 text-sm">
            {/* Description détaillée */}
            {item.detailed_description && (
              <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                <p className="text-sm">{item.detailed_description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
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
              {item.ignore_protection && (
                <div className="col-span-2">
                  <Badge variant="destructive" className="text-xs">Ignore les protections</Badge>
                </div>
              )}
            </div>

            {item.special_effect && item.special_effect !== 'AUCUN' && (
              <div className="p-2 bg-secondary/50 rounded-lg text-xs">
                <span className="text-muted-foreground font-medium">Effet spécial:</span>{' '}
                {item.special_effect}
                {item.special_value && item.special_value !== '0' && (
                  <span className="ml-1 text-muted-foreground">({item.special_value})</span>
                )}
              </div>
            )}

            {item.notes && (
              <div className="flex items-start gap-2 text-muted-foreground italic text-xs">
                <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span>{item.notes}</span>
              </div>
            )}

            {isInShop && (
              <div className="flex items-center gap-4 p-2 bg-secondary/50 rounded-lg text-xs">
                <div className="flex items-center gap-1">
                  <Coins className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Normal:</span>
                  <span className={`font-bold ${!isAkila ? 'text-primary' : ''}`}>{price?.cost_normal}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Akila:</span>
                  <span className={`font-bold ${isAkila ? 'text-primary' : ''}`}>{price?.cost_akila}</span>
                </div>
              </div>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    );
  };

  const renderCategory = (categoryItems: ItemCatalog[], label: string, icon: React.ReactNode, borderColor: string) => {
    if (categoryItems.length === 0) return null;
    
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {icon}
          <h4 className="font-medium text-sm">{label} ({categoryItems.length})</h4>
        </div>
        <div className={`card-gradient rounded-lg border ${borderColor}`}>
          <Accordion type="multiple" className="w-full">
            {categoryItems.map(renderItemCard)}
          </Accordion>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg">📖 Catalogue des Objets</h3>
        <span className="text-xs text-muted-foreground">{items.length} objets</span>
      </div>

      {isAkila && (
        <div className="p-2 bg-primary/10 border border-primary/30 rounded-lg text-xs text-center">
          <span className="text-primary font-medium">Clan Akila</span> — Prix réduits affichés
        </div>
      )}

      <div className="space-y-4">
        {renderCategory(
          attackItems, 
          'Attaque', 
          <Sword className="h-4 w-4 text-red-500" />,
          'border-red-500/20'
        )}
        {renderCategory(
          protectionItems, 
          'Protection', 
          <Shield className="h-4 w-4 text-blue-500" />,
          'border-blue-500/20'
        )}
        {renderCategory(
          utilityItems, 
          'Utilitaire', 
          <Wrench className="h-4 w-4 text-yellow-500" />,
          'border-yellow-500/20'
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
