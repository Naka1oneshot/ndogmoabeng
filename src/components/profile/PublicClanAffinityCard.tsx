import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { CLAN_MAP, CLAN_IMAGES, CLAN_CODES, type ClanCode } from '@/components/clanAffinityQuiz/quizData';
import { CLANS_DATA } from '@/data/ndogmoabengData';

interface PublicClanAffinityCardProps {
  clanAffinityId: string | null;
  clanAffinityScores: Record<string, number> | null;
  clanAffinityCompletedAt: string | null;
}

export function PublicClanAffinityCard({ 
  clanAffinityId, 
  clanAffinityScores, 
  clanAffinityCompletedAt 
}: PublicClanAffinityCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Quiz not completed
  if (!clanAffinityCompletedAt || !clanAffinityId) {
    return (
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="py-6 text-center text-muted-foreground">
          <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Test d'affinité non réalisé</p>
        </CardContent>
      </Card>
    );
  }

  // Find the winning clan details
  const winnerCode = CLAN_CODES.find(code => CLAN_MAP[code].id === clanAffinityId);
  const clanInfo = winnerCode ? CLAN_MAP[winnerCode] : null;
  const clanData = CLANS_DATA.find(c => c.id === clanAffinityId);
  const clanImage = winnerCode ? CLAN_IMAGES[winnerCode] : null;

  // Sort scores
  const sortedScores = clanAffinityScores 
    ? Object.entries(clanAffinityScores)
        .sort(([, a], [, b]) => (b as number) - (a as number))
    : [];

  return (
    <Card className={`overflow-hidden border-${clanInfo?.color}-500/30`}>
      <CardHeader className={`pb-3 bg-gradient-to-r ${clanInfo?.bgGradient || ''}`}>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className={`h-4 w-4 text-${clanInfo?.color}-500`} />
          Affinité de clan
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {/* Winner display */}
        <div className="flex items-center gap-4 mb-4">
          {clanImage && (
            <img 
              src={clanImage} 
              alt={clanData?.name}
              className="w-16 h-16 object-contain"
            />
          )}
          <div>
            <h3 className={`text-lg font-bold text-${clanInfo?.color}-500`}>
              {clanData?.name}
            </h3>
            <p className="text-xs text-muted-foreground">
              {clanInfo?.interpretation}
            </p>
          </div>
        </div>

        {/* Scores collapsible */}
        {sortedScores.length > 0 && (
          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full justify-center">
              <span>Voir les scores</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {sortedScores.map(([code, score], idx) => {
                  const info = CLAN_MAP[code as ClanCode];
                  if (!info) return null;
                  const isWinner = info.id === clanAffinityId;
                  return (
                    <div 
                      key={code}
                      className={`flex items-center justify-between p-2 rounded text-sm ${
                        isWinner 
                          ? `bg-${info.color}-500/20 border border-${info.color}-500/30` 
                          : 'bg-muted/50'
                      }`}
                    >
                      <span className={isWinner ? `font-medium text-${info.color}-500` : 'text-muted-foreground'}>
                        {info.label}
                      </span>
                      <Badge variant={isWinner ? 'default' : 'secondary'} className="text-xs">
                        {score as number}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
