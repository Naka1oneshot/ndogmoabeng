import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Package, Target, Shield, Sparkles } from 'lucide-react';

interface Player {
  id: string;
  player_number: number | null;
  role_code: string | null;
  jetons: number | null;
  pvic: number | null;
  immune_permanent: boolean | null;
}

interface InventoryItem {
  id: string;
  objet: string;
  quantite: number;
  disponible: boolean;
}

interface InfectionInventoryPanelProps {
  sessionGameId: string;
  player: Player;
}

const ITEM_ICONS: Record<string, string> = {
  'Balle BA': '🔫',
  'Balle PV': '🔫',
  'Antidote PV': '💉',
  'Antidote Ezkar': '💉',
  'Boule de cristal': '🔮',
  'Gilet': '🛡️',
  'Dose de venin PV': '🦠',
};

const ITEM_COLORS: Record<string, string> = {
  'Balle BA': '#B00020',
  'Balle PV': '#B00020',
  'Antidote PV': '#2AB3A6',
  'Antidote Ezkar': '#2AB3A6',
  'Boule de cristal': '#D4AF37',
  'Gilet': '#6B7280',
  'Dose de venin PV': '#B00020',
};

export function InfectionInventoryPanel({
  sessionGameId,
  player,
}: InfectionInventoryPanelProps) {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInventory();

    const channel = supabase
      .channel(`infection-inventory-${player.player_number}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory',
          filter: `session_game_id=eq.${sessionGameId}`,
        },
        fetchInventory
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionGameId, player.player_number]);

  const fetchInventory = async () => {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('session_game_id', sessionGameId)
      .eq('owner_num', player.player_number);

    if (data) {
      setInventory(data as InventoryItem[]);
    }
    setLoading(false);
  };

  const activeItems = inventory.filter(i => i.quantite > 0);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-[#1A2235] rounded-lg text-center">
          <p className="text-[#6B7280] text-sm">Jetons</p>
          <p className="text-2xl font-bold text-[#D4AF37]">💰 {player.jetons || 0}</p>
        </div>
        <div className="p-4 bg-[#1A2235] rounded-lg text-center">
          <p className="text-[#6B7280] text-sm">Points de Victoire</p>
          <p className="text-2xl font-bold text-[#2AB3A6]">⭐ {player.pvic || 0}</p>
        </div>
      </div>

      {/* Status */}
      <div className="flex flex-wrap gap-2">
        {player.immune_permanent && (
          <Badge className="bg-[#2AB3A6]/20 text-[#2AB3A6] border-[#2AB3A6]/50">
            <Shield className="h-3 w-3 mr-1" />
            Immunisé permanent
          </Badge>
        )}
      </div>

      {/* Items */}
      <div className="p-4 bg-[#1A2235] rounded-lg">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Package className="h-4 w-4 text-[#D4AF37]" />
          Objets
        </h3>

        {loading ? (
          <p className="text-center text-[#6B7280]">Chargement...</p>
        ) : activeItems.length === 0 ? (
          <p className="text-center text-[#6B7280] py-4">
            Aucun objet dans l'inventaire.
          </p>
        ) : (
          <div className="space-y-2">
            {activeItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 bg-[#0B0E14] rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{ITEM_ICONS[item.objet] || '📦'}</span>
                  <span 
                    className="font-medium"
                    style={{ color: ITEM_COLORS[item.objet] || '#EAEAF2' }}
                  >
                    {item.objet}
                  </span>
                </div>
                <Badge 
                  variant="outline"
                  style={{ 
                    borderColor: ITEM_COLORS[item.objet] || '#6B7280',
                    color: ITEM_COLORS[item.objet] || '#6B7280'
                  }}
                >
                  x{item.quantite}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
