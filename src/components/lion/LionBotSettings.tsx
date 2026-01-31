import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Bot, Loader2, Play, FastForward, Square } from 'lucide-react';

interface LionBotSettingsProps {
  gameStateId: string;
  sessionGameId: string;
  botEnabled: boolean;
  botActiveStrategy: string;
  botGuessStrategy: string;
  botDelayMs: number;
  currentTurnIndex: number;
  gameStatus: string;
  bothPlayersAreBots: boolean;
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
  currentTurnIndex,
  gameStatus,
  bothPlayersAreBots,
  onUpdate,
  disabled = false
}: LionBotSettingsProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const stopSimulationRef = useRef(false);

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

  const handleSimulateAll = async () => {
    if (!bothPlayersAreBots) return;

    setSimulating(true);
    stopSimulationRef.current = false;

    toast({
      title: '🤖 Simulation démarrée',
      description: 'Exécution automatique jusqu\'au tour 20...',
    });

    try {
      let continueSimulation = true;
      let loopCount = 0;
      const maxLoops = 100; // Safety limit

      while (continueSimulation && loopCount < maxLoops) {
        if (stopSimulationRef.current) {
          toast({
            title: '⏹️ Simulation arrêtée',
            description: `Arrêt manuel au tour en cours`,
          });
          break;
        }

        // Fetch current state
        const { data: currentState } = await supabase
          .from('lion_game_state')
          .select('status, turn_index')
          .eq('id', gameStateId)
          .single();

        if (!currentState) break;

        // Stop conditions: game finished or turn > 20
        if (currentState.status === 'FINISHED' || currentState.turn_index > 20) {
          continueSimulation = false;
          toast({
            title: '✅ Simulation terminée',
            description: currentState.status === 'FINISHED' 
              ? 'La partie est terminée !' 
              : `Arrêt au tour ${currentState.turn_index}`,
          });
          break;
        }

        // Execute bot decisions
        const botResponse = await supabase.functions.invoke('lion-bot-decisions', {
          body: { session_game_id: sessionGameId }
        });

        if (botResponse.error) throw botResponse.error;

        // Small delay to allow DB updates
        await new Promise(resolve => setTimeout(resolve, 200));

        // Check if turn needs resolution
        const { data: turnData } = await supabase
          .from('lion_turns')
          .select('active_locked, guess_locked, resolved')
          .eq('session_game_id', sessionGameId)
          .eq('turn_index', currentState.turn_index)
          .maybeSingle();

        if (turnData && turnData.active_locked && turnData.guess_locked && !turnData.resolved) {
          // Resolve turn
          await supabase.functions.invoke('lion-resolve-turn', {
            body: { session_game_id: sessionGameId }
          });
          await new Promise(resolve => setTimeout(resolve, 200));
        }

        // Check if we need to advance to next turn
        const { data: updatedTurn } = await supabase
          .from('lion_turns')
          .select('resolved')
          .eq('session_game_id', sessionGameId)
          .eq('turn_index', currentState.turn_index)
          .maybeSingle();

        if (updatedTurn?.resolved) {
          await supabase.functions.invoke('lion-next-turn', {
            body: { session_game_id: sessionGameId }
          });
          await new Promise(resolve => setTimeout(resolve, 200));
        }

        loopCount++;
        onUpdate();
      }
    } catch (err) {
      console.error('Simulation error:', err);
      toast({
        title: 'Erreur',
        description: 'Erreur pendant la simulation',
        variant: 'destructive'
      });
    } finally {
      setSimulating(false);
      stopSimulationRef.current = false;
      onUpdate();
    }
  };

  const handleStopSimulation = () => {
    stopSimulationRef.current = true;
  };

  const canSimulate = bothPlayersAreBots && botEnabled && gameStatus !== 'FINISHED' && currentTurnIndex <= 20;

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
              disabled={triggering || simulating}
              className="w-full lion-btn-primary"
            >
              {triggering ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Déclencher les bots maintenant
            </Button>

            {/* Simulate All - Only for 2 bots */}
            {bothPlayersAreBots && (
              <div className="pt-2 border-t border-amber-700/50">
                <p className="text-amber-400 text-xs mb-2">
                  Les 2 joueurs sont des bots - Simulation rapide disponible
                </p>
                {simulating ? (
                  <Button
                    onClick={handleStopSimulation}
                    variant="destructive"
                    className="w-full"
                  >
                    <Square className="h-4 w-4 mr-2" />
                    Arrêter la simulation
                  </Button>
                ) : (
                  <Button
                    onClick={handleSimulateAll}
                    disabled={!canSimulate}
                    variant="secondary"
                    className="w-full bg-amber-700 hover:bg-amber-600 text-amber-100"
                  >
                    <FastForward className="h-4 w-4 mr-2" />
                    Simuler tous les tours (→ T20)
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
