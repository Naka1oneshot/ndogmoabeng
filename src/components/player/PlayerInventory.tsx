import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Package, Coins, Trophy, Sword, Shield, Info, Zap, Heart } from 'lucide-react';

interface InventoryItem {
  id: string;
  objet: string;
  quantite: number;
  disponible: boolean;
  dispo_attaque: boolean;
}

interface CatalogItem {
  name: string;
  category: string;
  base_damage: number | null;
  base_heal: number | null;
  notes: string | null;
  consumable: boolean | null;
  detailed_description: string | null;
}

interface PlayerInventoryProps {
  gameId: string;
  playerNumber: number;
  jetons: number;
  recompenses: number;
  clan: string | null;
  mateNum: number | null;
  className?: string;
}

function ItemDetails({ item, catalog }: { item: InventoryItem; catalog: Map<string, CatalogItem> }) {
  const details = catalog.get(item.objet);
  
  if (!details) {
    return (
      <div className="flex items-center justify-between p-2 rounded bg-secondary/30">
        <span className="text-sm">{item.objet}</span>
        <span className="text-xs font-medium">x{item.quantite}</span>
      </div>
    );
  }

  return (
    <details className="p-2 rounded bg-secondary/30 cursor-pointer">
      <summary className="flex items-center justify-between list-none">
        <div className="flex items-center gap-2">
          <span className="text-sm">{item.objet}</span>
          {!item.disponible && (
            <span className="text-xs text-red-400">(utilisé)</span>
          )}
          <Info className="h-3 w-3 text-muted-foreground" />
        </div>
        <div className="flex items-center gap-2">
          {details.base_damage && details.base_damage > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-red-400">
              <Zap className="h-3 w-3" />
              {details.base_damage}
            </span>
          )}
          {details.base_heal && details.base_heal > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-green-400">
              <Heart className="h-3 w-3" />
              {details.base_heal}
            </span>
          )}
          <span className="text-xs font-medium">x{item.quantite}</span>
        </div>
      </summary>
      <div className="mt-2 pt-2 border-t border-border space-y-1">
        {details.detailed_description && (
          <p className="text-xs text-primary font-medium">
            {details.detailed_description}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {details.consumable ? '🔥 Consommable' : '∞ Permanent'}
        </p>
      </div>
    </details>
  );
}

function UsableItemDetails({ item, catalog }: { item: InventoryItem; catalog: Map<string, CatalogItem> }) {
  const details = catalog.get(item.objet);
  
  if (!details) {
    return (
      <div className="flex items-center justify-between p-2 rounded bg-green-500/10 border border-green-500/20">
        <span className="text-sm">{item.objet}</span>
        <span className="text-xs font-medium">x{item.quantite}</span>
      </div>
    );
  }

  return (
    <details className="p-2 rounded bg-green-500/10 border border-green-500/20 cursor-pointer">
      <summary className="flex items-center justify-between list-none">
        <div className="flex items-center gap-2">
          <span className="text-sm">{item.objet}</span>
          <Info className="h-3 w-3 text-muted-foreground" />
        </div>
        <div className="flex items-center gap-2">
          {details.base_damage && details.base_damage > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-red-400">
              <Zap className="h-3 w-3" />
              {details.base_damage}
            </span>
          )}
          {details.base_heal && details.base_heal > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-green-400">
              <Heart className="h-3 w-3" />
              {details.base_heal}
            </span>
          )}
          <span className="text-xs font-medium">x{item.quantite}</span>
        </div>
      </summary>
      <div className="mt-2 pt-2 border-t border-border space-y-1">
        {details.detailed_description && (
          <p className="text-xs text-primary font-medium">
            {details.detailed_description}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {details.consumable ? '🔥 Consommable' : '∞ Permanent'}
        </p>
      </div>
    </details>
  );
}

export function PlayerInventory({
  gameId,
  playerNumber,
  jetons,
  recompenses,
  clan,
  mateNum,
  className,
}: PlayerInventoryProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [catalog, setCatalog] = useState<Map<string, CatalogItem>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel(`inventory-${gameId}-${playerNumber}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory',
          filter: `game_id=eq.${gameId}`,
        },
        () => fetchInventory()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, playerNumber]);

  const fetchData = async () => {
    await Promise.all([fetchInventory(), fetchCatalog()]);
    setLoading(false);
  };

  const fetchInventory = async () => {
    const { data, error } = await supabase
      .from('inventory')
      .select('id, objet, quantite, disponible, dispo_attaque')
      .eq('game_id', gameId)
      .eq('owner_num', playerNumber);

    if (!error && data) {
      setItems(data);
    }
  };

  const fetchCatalog = async () => {
    const { data, error } = await supabase
      .from('item_catalog')
      .select('name, category, base_damage, base_heal, notes, consumable, detailed_description');

    if (!error && data) {
      const catalogMap = new Map<string, CatalogItem>();
      data.forEach((item) => {
        catalogMap.set(item.name, item);
      });
      setCatalog(catalogMap);
    }
  };

  const usableItems = items.filter((item) => item.disponible && item.dispo_attaque);
  const otherItems = items.filter((item) => !item.disponible || !item.dispo_attaque);

  return (
    <div className={`card-gradient rounded-lg border border-border ${className}`}>
      <div className="p-3 border-b border-border flex items-center gap-2">
        <Package className="h-4 w-4 text-primary" />
        <h3 className="font-display text-sm">Inventaire</h3>
      </div>

      <div className="p-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 p-2 rounded bg-yellow-500/10">
            <Coins className="h-4 w-4 text-yellow-500" />
            <div>
              <div className="text-xs text-muted-foreground">Jetons</div>
              <div className="font-bold">{jetons}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded bg-amber-500/10">
            <Trophy className="h-4 w-4 text-amber-500" />
            <div>
              <div className="text-xs text-muted-foreground">Récompenses</div>
              <div className="font-bold">{recompenses}</div>
            </div>
          </div>
        </div>

        {/* Clan & Partner */}
        {(clan || mateNum) && (
          <div className="flex flex-wrap gap-2 text-sm">
            {clan && (
              <span className="px-2 py-1 rounded bg-primary/10 text-primary">
                Clan: {clan}
              </span>
            )}
            {mateNum && (
              <span className="px-2 py-1 rounded bg-secondary text-secondary-foreground">
                Partenaire: #{mateNum}
              </span>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Inventaire vide
          </p>
        ) : (
          <ScrollArea className="h-[200px] md:h-[300px]">
            <div className="space-y-3">
              {/* Usable items */}
              {usableItems.length > 0 && (
                <div>
                  <div className="flex items-center gap-1 text-xs text-green-400 mb-2">
                    <Sword className="h-3 w-3" />
                    Utilisables en attaque
                  </div>
                  <div className="space-y-1">
                    {usableItems.map((item) => (
                      <UsableItemDetails key={item.id} item={item} catalog={catalog} />
                    ))}
                  </div>
                </div>
              )}

              {/* Other items */}
              {otherItems.length > 0 && (
                <div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                    <Shield className="h-3 w-3" />
                    Autres objets
                  </div>
                  <div className="space-y-1">
                    {otherItems.map((item) => (
                      <ItemDetails key={item.id} item={item} catalog={catalog} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
