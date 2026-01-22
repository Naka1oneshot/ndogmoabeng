import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Bot, Save, Loader2, RotateCcw } from 'lucide-react';

export interface BotConfig {
  ba_shoot_chance: number;      // % chance BA shoots (default 90)
  ae_sabotage_base: number;     // % base chance AE sabotages (default 40)
  ae_sabotage_after_success: number; // % after successful sabotage (default 90)
  pv_antidote_chance: number;   // % PV uses antidote when carrier (default 80)
  pv_shoot_chance: number;      // % PV shoots (default 70)
  corruption_min: number;       // Min tokens for corruption (default 2)
  corruption_max: number;       // Max tokens for corruption (default 10)
  oc_pv_target_base: number;    // Base % BA targets known PV (default 40)
  oc_pv_target_increment: number; // % increment per round (default 10)
}

export const DEFAULT_BOT_CONFIG: BotConfig = {
  ba_shoot_chance: 90,
  ae_sabotage_base: 40,
  ae_sabotage_after_success: 90,
  pv_antidote_chance: 80,
  pv_shoot_chance: 70,
  corruption_min: 2,
  corruption_max: 10,
  oc_pv_target_base: 40,
  oc_pv_target_increment: 10,
};

interface BotConfigPanelProps {
  sessionGameId: string;
  manche: number;
  currentConfig?: BotConfig | null;
  onConfigUpdate: () => void;
}

export function BotConfigPanel({ sessionGameId, manche, currentConfig, onConfigUpdate }: BotConfigPanelProps) {
  const [config, setConfig] = useState<BotConfig>(currentConfig || DEFAULT_BOT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (currentConfig) {
      setConfig({ ...DEFAULT_BOT_CONFIG, ...currentConfig });
    }
  }, [currentConfig]);

  useEffect(() => {
    const currentStr = JSON.stringify(config);
    const savedStr = JSON.stringify(currentConfig || DEFAULT_BOT_CONFIG);
    setHasChanges(currentStr !== savedStr);
  }, [config, currentConfig]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const configToSave = {
        bot_config: {
          ba_shoot_chance: config.ba_shoot_chance,
          ae_sabotage_base: config.ae_sabotage_base,
          ae_sabotage_after_success: config.ae_sabotage_after_success,
          pv_antidote_chance: config.pv_antidote_chance,
          pv_shoot_chance: config.pv_shoot_chance,
          corruption_min: config.corruption_min,
          corruption_max: config.corruption_max,
          oc_pv_target_base: config.oc_pv_target_base,
          oc_pv_target_increment: config.oc_pv_target_increment,
        }
      };
      
      const { error } = await supabase
        .from('infection_round_state')
        .update({ config: configToSave })
        .eq('session_game_id', sessionGameId)
        .eq('manche', manche);

      if (error) throw error;
      toast.success('Configuration des bots sauvegardée');
      onConfigUpdate();
      setHasChanges(false);
    } catch (err) {
      console.error('Save bot config error:', err);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setConfig(DEFAULT_BOT_CONFIG);
  };

  const updateConfig = (key: keyof BotConfig, value: number) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-4">
      {/* BA Config */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">BA - Chance de tir</span>
          <Badge variant="outline" className="text-[#B00020]">{config.ba_shoot_chance}%</Badge>
        </div>
        <Slider
          value={[config.ba_shoot_chance]}
          onValueChange={([val]) => updateConfig('ba_shoot_chance', val)}
          min={0}
          max={100}
          step={5}
          className="w-full"
        />
      </div>

      {/* AE Sabotage Config */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">AE - Sabotage initial</span>
          <Badge variant="outline" className="text-[#6366F1]">{config.ae_sabotage_base}%</Badge>
        </div>
        <Slider
          value={[config.ae_sabotage_base]}
          onValueChange={([val]) => updateConfig('ae_sabotage_base', val)}
          min={0}
          max={100}
          step={5}
          className="w-full"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">AE - Sabotage après succès</span>
          <Badge variant="outline" className="text-[#6366F1]">{config.ae_sabotage_after_success}%</Badge>
        </div>
        <Slider
          value={[config.ae_sabotage_after_success]}
          onValueChange={([val]) => updateConfig('ae_sabotage_after_success', val)}
          min={0}
          max={100}
          step={5}
          className="w-full"
        />
      </div>

      {/* PV Config */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">PV - Antidote si porteur</span>
          <Badge variant="outline" className="text-[#2AB3A6]">{config.pv_antidote_chance}%</Badge>
        </div>
        <Slider
          value={[config.pv_antidote_chance]}
          onValueChange={([val]) => updateConfig('pv_antidote_chance', val)}
          min={0}
          max={100}
          step={5}
          className="w-full"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">PV - Chance de tir</span>
          <Badge variant="outline" className="text-[#2AB3A6]">{config.pv_shoot_chance}%</Badge>
        </div>
        <Slider
          value={[config.pv_shoot_chance]}
          onValueChange={([val]) => updateConfig('pv_shoot_chance', val)}
          min={0}
          max={100}
          step={5}
          className="w-full"
        />
      </div>

      {/* OC/BA targeting */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">BA ciblant PV (si OC a vu)</span>
          <Badge variant="outline" className="text-[#D4AF37]">{config.oc_pv_target_base}% +{config.oc_pv_target_increment}%/manche</Badge>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-xs text-muted-foreground">Base</span>
            <Slider
              value={[config.oc_pv_target_base]}
              onValueChange={([val]) => updateConfig('oc_pv_target_base', val)}
              min={0}
              max={100}
              step={5}
              className="w-full"
            />
          </div>
          <div>
            <span className="text-xs text-muted-foreground">+/manche</span>
            <Slider
              value={[config.oc_pv_target_increment]}
              onValueChange={([val]) => updateConfig('oc_pv_target_increment', val)}
              min={0}
              max={30}
              step={5}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Corruption range */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Corruption (jetons)</span>
          <Badge variant="outline">{config.corruption_min} - {config.corruption_max}</Badge>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-xs text-muted-foreground">Min</span>
            <Slider
              value={[config.corruption_min]}
              onValueChange={([val]) => updateConfig('corruption_min', Math.min(val, config.corruption_max))}
              min={1}
              max={20}
              step={1}
              className="w-full"
            />
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Max</span>
            <Slider
              value={[config.corruption_max]}
              onValueChange={([val]) => updateConfig('corruption_max', Math.max(val, config.corruption_min))}
              min={1}
              max={20}
              step={1}
              className="w-full"
            />
          </div>
        </div>
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
