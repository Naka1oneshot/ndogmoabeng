import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Package, Coins, Trophy, Sword, Shield } from 'lucide-react';

interface InventoryItem {
  id: string;
  objet: string;
  quantite: number;
  disponible: boolean;
  dispo_attaque: boolean;
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInventory();

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

  const fetchInventory = async () => {
    const { data, error } = await supabase
      .from('inventory')
      .select('id, objet, quantite, disponible, dispo_attaque')
      .eq('game_id', gameId)
      .eq('owner_num', playerNumber);

    if (!error && data) {
      setItems(data);
    }
    setLoading(false);
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
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-2 rounded bg-green-500/10 border border-green-500/20"
                      >
                        <span className="text-sm">{item.objet}</span>
                        <span className="text-xs font-medium">x{item.quantite}</span>
                      </div>
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
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-2 rounded bg-secondary/30"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{item.objet}</span>
                          {!item.disponible && (
                            <span className="text-xs text-red-400">(utilisé)</span>
                          )}
                        </div>
                        <span className="text-xs font-medium">x{item.quantite}</span>
                      </div>
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
