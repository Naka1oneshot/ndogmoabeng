import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Save, Loader2, RotateCcw, Zap } from 'lucide-react';

export interface SheriffBotConfig {
  visa_pv_chance: number;         // % chance bot pays with PV (default 60)
  illegal_tokens_chance: number;  // % chance bot takes illegal tokens (default 30)
  search_chance: number;          // % base chance to search opponent (default 35)
  search_if_suspicious: number;   // % chance to search if opponent seems suspicious (default 60)
  auto_mode: boolean;             // Automatically execute bot decisions when phase changes
}

export const DEFAULT_SHERIFF_BOT_CONFIG: SheriffBotConfig = {
  visa_pv_chance: 60,
  illegal_tokens_chance: 30,
  search_chance: 35,
  search_if_suspicious: 60,
  auto_mode: false,
};

interface SheriffBotConfigPanelProps {
  sessionGameId: string;
  gameId: string;
  currentConfig?: SheriffBotConfig | null;
  currentPhase?: string;
  onConfigUpdate: () => void;
}

export function SheriffBotConfigPanel({ 
  sessionGameId, 
  gameId,
  currentConfig, 
  currentPhase,
  onConfigUpdate 
}: SheriffBotConfigPanelProps) {
  const [config, setConfig] = useState<SheriffBotConfig>(currentConfig || DEFAULT_SHERIFF_BOT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [autoExecuting, setAutoExecuting] = useState(false);
  const lastAutoPhaseRef = useRef<string | null>(null);

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

  // Auto-execute bot decisions when phase changes and auto_mode is enabled
  useEffect(() => {
    if (!config.auto_mode || !currentPhase || autoExecuting) return;
    if (lastAutoPhaseRef.current === currentPhase) return;
    
    const executeAutoMode = async () => {
      lastAutoPhaseRef.current = currentPhase;
      
      if (currentPhase === 'CHOICES') {
        setAutoExecuting(true);
        try {
          const { data, error } = await supabase.functions.invoke('sheriff-bot-decisions', {
            body: { gameId, sessionGameId, action: 'choices' },
          });
          if (error) throw error;
          if (data?.decisions_made > 0) {
            toast.info(`🤖 Auto: ${data.decisions_made} bots ont fait leurs choix`);
            onConfigUpdate();
          }
        } catch (err) {
          console.error('Auto-mode choices error:', err);
        } finally {
          setAutoExecuting(false);
        }
      } else if (currentPhase === 'DUELS') {
        setAutoExecuting(true);
        try {
          const { data, error } = await supabase.functions.invoke('sheriff-bot-decisions', {
            body: { gameId, sessionGameId, action: 'duels_all' },
          });
          if (error) throw error;
          if (data?.decisions_made > 0) {
            toast.info(`🤖 Auto: ${data.decisions_made} décisions de duel pré-remplies`);
            onConfigUpdate();
          }
        } catch (err) {
          console.error('Auto-mode duels error:', err);
        } finally {
          setAutoExecuting(false);
        }
      }
    };

    // Small delay to ensure phase change is complete
    const timer = setTimeout(executeAutoMode, 500);
    return () => clearTimeout(timer);
  }, [currentPhase, config.auto_mode, gameId, sessionGameId, onConfigUpdate, autoExecuting]);

  const handleSave = async () => {
    setSaving(true);
    try {
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

  const updateConfig = (key: keyof SheriffBotConfig, value: number | boolean) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleAutoModeToggle = async (enabled: boolean) => {
    updateConfig('auto_mode', enabled);
    // Save immediately when toggling auto mode
    setSaving(true);
    try {
      const newConfig = { ...config, auto_mode: enabled };
      const { error } = await supabase
        .from('sheriff_round_state')
        .update({ 
          bot_config: JSON.parse(JSON.stringify(newConfig))
        } as any)
        .eq('session_game_id', sessionGameId);

      if (error) throw error;
      toast.success(enabled ? '🤖 Mode automatique activé' : 'Mode automatique désactivé');
      onConfigUpdate();
    } catch (err) {
      console.error('Toggle auto mode error:', err);
      toast.error('Erreur lors de la mise à jour');
      updateConfig('auto_mode', !enabled); // Revert
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Auto Mode Toggle */}
      <div className="flex items-center justify-between p-3 bg-[#1A1F2C] rounded-lg border border-[#D4AF37]/30">
        <div className="flex items-center gap-2">
          <Zap className={`h-5 w-5 ${config.auto_mode ? 'text-[#D4AF37]' : 'text-[#9CA3AF]'}`} />
          <div>
            <div className="text-sm font-medium">Mode Automatique</div>
            <div className="text-xs text-muted-foreground">
              Exécute les décisions bots à chaque changement de phase
            </div>
          </div>
        </div>
        <Switch
          checked={config.auto_mode}
          onCheckedChange={handleAutoModeToggle}
          disabled={saving}
        />
      </div>

      {autoExecuting && (
        <div className="flex items-center gap-2 text-sm text-[#D4AF37] animate-pulse">
          <Loader2 className="h-4 w-4 animate-spin" />
          Exécution automatique en cours...
        </div>
      )}

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
