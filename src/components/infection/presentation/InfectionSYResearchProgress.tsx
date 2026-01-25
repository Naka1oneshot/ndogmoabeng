import { useMemo } from 'react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { FlaskConical, Sparkles, AlertCircle } from 'lucide-react';
import { INFECTION_COLORS, INFECTION_ROLE_LABELS } from '../InfectionTheme';

interface RoundState {
  id: string;
  manche: number;
  status: string;
  sy_success_count: number | null;
  sy_required_success: number | null;
}

interface InfectionSYResearchProgressProps {
  roundStates: RoundState[];
  isMobile: boolean;
}

export function InfectionSYResearchProgress({ 
  roundStates, 
  isMobile 
}: InfectionSYResearchProgressProps) {
  // Calculate total SY progress across all rounds
  const syProgress = useMemo(() => {
    let totalSuccesses = 0;
    let requiredSuccesses = 0;

    roundStates.forEach((round) => {
      if (round.sy_success_count !== null) {
        totalSuccesses += round.sy_success_count;
      }
      if (round.sy_required_success !== null) {
        // Use the first round's requirement as the target per round
        requiredSuccesses = round.sy_required_success;
      }
    });

    // The goal is to accumulate enough successes
    // Typically, SY needs X successes per round across all rounds
    // For now, show cumulative progress
    const resolvedRounds = roundStates.filter(r => r.status === 'RESOLVED').length;
    const targetTotal = requiredSuccesses * Math.max(resolvedRounds, 1);
    const percentage = targetTotal > 0 ? Math.min((totalSuccesses / targetTotal) * 100, 100) : 0;

    return {
      current: totalSuccesses,
      required: requiredSuccesses,
      resolvedRounds,
      percentage,
      isComplete: totalSuccesses >= targetTotal && resolvedRounds > 0
    };
  }, [roundStates]);

  const syRoleInfo = INFECTION_ROLE_LABELS['SY'];

  if (isMobile) {
    // Compact mobile version
    return (
      <div 
        className="rounded-lg p-2"
        style={{ backgroundColor: INFECTION_COLORS.bgCard, border: `1px solid ${INFECTION_COLORS.border}` }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4" style={{ color: syRoleInfo?.color || INFECTION_COLORS.accent }} />
            <span className="text-xs font-medium" style={{ color: INFECTION_COLORS.textPrimary }}>
              Recherches SY
            </span>
          </div>
          
          <div className="flex items-center gap-2 flex-1 max-w-[120px]">
            <Progress 
              value={syProgress.percentage} 
              className="h-2 flex-1"
              style={{ 
                backgroundColor: INFECTION_COLORS.bgSecondary,
              }}
            />
          </div>

          <Badge 
            className="text-[10px]"
            style={{ 
              backgroundColor: syProgress.isComplete ? INFECTION_COLORS.success : syRoleInfo?.color || INFECTION_COLORS.accent,
              color: INFECTION_COLORS.bgPrimary
            }}
          >
            {syProgress.current}/{syProgress.required * Math.max(syProgress.resolvedRounds, 1)}
          </Badge>
        </div>
      </div>
    );
  }

  // Desktop version
  return (
    <div 
      className="rounded-lg p-4"
      style={{ backgroundColor: INFECTION_COLORS.bgCard, border: `1px solid ${INFECTION_COLORS.border}` }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div 
            className="p-2 rounded-lg"
            style={{ backgroundColor: `${syRoleInfo?.color || INFECTION_COLORS.accent}20` }}
          >
            <FlaskConical className="h-5 w-5" style={{ color: syRoleInfo?.color || INFECTION_COLORS.accent }} />
          </div>
          <div>
            <h3 className="font-bold" style={{ color: INFECTION_COLORS.textPrimary }}>
              Recherches {syRoleInfo?.short || 'SY'}
            </h3>
            <p className="text-xs" style={{ color: INFECTION_COLORS.textMuted }}>
              {syRoleInfo?.name || 'Syndics'} - Progression vers l'antidote
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {syProgress.isComplete ? (
            <Badge 
              className="text-sm flex items-center gap-1"
              style={{ 
                backgroundColor: INFECTION_COLORS.success,
                color: INFECTION_COLORS.bgPrimary
              }}
            >
              <Sparkles className="h-4 w-4" />
              Objectif atteint!
            </Badge>
          ) : (
            <Badge 
              className="text-sm flex items-center gap-1"
              style={{ 
                backgroundColor: syRoleInfo?.color || INFECTION_COLORS.accent,
                color: INFECTION_COLORS.bgPrimary
              }}
            >
              <AlertCircle className="h-4 w-4" />
              En cours...
            </Badge>
          )}
          
          <div className="text-right">
            <span className="font-bold text-lg" style={{ color: syRoleInfo?.color || INFECTION_COLORS.accent }}>
              {syProgress.current}
            </span>
            <span style={{ color: INFECTION_COLORS.textMuted }}>
              /{syProgress.required * Math.max(syProgress.resolvedRounds, 1)} succès
            </span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative">
        <div 
          className="h-3 rounded-full overflow-hidden"
          style={{ backgroundColor: INFECTION_COLORS.bgSecondary }}
        >
          <div 
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{ 
              width: `${syProgress.percentage}%`,
              backgroundColor: syProgress.isComplete ? INFECTION_COLORS.success : syRoleInfo?.color || INFECTION_COLORS.accent
            }}
          />
        </div>
        
        {/* Markers for each round requirement */}
        <div className="absolute top-0 left-0 right-0 h-3 flex">
          {Array.from({ length: Math.max(syProgress.resolvedRounds, 1) }).map((_, idx) => {
            const position = ((idx + 1) / Math.max(syProgress.resolvedRounds, 1)) * 100;
            return (
              <div
                key={idx}
                className="absolute top-0 bottom-0 w-0.5"
                style={{ 
                  left: `${position}%`,
                  backgroundColor: INFECTION_COLORS.bgPrimary,
                  opacity: 0.5
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Round breakdown */}
      <div className="mt-2 flex items-center gap-4 text-xs" style={{ color: INFECTION_COLORS.textMuted }}>
        <span>Objectif par manche: {syProgress.required} succès</span>
        <span>•</span>
        <span>Manches résolues: {syProgress.resolvedRounds}</span>
      </div>
    </div>
  );
}
