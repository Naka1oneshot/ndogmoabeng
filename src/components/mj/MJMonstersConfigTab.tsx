import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ForestButton } from '@/components/ui/ForestButton';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Loader2, Save, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

interface MonsterCatalog {
  id: number;
  name: string;
  pv_max_default: number;
  reward_default: number;
  is_default_in_pool: boolean;
}

interface GameMonster {
  id: string;
  game_id: string;
  monster_id: number;
  pv_max_override: number | null;
  reward_override: number | null;
  initial_status: 'EN_BATAILLE' | 'EN_FILE';
  order_index: number;
  is_enabled: boolean;
}

interface MJMonstersConfigTabProps {
  game: {
    id: string;
    status: string;
  };
}

export function MJMonstersConfigTab({ game }: MJMonstersConfigTabProps) {
  const [catalog, setCatalog] = useState<MonsterCatalog[]>([]);
  const [gameMonsters, setGameMonsters] = useState<GameMonster[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Local edits
  const [localConfig, setLocalConfig] = useState<Record<number, {
    pv_max_override: number | null;
    reward_override: number | null;
    initial_status: 'EN_BATAILLE' | 'EN_FILE';
    is_enabled: boolean;
  }>>({});

  useEffect(() => {
    fetchData();
  }, [game.id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch catalog
      const { data: catalogData, error: catalogError } = await supabase
        .from('monster_catalog')
        .select('*')
        .order('id');

      if (catalogError) throw catalogError;
      setCatalog(catalogData || []);

      // Fetch game-specific config
      const { data: gmData, error: gmError } = await supabase
        .from('game_monsters')
        .select('*')
        .eq('game_id', game.id)
        .order('order_index');

      if (gmError) throw gmError;
      setGameMonsters(gmData || []);

      // Initialize local config from game monsters or defaults
      const config: typeof localConfig = {};
      (catalogData || []).forEach((monster) => {
        const existing = (gmData || []).find(gm => gm.monster_id === monster.id);
        if (existing) {
          config[monster.id] = {
            pv_max_override: existing.pv_max_override,
            reward_override: existing.reward_override,
            initial_status: existing.initial_status,
            is_enabled: existing.is_enabled,
          };
        } else {
          config[monster.id] = {
            pv_max_override: null,
            reward_override: null,
            initial_status: monster.id <= 3 ? 'EN_BATAILLE' : 'EN_FILE',
            is_enabled: true,
          };
        }
      });
      setLocalConfig(config);
    } catch (error) {
      console.error('Error fetching monsters:', error);
      toast.error('Erreur de chargement des monstres');
    } finally {
      setLoading(false);
    }
  };

  const initializeDefaults = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.rpc('initialize_game_monsters', { 
        p_game_id: game.id 
      });
      if (error) throw error;
      toast.success('Configuration par défaut appliquée');
      await fetchData();
    } catch (error) {
      console.error('Error initializing:', error);
      toast.error('Erreur lors de l\'initialisation');
    } finally {
      setSaving(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      // Upsert each monster config
      for (const monster of catalog) {
        const config = localConfig[monster.id];
        if (!config) continue;

        const existing = gameMonsters.find(gm => gm.monster_id === monster.id);

        if (existing) {
          // Update
          const { error } = await supabase
            .from('game_monsters')
            .update({
              pv_max_override: config.pv_max_override,
              reward_override: config.reward_override,
              initial_status: config.initial_status,
              is_enabled: config.is_enabled,
            })
            .eq('id', existing.id);
          if (error) throw error;
        } else {
          // Insert
          const { error } = await supabase
            .from('game_monsters')
            .insert({
              game_id: game.id,
              monster_id: monster.id,
              pv_max_override: config.pv_max_override,
              reward_override: config.reward_override,
              initial_status: config.initial_status,
              order_index: monster.id,
              is_enabled: config.is_enabled,
            });
          if (error) throw error;
        }
      }

      toast.success('Configuration sauvegardée');
      await fetchData();
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const updateLocalConfig = (monsterId: number, field: string, value: any) => {
    setLocalConfig(prev => ({
      ...prev,
      [monsterId]: {
        ...prev[monsterId],
        [field]: value,
      },
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const isLobby = game.status === 'LOBBY';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg">🐉 Configuration des Monstres</h3>
        <div className="flex items-center gap-2">
          {gameMonsters.length === 0 && (
            <ForestButton 
              variant="outline" 
              size="sm" 
              onClick={initializeDefaults}
              disabled={saving}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Défaut
            </ForestButton>
          )}
          <ForestButton 
            size="sm" 
            onClick={saveConfig}
            disabled={saving || !isLobby}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Save className="h-4 w-4 mr-1" />
                Sauvegarder
              </>
            )}
          </ForestButton>
        </div>
      </div>

      {!isLobby && (
        <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-sm text-yellow-600">
          ⚠️ La configuration des monstres est verrouillée après le début de la partie.
        </div>
      )}

      <div className="space-y-3">
        {catalog.map((monster) => {
          const config = localConfig[monster.id];
          if (!config) return null;

          const effectivePv = config.pv_max_override ?? monster.pv_max_default;
          const effectiveReward = config.reward_override ?? monster.reward_default;

          return (
            <div 
              key={monster.id}
              className={`card-gradient rounded-lg border p-4 ${
                config.is_enabled ? 'border-border' : 'border-muted opacity-60'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                {/* Monster info */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={config.is_enabled}
                      onCheckedChange={(v) => updateLocalConfig(monster.id, 'is_enabled', v)}
                      disabled={!isLobby}
                    />
                    <Badge variant={config.initial_status === 'EN_BATAILLE' ? 'default' : 'secondary'}>
                      #{monster.id}
                    </Badge>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{monster.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Défaut: {monster.pv_max_default} PV / {monster.reward_default} jetons
                    </div>
                  </div>
                </div>

                {/* Overrides */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">PV Max</Label>
                    <Input
                      type="number"
                      min={1}
                      value={config.pv_max_override ?? ''}
                      placeholder={String(monster.pv_max_default)}
                      onChange={(e) => updateLocalConfig(
                        monster.id, 
                        'pv_max_override', 
                        e.target.value ? parseInt(e.target.value) : null
                      )}
                      className="h-8 w-20"
                      disabled={!isLobby}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Récompense</Label>
                    <Input
                      type="number"
                      min={0}
                      value={config.reward_override ?? ''}
                      placeholder={String(monster.reward_default)}
                      onChange={(e) => updateLocalConfig(
                        monster.id, 
                        'reward_override', 
                        e.target.value ? parseInt(e.target.value) : null
                      )}
                      className="h-8 w-20"
                      disabled={!isLobby}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Position</Label>
                    <select
                      value={config.initial_status}
                      onChange={(e) => updateLocalConfig(
                        monster.id, 
                        'initial_status', 
                        e.target.value as 'EN_BATAILLE' | 'EN_FILE'
                      )}
                      className="h-8 px-2 rounded border bg-background text-sm w-full"
                      disabled={!isLobby}
                    >
                      <option value="EN_BATAILLE">Bataille</option>
                      <option value="EN_FILE">File</option>
                    </select>
                  </div>
                </div>

                {/* Effective values badge */}
                <div className="text-right text-sm">
                  <div className="text-primary font-bold">{effectivePv} PV</div>
                  <div className="text-muted-foreground">{effectiveReward} 🪙</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {catalog.length === 0 && (
        <div className="p-8 text-center text-muted-foreground">
          Aucun monstre dans le catalogue
        </div>
      )}
    </div>
  );
}
