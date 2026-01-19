import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Loader2, Package, Search, Filter, User, 
  Sword, Shield, Check, X, Info, Zap, Heart
} from 'lucide-react';

interface Game {
  id: string;
}

interface MJInventoryTabProps {
  game: Game;
}

interface Player {
  id: string;
  player_number: number;
  display_name: string;
  status: string;
}

interface InventoryItem {
  id: string;
  owner_num: number;
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
  detailed_description: string | null;
  consumable: boolean | null;
}

export function MJInventoryTab({ game }: MJInventoryTabProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [catalog, setCatalog] = useState<Map<string, CatalogItem>>(new Map());
  const [loading, setLoading] = useState(true);
  const [filterPlayer, setFilterPlayer] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = useCallback(async () => {
    const [playersResult, inventoryResult, catalogResult] = await Promise.all([
      supabase
        .from('game_players')
        .select('id, player_number, display_name, status')
        .eq('game_id', game.id)
        .eq('is_host', false)
        .in('status', ['ACTIVE', 'IN_GAME', 'LEFT', 'REMOVED'])
        .order('player_number', { ascending: true }),
      supabase
        .from('inventory')
        .select('*')
        .eq('game_id', game.id)
        .order('owner_num', { ascending: true }),
      supabase
        .from('item_catalog')
        .select('name, category, base_damage, base_heal, detailed_description, consumable'),
    ]);

    if (playersResult.data) setPlayers(playersResult.data);
    if (inventoryResult.data) setInventory(inventoryResult.data);
    if (catalogResult.data) {
      const catalogMap = new Map<string, CatalogItem>();
      catalogResult.data.forEach((item) => {
        catalogMap.set(item.name, item);
      });
      setCatalog(catalogMap);
    }
    setLoading(false);
  }, [game.id]);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel(`mj-inventory-${game.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory', filter: `game_id=eq.${game.id}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${game.id}` }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [game.id, fetchData]);

  // Get player name by number
  const getPlayerName = (num: number): string => {
    const player = players.find(p => p.player_number === num);
    return player?.display_name || `Joueur ${num}`;
  };

  // Filter inventory
  const filteredInventory = inventory.filter(item => {
    if (filterPlayer !== 'all' && item.owner_num?.toString() !== filterPlayer) {
      return false;
    }
    if (searchQuery && !item.objet.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  // Group by player
  const inventoryByPlayer = new Map<number, InventoryItem[]>();
  for (const item of filteredInventory) {
    const num = item.owner_num || 0;
    if (!inventoryByPlayer.has(num)) {
      inventoryByPlayer.set(num, []);
    }
    inventoryByPlayer.get(num)!.push(item);
  }

  // Summary stats
  const totalItems = inventory.reduce((sum, i) => sum + (i.quantite || 0), 0);
  const uniqueItems = new Set(inventory.map(i => i.objet)).size;
  const playersWithItems = new Set(inventory.map(i => i.owner_num)).size;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card-gradient rounded-lg border border-border p-4 text-center">
          <Package className="h-5 w-5 mx-auto mb-2 text-primary" />
          <div className="text-2xl font-bold">{totalItems}</div>
          <div className="text-xs text-muted-foreground">Objets totaux</div>
        </div>
        <div className="card-gradient rounded-lg border border-border p-4 text-center">
          <Sword className="h-5 w-5 mx-auto mb-2 text-red-500" />
          <div className="text-2xl font-bold">{uniqueItems}</div>
          <div className="text-xs text-muted-foreground">Types uniques</div>
        </div>
        <div className="card-gradient rounded-lg border border-border p-4 text-center">
          <User className="h-5 w-5 mx-auto mb-2 text-blue-500" />
          <div className="text-2xl font-bold">{playersWithItems}</div>
          <div className="text-xs text-muted-foreground">Joueurs équipés</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterPlayer} onValueChange={setFilterPlayer}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Joueur" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les joueurs</SelectItem>
              {players.map(p => (
                <SelectItem key={p.player_number} value={p.player_number.toString()}>
                  P{p.player_number} - {p.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un objet..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Inventory table */}
      {filterPlayer === 'all' ? (
        // Grouped view by player
        <div className="space-y-4">
          {Array.from(inventoryByPlayer.entries())
            .sort(([a], [b]) => a - b)
            .map(([playerNum, items]) => (
              <div key={playerNum} className="card-gradient rounded-lg border border-border overflow-hidden">
                <div className="p-3 border-b border-border bg-secondary/30 flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  <span className="font-medium">
                    P{playerNum} - {getPlayerName(playerNum)}
                  </span>
                  <Badge variant="secondary" className="ml-auto">
                    {items.reduce((sum, i) => sum + (i.quantite || 0), 0)} objets
                  </Badge>
                </div>
                <div className="p-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {items.map(item => {
                      const details = catalog.get(item.objet);
                      return (
                        <details 
                          key={item.id}
                          className={`p-2 rounded border cursor-pointer ${
                            item.disponible 
                              ? 'bg-secondary/50 border-border' 
                              : 'bg-red-500/10 border-red-500/30 opacity-60'
                          }`}
                        >
                          <summary className="list-none">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1">
                                <span className="font-medium text-sm truncate">{item.objet}</span>
                                <Info className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              </div>
                              <div className="flex items-center gap-1">
                                {details?.base_damage && details.base_damage > 0 && (
                                  <span className="flex items-center gap-0.5 text-xs text-red-400">
                                    <Zap className="h-3 w-3" />
                                    {details.base_damage}
                                  </span>
                                )}
                                {details?.base_heal && details.base_heal > 0 && (
                                  <span className="flex items-center gap-0.5 text-xs text-green-400">
                                    <Heart className="h-3 w-3" />
                                    {details.base_heal}
                                  </span>
                                )}
                                <Badge variant="outline" className="text-xs ml-1">
                                  x{item.quantite}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              {item.dispo_attaque ? (
                                <span className="flex items-center gap-1 text-red-400">
                                  <Sword className="h-3 w-3" /> Attaque
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-blue-400">
                                  <Shield className="h-3 w-3" /> Défense
                                </span>
                              )}
                              {!item.disponible && (
                                <span className="text-red-400">(utilisé)</span>
                              )}
                            </div>
                          </summary>
                          {details?.detailed_description && (
                            <div className="mt-2 pt-2 border-t border-border/50 space-y-1">
                              <p className="text-xs text-primary">
                                {details.detailed_description}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {details.consumable ? '🔥 Consommable' : '∞ Permanent'}
                              </p>
                            </div>
                          )}
                        </details>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          {inventoryByPlayer.size === 0 && (
            <div className="card-gradient rounded-lg border border-border p-8 text-center text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Aucun inventaire trouvé</p>
            </div>
          )}
        </div>
      ) : (
        // Table view for single player
        <div className="card-gradient rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Objet</TableHead>
                <TableHead className="text-center">Quantité</TableHead>
                <TableHead className="text-center">Type</TableHead>
                <TableHead className="text-center">Disponible</TableHead>
                <TableHead className="text-center">Attaque dispo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInventory.map(item => {
                const details = catalog.get(item.objet);
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <details className="cursor-pointer">
                        <summary className="list-none flex items-center gap-2">
                          <span className="font-medium">{item.objet}</span>
                          <Info className="h-3 w-3 text-muted-foreground" />
                          {details?.base_damage && details.base_damage > 0 && (
                            <span className="flex items-center gap-0.5 text-xs text-red-400">
                              <Zap className="h-3 w-3" />
                              {details.base_damage}
                            </span>
                          )}
                          {details?.base_heal && details.base_heal > 0 && (
                            <span className="flex items-center gap-0.5 text-xs text-green-400">
                              <Heart className="h-3 w-3" />
                              {details.base_heal}
                            </span>
                          )}
                        </summary>
                        {details?.detailed_description && (
                          <p className="text-xs text-primary mt-1 pt-1 border-t border-border/50">
                            {details.detailed_description}
                          </p>
                        )}
                      </details>
                    </TableCell>
                    <TableCell className="text-center">{item.quantite}</TableCell>
                    <TableCell className="text-center">
                      {item.dispo_attaque ? (
                        <Badge variant="destructive" className="text-xs">
                          <Sword className="h-3 w-3 mr-1" /> Attaque
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          <Shield className="h-3 w-3 mr-1" /> Défense
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {item.disponible ? (
                        <Check className="h-5 w-5 text-green-500 mx-auto" />
                      ) : (
                        <X className="h-5 w-5 text-red-500 mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {item.dispo_attaque ? (
                        <Check className="h-5 w-5 text-green-500 mx-auto" />
                      ) : (
                        <X className="h-5 w-5 text-muted-foreground mx-auto" />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredInventory.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Aucun objet trouvé
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
