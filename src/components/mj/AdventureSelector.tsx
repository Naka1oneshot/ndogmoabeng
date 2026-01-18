import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ForestButton } from '@/components/ui/ForestButton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Map, Gamepad2, Plus, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

interface Adventure {
  id: string;
  name: string;
  description: string | null;
  steps: AdventureStep[];
}

interface AdventureStep {
  id: string;
  step_index: number;
  game_type_code: string;
  token_policy: string;
}

interface GameType {
  code: string;
  name: string;
  description: string | null;
}

interface AdventureSelectorProps {
  mode: 'SINGLE_GAME' | 'ADVENTURE';
  onModeChange: (mode: 'SINGLE_GAME' | 'ADVENTURE') => void;
  selectedAdventureId: string | null;
  onAdventureSelect: (adventureId: string | null) => void;
  selectedGameTypeCode: string | null;
  onGameTypeSelect: (code: string | null) => void;
}

export function AdventureSelector({
  mode,
  onModeChange,
  selectedAdventureId,
  onAdventureSelect,
  selectedGameTypeCode,
  onGameTypeSelect,
}: AdventureSelectorProps) {
  const [adventures, setAdventures] = useState<Adventure[]>([]);
  const [gameTypes, setGameTypes] = useState<GameType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateAdventure, setShowCreateAdventure] = useState(false);
  const [newAdventureName, setNewAdventureName] = useState('');
  const [newAdventureDesc, setNewAdventureDesc] = useState('');
  const [selectedSteps, setSelectedSteps] = useState<string[]>([]);
  const [creatingAdventure, setCreatingAdventure] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch active game types
      const { data: typesData } = await supabase
        .from('game_types')
        .select('code, name, description')
        .eq('is_active', true);

      setGameTypes(typesData || []);

      // Fetch active adventures with their steps
      const { data: adventuresData } = await supabase
        .from('adventures')
        .select('id, name, description')
        .eq('is_active', true);

      if (adventuresData) {
        const adventuresWithSteps: Adventure[] = [];
        for (const adv of adventuresData) {
          const { data: steps } = await supabase
            .from('adventure_steps')
            .select('id, step_index, game_type_code, token_policy')
            .eq('adventure_id', adv.id)
            .order('step_index', { ascending: true });

          adventuresWithSteps.push({
            ...adv,
            steps: steps || [],
          });
        }
        setAdventures(adventuresWithSteps);
      }
    } catch (error) {
      console.error('Error fetching adventures:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAdventure = async () => {
    if (!newAdventureName.trim()) {
      toast.error('Veuillez entrer un nom pour l\'aventure');
      return;
    }
    if (selectedSteps.length < 2) {
      toast.error('Une aventure doit contenir au moins 2 jeux');
      return;
    }

    // Check for duplicates
    const uniqueSteps = new Set(selectedSteps);
    if (uniqueSteps.size !== selectedSteps.length) {
      toast.error('Un type de jeu ne peut apparaître qu\'une fois dans une aventure');
      return;
    }

    setCreatingAdventure(true);
    try {
      // Create the adventure
      const { data: newAdventure, error: advError } = await supabase
        .from('adventures')
        .insert({
          name: newAdventureName.trim(),
          description: newAdventureDesc.trim() || null,
          is_active: true,
        })
        .select()
        .single();

      if (advError) throw advError;

      // Create the steps
      const stepsToInsert = selectedSteps.map((gameTypeCode, index) => ({
        adventure_id: newAdventure.id,
        step_index: index + 1,
        game_type_code: gameTypeCode,
        token_policy: index === 0 ? 'RESET_TO_DEFAULT' : 'INHERIT',
      }));

      const { error: stepsError } = await supabase
        .from('adventure_steps')
        .insert(stepsToInsert);

      if (stepsError) throw stepsError;

      toast.success('Aventure créée !');
      setNewAdventureName('');
      setNewAdventureDesc('');
      setSelectedSteps([]);
      setShowCreateAdventure(false);
      onAdventureSelect(newAdventure.id);
      fetchData();
    } catch (error) {
      console.error('Error creating adventure:', error);
      toast.error('Erreur lors de la création de l\'aventure');
    } finally {
      setCreatingAdventure(false);
    }
  };

  const addStepToAdventure = (gameTypeCode: string) => {
    if (selectedSteps.includes(gameTypeCode)) {
      toast.error('Ce type de jeu est déjà dans l\'aventure');
      return;
    }
    setSelectedSteps(prev => [...prev, gameTypeCode]);
  };

  const removeStepFromAdventure = (index: number) => {
    setSelectedSteps(prev => prev.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Mode Selection */}
      <div className="space-y-2">
        <Label>Mode de jeu</Label>
        <RadioGroup
          value={mode}
          onValueChange={(val) => {
            onModeChange(val as 'SINGLE_GAME' | 'ADVENTURE');
            if (val === 'SINGLE_GAME') {
              onAdventureSelect(null);
            } else {
              onGameTypeSelect(null);
            }
          }}
          className="grid grid-cols-2 gap-3"
        >
          <div className="relative">
            <RadioGroupItem value="SINGLE_GAME" id="mode-single" className="peer sr-only" />
            <label
              htmlFor="mode-single"
              className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all
                         border-border hover:border-primary/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10"
            >
              <Gamepad2 className="h-8 w-8 text-primary" />
              <span className="font-medium">Partie unique</span>
              <span className="text-xs text-muted-foreground text-center">Un seul type de jeu</span>
            </label>
          </div>
          <div className="relative">
            <RadioGroupItem value="ADVENTURE" id="mode-adventure" className="peer sr-only" />
            <label
              htmlFor="mode-adventure"
              className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all
                         border-border hover:border-primary/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10"
            >
              <Map className="h-8 w-8 text-amber-500" />
              <span className="font-medium">Aventure</span>
              <span className="text-xs text-muted-foreground text-center">Plusieurs jeux enchaînés</span>
            </label>
          </div>
        </RadioGroup>
      </div>

      {/* Single Game Mode - Game Type Selection */}
      {mode === 'SINGLE_GAME' && (
        <div className="space-y-2">
          <Label>Type de jeu</Label>
          <div className="grid gap-2">
            {gameTypes.map((type) => (
              <div
                key={type.code}
                onClick={() => onGameTypeSelect(type.code)}
                className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedGameTypeCode === type.code
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="font-medium">{type.name}</div>
                {type.description && (
                  <div className="text-sm text-muted-foreground">{type.description}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Adventure Mode - Adventure Selection */}
      {mode === 'ADVENTURE' && !showCreateAdventure && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Sélectionner une aventure</Label>
            <ForestButton
              variant="ghost"
              size="sm"
              onClick={() => setShowCreateAdventure(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Créer
            </ForestButton>
          </div>
          
          {adventures.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground border border-dashed rounded-lg">
              Aucune aventure disponible. Créez-en une !
            </div>
          ) : (
            <div className="grid gap-2">
              {adventures.map((adventure) => (
                <div
                  key={adventure.id}
                  onClick={() => onAdventureSelect(adventure.id)}
                  className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedAdventureId === adventure.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="font-medium">{adventure.name}</div>
                  {adventure.description && (
                    <div className="text-sm text-muted-foreground mb-2">{adventure.description}</div>
                  )}
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {adventure.steps.map((step, index) => (
                      <span key={step.id} className="flex items-center">
                        <span className="px-2 py-0.5 bg-secondary rounded">{step.game_type_code}</span>
                        {index < adventure.steps.length - 1 && (
                          <ChevronRight className="h-3 w-3 mx-1" />
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Adventure Form */}
      {mode === 'ADVENTURE' && showCreateAdventure && (
        <div className="space-y-4 p-4 border border-dashed rounded-lg bg-secondary/20">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">Nouvelle aventure</Label>
            <ForestButton
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowCreateAdventure(false);
                setSelectedSteps([]);
              }}
            >
              Annuler
            </ForestButton>
          </div>

          <div className="space-y-2">
            <Label htmlFor="adventureName">Nom de l'aventure</Label>
            <Input
              id="adventureName"
              placeholder="Ex: La Quête des Héros"
              value={newAdventureName}
              onChange={(e) => setNewAdventureName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="adventureDesc">Description (optionnelle)</Label>
            <Input
              id="adventureDesc"
              placeholder="Une aventure épique..."
              value={newAdventureDesc}
              onChange={(e) => setNewAdventureDesc(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Étapes de l'aventure</Label>
            {selectedSteps.length > 0 && (
              <div className="flex flex-wrap gap-2 p-2 bg-secondary/50 rounded-lg">
                {selectedSteps.map((code, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-1 px-2 py-1 bg-primary/20 rounded text-sm"
                  >
                    <span className="text-xs text-muted-foreground">#{index + 1}</span>
                    <span>{code}</span>
                    <button
                      type="button"
                      onClick={() => removeStepFromAdventure(index)}
                      className="ml-1 text-destructive hover:text-destructive/80"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            <div className="text-sm text-muted-foreground mb-2">
              Ajoutez les jeux dans l'ordre souhaité :
            </div>
            <div className="flex flex-wrap gap-2">
              {gameTypes
                .filter(type => !selectedSteps.includes(type.code))
                .map((type) => (
                  <ForestButton
                    key={type.code}
                    variant="outline"
                    size="sm"
                    onClick={() => addStepToAdventure(type.code)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    {type.name}
                  </ForestButton>
                ))}
            </div>
          </div>

          <ForestButton
            className="w-full"
            onClick={handleCreateAdventure}
            disabled={creatingAdventure || selectedSteps.length < 2}
          >
            {creatingAdventure ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1" />
                Créer l'aventure ({selectedSteps.length} jeux)
              </>
            )}
          </ForestButton>
        </div>
      )}
    </div>
  );
}
