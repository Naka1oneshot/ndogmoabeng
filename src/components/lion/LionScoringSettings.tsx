import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Settings2 } from 'lucide-react';

interface LionScoringSettingsProps {
  gameStateId: string;
  scoringEqualCorrect: number;
  scoringEqualWrong: number;
  onUpdate?: () => void;
  disabled?: boolean;
}

export function LionScoringSettings({
  gameStateId,
  scoringEqualCorrect,
  scoringEqualWrong,
  onUpdate,
  disabled = false
}: LionScoringSettingsProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [equalCorrect, setEqualCorrect] = useState(scoringEqualCorrect);
  const [equalWrong, setEqualWrong] = useState(scoringEqualWrong);

  useEffect(() => {
    setEqualCorrect(scoringEqualCorrect);
    setEqualWrong(scoringEqualWrong);
  }, [scoringEqualCorrect, scoringEqualWrong]);

  const hasChanges = equalCorrect !== scoringEqualCorrect || equalWrong !== scoringEqualWrong;

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('lion_game_state')
        .update({
          scoring_equal_correct: equalCorrect,
          scoring_equal_wrong: equalWrong
        })
        .eq('id', gameStateId);

      if (error) throw error;

      toast({
        title: 'Paramètres sauvegardés',
        description: 'Les règles de scoring ont été mises à jour.',
      });

      onUpdate?.();
    } catch (err) {
      console.error('Save scoring error:', err);
      toast({
        title: 'Erreur',
        description: 'Impossible de sauvegarder les paramètres',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="bg-amber-900/40 border-amber-700">
      <CardHeader className="pb-2">
        <CardTitle className="text-amber-300 flex items-center gap-2">
          <Settings2 className="h-5 w-5" />
          Paramètres de scoring
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4">
          {/* Equal Correct */}
          <div className="space-y-2">
            <Label htmlFor="equal-correct" className="text-amber-200 text-sm">
              Égalité devinée correctement (ÉGAL)
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="equal-correct"
                type="number"
                min={0}
                max={100}
                value={equalCorrect}
                onChange={(e) => setEqualCorrect(Math.max(0, parseInt(e.target.value) || 0))}
                disabled={disabled}
                className="w-24 bg-amber-950/50 border-amber-700 text-amber-100"
              />
              <span className="text-amber-400 text-sm">PVic au devineur</span>
            </div>
            <p className="text-amber-500 text-xs">
              Points gagnés quand A = D et le devineur choisit "ÉGAL"
            </p>
          </div>

          {/* Equal Wrong */}
          <div className="space-y-2">
            <Label htmlFor="equal-wrong" className="text-amber-200 text-sm">
              Égalité non devinée
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="equal-wrong"
                type="number"
                min={0}
                max={100}
                value={equalWrong}
                onChange={(e) => setEqualWrong(Math.max(0, parseInt(e.target.value) || 0))}
                disabled={disabled}
                className="w-24 bg-amber-950/50 border-amber-700 text-amber-100"
              />
              <span className="text-amber-400 text-sm">PVic au joueur actif</span>
            </div>
            <p className="text-amber-500 text-xs">
              Points gagnés par l'actif quand A = D mais le devineur n'a pas choisi "ÉGAL"
            </p>
          </div>

          {/* Info about diff scoring */}
          <div className="bg-amber-950/50 rounded-lg p-3 mt-2">
            <p className="text-amber-300 text-sm font-medium mb-1">Règle standard (cartes différentes)</p>
            <p className="text-amber-400 text-xs">
              Quand A ≠ D : le gagnant reçoit |A - D| PVic (la différence entre les cartes)
            </p>
          </div>
        </div>

        {hasChanges && (
          <Button
            onClick={handleSave}
            disabled={saving || disabled}
            className="w-full lion-btn-primary"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Sauvegarder
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
