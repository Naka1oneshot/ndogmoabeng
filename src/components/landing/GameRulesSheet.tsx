import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { BookOpen, Target, Users, Lightbulb, Trophy, Swords } from 'lucide-react';
import { GAME_RULES, type GameRules } from '@/data/gameRulesData';

interface GameRulesSheetProps {
  gameCode: string;
  children?: React.ReactNode;
}

export function GameRulesSheet({ gameCode, children }: GameRulesSheetProps) {
  const rules = GAME_RULES[gameCode];
  
  if (!rules) {
    return null;
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        {children || (
          <Button variant="outline" size="sm" className="gap-2">
            <BookOpen className="h-4 w-4" />
            Voir règles
          </Button>
        )}
      </SheetTrigger>
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-lg bg-background/95 backdrop-blur-md border-border"
      >
        <SheetHeader className="pb-4">
          <SheetTitle className="font-display text-xl text-primary flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            {rules.title}
          </SheetTitle>
        </SheetHeader>
        
        <ScrollArea className="h-[calc(100vh-8rem)] pr-4">
          <div className="space-y-6">
            {/* Objectif */}
            <section>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
                <Target className="h-4 w-4 text-primary" />
                Objectif
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {rules.objective}
              </p>
            </section>

            <Separator />

            {/* Mise en place */}
            <section>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
                <Users className="h-4 w-4 text-primary" />
                Mise en place
              </h3>
              <ul className="space-y-1.5">
                {rules.setup.map((step, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-primary font-medium">{i + 1}.</span>
                    {step}
                  </li>
                ))}
              </ul>
            </section>

            <Separator />

            {/* Phases de jeu */}
            <section>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
                <Swords className="h-4 w-4 text-primary" />
                Phases de jeu
              </h3>
              <div className="space-y-3">
                {rules.phases.map((phase, i) => (
                  <div key={i} className="bg-muted/30 rounded-lg p-3 border border-border/50">
                    <h4 className="text-sm font-medium text-foreground mb-1">
                      {phase.name}
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {phase.description}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* Rôles (si applicable) */}
            {rules.roles && rules.roles.length > 0 && (
              <>
                <Separator />
                <section>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
                    <Users className="h-4 w-4 text-primary" />
                    Rôles
                  </h3>
                  <div className="space-y-2">
                    {rules.roles.map((role, i) => (
                      <div key={i} className="bg-muted/20 rounded-lg p-2.5 border border-border/30">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-foreground">{role.name}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {role.team}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{role.ability}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}

            <Separator />

            {/* Conditions de victoire */}
            <section>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
                <Trophy className="h-4 w-4 text-primary" />
                Conditions de victoire
              </h3>
              <div className="space-y-2">
                {rules.winConditions.map((wc, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <Badge variant="secondary" className="text-[10px] shrink-0 mt-0.5">
                      {wc.team}
                    </Badge>
                    <p className="text-xs text-muted-foreground">{wc.condition}</p>
                  </div>
                ))}
              </div>
            </section>

            <Separator />

            {/* Conseils */}
            <section className="pb-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
                <Lightbulb className="h-4 w-4 text-primary" />
                Conseils
              </h3>
              <ul className="space-y-1.5">
                {rules.tips.map((tip, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                    <span className="text-primary">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
