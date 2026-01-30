import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ChevronRight, RotateCcw, ListChecks } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { ClanAffinityQuiz } from '@/components/clanAffinityQuiz/ClanAffinityQuiz';
import {
  CLAN_MAP,
  CLAN_CODES,
  CLAN_IMAGES,
  CLAN_UI_COLORS,
  type ClanCode,
} from '@/components/clanAffinityQuiz/quizData';

interface ClanAffinitySectionProps {
  clanAffinityId: string | null;
  clanAffinityScores: Record<ClanCode, number> | null;
  clanAffinityDetails: any | null;
  clanAffinityCompletedAt: string | null;
  onRefresh: () => void;
}

export function ClanAffinitySection({
  clanAffinityId,
  clanAffinityScores,
  clanAffinityDetails,
  clanAffinityCompletedAt,
  onRefresh,
}: ClanAffinitySectionProps) {
  const [showQuiz, setShowQuiz] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const hasCompleted = !!clanAffinityCompletedAt;

  // Find the clan code from the ID
  const clanCode = hasCompleted && clanAffinityId
    ? (Object.entries(CLAN_MAP).find(([_, info]) => info.id === clanAffinityId)?.[0] as ClanCode | undefined)
    : null;

  const clanInfo = clanCode ? CLAN_MAP[clanCode] : null;
  const clanColors = clanCode ? CLAN_UI_COLORS[clanCode] : null;

  const handleOpenQuiz = () => {
    setShowQuiz(true);
  };

  const handleCloseQuiz = () => {
    setShowQuiz(false);
  };

  const handleQuizCompleted = () => {
    setShowQuiz(false);
    onRefresh();
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Affinité de clan
          </CardTitle>
          <CardDescription>
            Découvre quel clan te correspond le mieux
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!hasCompleted ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-2">Test d'affinité aux clans</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Réponds à 10 questions pour découvrir quel clan te représente le mieux.
                </p>
              </div>
              <Button onClick={handleOpenQuiz}>
                <Sparkles className="w-4 h-4 mr-2" />
                Faire le test
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Result display */}
              <div className={cn("p-4 rounded-lg flex items-center gap-4", clanColors?.secondary)}>
                {clanCode && (
                  <img
                    src={CLAN_IMAGES[clanCode]}
                    alt={clanInfo?.label}
                    className="w-16 h-16 object-contain"
                  />
                )}
                <div className="flex-1">
                  <div className="text-sm text-muted-foreground">Ton clan dominant</div>
                  <div className={cn("text-xl font-bold", clanColors?.text)}>
                    {clanInfo?.label || 'Inconnu'}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {clanInfo?.interpretation}
                  </p>
                </div>
              </div>

              {/* Scores */}
              {clanAffinityScores && (
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                  {CLAN_CODES.map((code) => (
                    <div
                      key={code}
                      className={cn(
                        "p-2 rounded text-center",
                        code === clanCode ? CLAN_UI_COLORS[code].secondary : "bg-muted/30"
                      )}
                    >
                      <div className={cn("font-bold", code === clanCode && CLAN_UI_COLORS[code].text)}>
                        {clanAffinityScores[code] || 0}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {CLAN_MAP[code].label}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Details collapsible */}
              {clanAffinityDetails?.answers && (
                <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full justify-between">
                      <span className="flex items-center gap-2">
                        <ListChecks className="w-4 h-4" />
                        Détail des réponses
                      </span>
                      <ChevronRight className={cn("w-4 h-4 transition-transform", detailsOpen && "rotate-90")} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 space-y-1 max-h-48 overflow-auto p-2 bg-muted/30 rounded-lg">
                      {clanAffinityDetails.answers.map((a: any, idx: number) => (
                        <div key={a.questionId} className="text-xs p-1.5 bg-background/50 rounded">
                          <span className="text-muted-foreground">Q{idx + 1}:</span>{' '}
                          <span>{a.pickedText}</span>{' '}
                          <span className={CLAN_UI_COLORS[a.pickedClanCode as ClanCode]?.text}>
                            → {CLAN_MAP[a.pickedClanCode as ClanCode]?.label}
                          </span>
                        </div>
                      ))}
                      {clanAffinityDetails.tieBreakUsed?.map((a: any, idx: number) => (
                        <div key={`tb-${idx}`} className="text-xs p-1.5 bg-amber-500/10 rounded border border-amber-500/20">
                          <span className="text-amber-600 dark:text-amber-400">Départage {idx + 1}:</span>{' '}
                          <span>{a.pickedText}</span>{' '}
                          <span className={CLAN_UI_COLORS[a.pickedClanCode as ClanCode]?.text}>
                            → {CLAN_MAP[a.pickedClanCode as ClanCode]?.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Redo button */}
              <Button variant="outline" size="sm" onClick={handleOpenQuiz} className="w-full">
                <RotateCcw className="w-4 h-4 mr-2" />
                Refaire le test
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quiz overlay */}
      <AnimatePresence>
        {showQuiz && (
          <ClanAffinityQuiz
            mode="profile"
            onClose={handleCloseQuiz}
            onCompleted={handleQuizCompleted}
            existingSeed={clanAffinityDetails?.seed}
            isRetake={hasCompleted}
          />
        )}
      </AnimatePresence>
    </>
  );
}
