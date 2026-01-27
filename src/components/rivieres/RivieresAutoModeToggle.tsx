import { Zap, ZapOff, Loader2, AlertCircle, RefreshCw, User, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface RivieresAutoModeToggleProps {
  isAutoMode: boolean;
  currentStep: string | null;
  isLoading?: boolean;
  onToggle: () => void;
  runnerStatus?: 'YOU' | 'OTHER' | 'NONE';
  lastError?: string | null;
  failCounts?: {
    setDanger: number;
    botDecisions: number;
    lock: number;
    resolve: number;
  };
  onResetFailCounters?: () => void;
}

const STEP_LABELS: Record<string, string> = {
  'ENABLED': 'Activé',
  'DANGER_SET': 'Danger défini',
  'BOTS_VALIDATED': 'Bots validés',
  'COUNTDOWN_STARTED': 'Compte à rebours',
  'LOCKING': 'Verrouillage...',
  'RESOLVING': 'Résolution...',
  'LEVEL_COMPLETE': 'Niveau terminé',
  'STOPPED_MAX_FAILURES': '⚠️ Arrêté (erreurs)',
  'STOPPED_ANIM_TIMEOUT': '⚠️ Arrêté (timeout)',
};

export function RivieresAutoModeToggle({
  isAutoMode,
  currentStep,
  isLoading,
  onToggle,
  runnerStatus = 'NONE',
  lastError,
  failCounts,
  onResetFailCounters,
}: RivieresAutoModeToggleProps) {
  const stepLabel = currentStep ? STEP_LABELS[currentStep] || currentStep : null;
  const totalFailures = failCounts 
    ? failCounts.setDanger + failCounts.botDecisions + failCounts.lock + failCounts.resolve 
    : 0;
  const hasError = lastError || currentStep?.startsWith('STOPPED_');

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2 flex-wrap">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isAutoMode ? 'default' : 'outline'}
              size="sm"
              onClick={onToggle}
              disabled={isLoading || (isAutoMode && runnerStatus === 'OTHER')}
              className={`
                gap-2 transition-all
                ${isAutoMode 
                  ? hasError
                    ? 'bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white border-0'
                    : 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white border-0' 
                  : 'border-[#D4AF37]/50 text-[#D4AF37] hover:bg-[#D4AF37]/10'
                }
              `}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : hasError ? (
                <AlertCircle className="h-4 w-4" />
              ) : isAutoMode ? (
                <Zap className="h-4 w-4" />
              ) : (
                <ZapOff className="h-4 w-4" />
              )}
              {isAutoMode ? 'Auto ON' : 'Auto OFF'}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p className="text-sm">
              {isAutoMode 
                ? runnerStatus === 'OTHER'
                  ? 'Mode auto piloté par un autre MJ'
                  : 'Mode automatique activé : danger auto, countdown 15s après majorité, résolution auto'
                : 'Activer le mode automatique pour enchaîner les actions MJ'
              }
            </p>
            {lastError && (
              <p className="text-xs text-red-400 mt-1">{lastError}</p>
            )}
          </TooltipContent>
        </Tooltip>

        {/* Runner status indicator */}
        {isAutoMode && (
          <Badge 
            variant="outline" 
            className={`text-xs ${
              runnerStatus === 'YOU' 
                ? 'bg-green-900/30 border-green-500/50 text-green-300'
                : runnerStatus === 'OTHER'
                ? 'bg-yellow-900/30 border-yellow-500/50 text-yellow-300'
                : 'bg-gray-900/30 border-gray-500/50 text-gray-300'
            }`}
          >
            {runnerStatus === 'YOU' ? <User className="h-3 w-3 mr-1" /> : <Users className="h-3 w-3 mr-1" />}
            {runnerStatus === 'YOU' ? 'Vous' : runnerStatus === 'OTHER' ? 'Autre MJ' : 'Aucun'}
          </Badge>
        )}

        {/* Current step */}
        {isAutoMode && stepLabel && !hasError && (
          <Badge 
            variant="outline" 
            className="bg-amber-900/30 border-amber-500/50 text-amber-300 text-xs animate-pulse"
          >
            {stepLabel}
          </Badge>
        )}

        {/* Error/failure indicator */}
        {hasError && (
          <Badge 
            variant="outline" 
            className="bg-red-900/30 border-red-500/50 text-red-300 text-xs"
          >
            {stepLabel || 'Erreur'}
          </Badge>
        )}

        {/* Fail counter + reset button */}
        {totalFailures > 0 && onResetFailCounters && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onResetFailCounters}
                className="h-7 px-2 text-xs text-amber-400 hover:text-amber-300"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Reset ({totalFailures})
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Réinitialiser les compteurs d'échecs</p>
              {failCounts && (
                <ul className="text-xs mt-1 text-gray-400">
                  {failCounts.setDanger > 0 && <li>Danger: {failCounts.setDanger}</li>}
                  {failCounts.botDecisions > 0 && <li>Bots: {failCounts.botDecisions}</li>}
                  {failCounts.lock > 0 && <li>Lock: {failCounts.lock}</li>}
                  {failCounts.resolve > 0 && <li>Resolve: {failCounts.resolve}</li>}
                </ul>
              )}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
