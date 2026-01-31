import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Bot, Loader2, Play } from 'lucide-react';

interface LionBotSettingsProps {
  gameStateId: string;
  sessionGameId: string;
  botEnabled: boolean;
  botActiveStrategy: string;
  botGuessStrategy: string;
  botDelayMs: number;
  onUpdate: () => void;
  disabled?: boolean;
}

export function LionBotSettings({
  gameStateId,
  sessionGameId,
  botEnabled,
  botActiveStrategy,
  botGuessStrategy,
  botDelayMs,
  onUpdate,
  disabled = false
}: LionBotSettingsProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [triggering, setTriggering] = useState(false);

  const handleUpdate = async (updates: Record<string, unknown>) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('lion_game_state')
        .update(updates)
        .eq('id', gameStateId);

      if (error) throw error;
      onUpdate();
    } catch (err) {
      console.error('Update bot settings error:', err);
      toast({
        title: 'Erreur',
        description: 'Impossible de mettre à jour les paramètres',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTriggerBot = async () => {
    setTriggering(true);
    try {
      const response = await supabase.functions.invoke('lion-bot-decisions', {
        body: { session_game_id: sessionGameId }
      });

      if (response.error) throw response.error;

      const data = response.data;
      const messages = [];
      if (data.activeBot) messages.push(data.activeBot);
      if (data.guesserBot) messages.push(data.guesserBot);

      toast({
        title: '🤖 Bots exécutés',
        description: messages.length > 0 ? messages.join(' | ') : 'Aucune action bot nécessaire',
      });

      onUpdate();
    } catch (err) {
      console.error('Trigger bot error:', err);
      toast({
        title: 'Erreur',
        description: 'Impossible d\'exécuter les bots',
        variant: 'destructive'
      });
    } finally {
      setTriggering(false);
    }
  };

  return (
    <Card className="bg-amber-900/40 border-amber-700">
      <CardHeader className="pb-2">
        <CardTitle className="text-amber-300 flex items-center gap-2">
          <Bot className="h-5 w-5" />
          Mode Bot
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Enable/Disable */}
        <div className="flex items-center justify-between">
          <Label htmlFor="bot-enabled" className="text-amber-200">
            Activer les bots
          </Label>
          <Switch
            id="bot-enabled"
            checked={botEnabled}
            onCheckedChange={(checked) => handleUpdate({ bot_enabled: checked })}
            disabled={disabled || saving}
          />
        </div>

        {botEnabled && (
          <>
            {/* Active Strategy */}
            <div className="space-y-2">
              <Label className="text-amber-200 text-sm">Stratégie joueur actif</Label>
              <Select
                value={botActiveStrategy}
                onValueChange={(value) => handleUpdate({ bot_active_strategy: value })}
                disabled={disabled || saving}
              >
                <SelectTrigger className="bg-amber-950 border-amber-700 text-amber-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="random">Aléatoire</SelectItem>
                  <SelectItem value="defensive">Défensif (proche du croupier)</SelectItem>
                  <SelectItem value="aggressive">Agressif (loin du croupier)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-amber-500 text-xs">
                Comment le bot choisit sa carte à jouer
              </p>
            </div>

            {/* Guess Strategy */}
            <div className="space-y-2">
              <Label className="text-amber-200 text-sm">Stratégie devineur</Label>
              <Select
                value={botGuessStrategy}
                onValueChange={(value) => handleUpdate({ bot_guess_strategy: value })}
                disabled={disabled || saving}
              >
                <SelectTrigger className="bg-amber-950 border-amber-700 text-amber-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="smart">Intelligent (analyse contexte)</SelectItem>
                  <SelectItem value="random">Aléatoire</SelectItem>
                  <SelectItem value="always_equal">Toujours Égal</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-amber-500 text-xs">
                Smart: analyse les cartes restantes de l'adversaire, évite les choix impossibles
              </p>
            </div>

            {/* Delay */}
            <div className="space-y-2">
              <Label className="text-amber-200 text-sm">
                Délai décision: {botDelayMs}ms
              </Label>
              <Slider
                value={[botDelayMs]}
                onValueChange={([value]) => handleUpdate({ bot_delay_ms: value })}
                min={500}
                max={5000}
                step={250}
                disabled={disabled || saving}
                className="py-2"
              />
              <p className="text-amber-500 text-xs">
                Temps avant que le bot prenne sa décision
              </p>
            </div>

            {/* Manual Trigger */}
            <Button
              onClick={handleTriggerBot}
              disabled={triggering}
              className="w-full lion-btn-primary"
            >
              {triggering ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Déclencher les bots maintenant
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
