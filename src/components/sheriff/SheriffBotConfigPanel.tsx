import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Save, Loader2, RotateCcw } from 'lucide-react';

export interface SheriffBotConfig {
  visa_pv_chance: number;         // % chance bot pays with PV (default 60)
  illegal_tokens_chance: number;  // % chance bot takes illegal tokens (default 30)
  search_chance: number;          // % base chance to search opponent (default 35)
  search_if_suspicious: number;   // % chance to search if opponent seems suspicious (default 60)
}

export const DEFAULT_SHERIFF_BOT_CONFIG: SheriffBotConfig = {
  visa_pv_chance: 60,
  illegal_tokens_chance: 30,
  search_chance: 35,
  search_if_suspicious: 60,
};

interface SheriffBotConfigPanelProps {
  sessionGameId: string;
  currentConfig?: SheriffBotConfig | null;
  onConfigUpdate: () => void;
}

export function SheriffBotConfigPanel({ sessionGameId, currentConfig, onConfigUpdate }: SheriffBotConfigPanelProps) {
  const [config, setConfig] = useState<SheriffBotConfig>(currentConfig || DEFAULT_SHERIFF_BOT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (currentConfig) {
      setConfig({ ...DEFAULT_SHERIFF_BOT_CONFIG, ...currentConfig });
    }
  }, [currentConfig]);

  useEffect(() => {
    const currentStr = JSON.stringify(config);
    const savedStr = JSON.stringify(currentConfig || DEFAULT_SHERIFF_BOT_CONFIG);
    setHasChanges(currentStr !== savedStr);
  }, [config, currentConfig]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Cast to any to avoid TypeScript issues with JSONB column
      const { error } = await supabase
        .from('sheriff_round_state')
        .update({ 
          bot_config: JSON.parse(JSON.stringify(config))
        } as any)
        .eq('session_game_id', sessionGameId);

      if (error) throw error;
      toast.success('Configuration des bots sauvegardée');
      onConfigUpdate();
      setHasChanges(false);
    } catch (err) {
      console.error('Save sheriff bot config error:', err);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setConfig(DEFAULT_SHERIFF_BOT_CONFIG);
  };

  const updateConfig = (key: keyof SheriffBotConfig, value: number) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-4">
      {/* Visa Choice */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">💰 Visa - Payer avec PV</span>
          <Badge variant="outline" className="text-[#D4AF37]">{config.visa_pv_chance}%</Badge>
        </div>
        <Slider
          value={[config.visa_pv_chance]}
          onValueChange={([val]) => updateConfig('visa_pv_chance', val)}
          min={0}
          max={100}
          step={5}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground">
          Probabilité que le bot paie son visa avec ses Points de Victoire (sinon avec la cagnotte commune)
        </p>
      </div>

      {/* Illegal Tokens */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">🎲 Contrebande - Jetons illégaux</span>
          <Badge variant="outline" className="text-red-500">{config.illegal_tokens_chance}%</Badge>
        </div>
        <Slider
          value={[config.illegal_tokens_chance]}
          onValueChange={([val]) => updateConfig('illegal_tokens_chance', val)}
          min={0}
          max={100}
          step={5}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground">
          Probabilité que le bot entre avec 30 jetons (10 illégaux) au lieu de 20 légaux
        </p>
      </div>

      {/* Search Chance */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">🔍 Duel - Fouille de base</span>
          <Badge variant="outline" className="text-[#CD853F]">{config.search_chance}%</Badge>
        </div>
        <Slider
          value={[config.search_chance]}
          onValueChange={([val]) => updateConfig('search_chance', val)}
          min={0}
          max={100}
          step={5}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground">
          Probabilité de base que le bot fouille son adversaire lors d'un duel
        </p>
      </div>

      {/* Search if Suspicious */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">👁️ Duel - Fouille si suspect</span>
          <Badge variant="outline" className="text-orange-500">{config.search_if_suspicious}%</Badge>
        </div>
        <Slider
          value={[config.search_if_suspicious]}
          onValueChange={([val]) => updateConfig('search_if_suspicious', val)}
          min={0}
          max={100}
          step={5}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground">
          Probabilité que le bot fouille si l'adversaire semble suspect (comportement à risque)
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleReset}
          className="flex-1"
        >
          <RotateCcw className="h-4 w-4 mr-1" />
          Défaut
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="flex-1 bg-[#D4AF37] hover:bg-[#D4AF37]/80 text-black"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <Save className="h-4 w-4 mr-1" />
          )}
          Sauvegarder
        </Button>
      </div>
    </div>
  );
}
