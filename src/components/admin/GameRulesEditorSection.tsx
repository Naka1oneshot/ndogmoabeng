import { useState } from 'react';
import { BookOpen, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useGameRulesContent } from '@/hooks/useGameRulesContent';
import { GameRulesSectionEditor } from './GameRulesSectionEditor';
import { GameRulesCreateSection } from './GameRulesCreateSection';
import { Loader2 } from 'lucide-react';

const GAME_CODES = [
  { code: 'RIVIERES', name: 'Rivières', icon: '🌊' },
  { code: 'FORET', name: 'Forêt', icon: '🌲' },
  { code: 'INFECTION', name: 'Infection', icon: '🦠' },
  { code: 'SHERIFF', name: 'Sheriff', icon: '🤠' },
  { code: 'LION', name: 'Le CŒUR du Lion', icon: '🦁' },
];

export function GameRulesEditorSection() {
  const [selectedGame, setSelectedGame] = useState('RIVIERES');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { sections, loading, refetch } = useGameRulesContent(selectedGame);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          Éditeur de règles des jeux
        </CardTitle>
        <CardDescription>
          Modifiez le contenu des overlays de règles. Les changements sont appliqués immédiatement partout.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={selectedGame} onValueChange={setSelectedGame}>
          <TabsList className="grid grid-cols-5 w-full">
            {GAME_CODES.map((game) => (
              <TabsTrigger key={game.code} value={game.code} className="text-xs md:text-sm">
                <span className="mr-1">{game.icon}</span>
                <span className="hidden md:inline">{game.name}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {GAME_CODES.map((game) => (
            <TabsContent key={game.code} value={game.code} className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  {game.icon} Règles de {game.name}
                </h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsCreateOpen(!isCreateOpen)}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Nouvelle section
                </Button>
              </div>

              <Collapsible open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <CollapsibleContent>
                  <GameRulesCreateSection
                    gameCode={game.code}
                    existingSections={sections}
                    onCreated={() => {
                      setIsCreateOpen(false);
                      refetch();
                    }}
                    onCancel={() => setIsCreateOpen(false)}
                  />
                </CollapsibleContent>
              </Collapsible>

              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : sections.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Aucune section de règles configurée pour ce jeu.</p>
                  <p className="text-sm mt-2">
                    Cliquez sur "Nouvelle section" pour commencer à créer le contenu.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sections.map((section) => (
                    <GameRulesSectionEditor
                      key={section.id}
                      section={section}
                      onUpdate={refetch}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
