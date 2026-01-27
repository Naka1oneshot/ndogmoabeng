import { Zap, ZapOff, Loader2, AlertCircle, RefreshCw, User, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ForetAutoModeToggleProps {
  isAutoMode: boolean;
  currentStep: string | null;
  isLoading?: boolean;
  onToggle: () => void;
  runnerStatus?: 'YOU' | 'OTHER' | 'NONE';
  lastError?: string | null;
  failCounts?: {
    bets: number;
    positions: number;
    resolveCombat: number;
    shop: number;
  };
  onResetFailCounters?: () => void;
}

const STEP_LABELS: Record<string, string> = {
  'ENABLED': 'Activé',
  'COUNTDOWN_BETS': 'Countdown mises',
  'CLOSING_BETS': 'Clôture mises...',
  'BETS_CLOSED': 'Mises clôturées',
  'COUNTDOWN_COMBAT_SUBMIT': 'Countdown actions',
  'PUBLISHING_POSITIONS': 'Publication positions...',
  'POSITIONS_PUBLISHED': 'Positions publiées',
  'COUNTDOWN_COMBAT_POSITIONS_WAIT': 'Attente résolution',
  'RESOLVING_COMBAT': 'Résolution combat...',
  'COMBAT_RESOLVED': 'Combat résolu',
  'COUNTDOWN_SHOP': 'Countdown shop',
  'RESOLVING_SHOP': 'Résolution shop...',
  'SHOP_RESOLVED': 'Shop résolu',
  'ADVANCING_ROUND': 'Passage manche...',
  'ROUND_ADVANCED': 'Nouvelle manche',
  'STOPPED_MAX_FAILURES': '⚠️ Arrêté (erreurs)',
  'GENERATING_DEFAULT_BETS': 'Génération mises...',
  'GENERATING_DEFAULT_ACTIONS': 'Génération actions...',
  'GENERATING_DEFAULT_SHOP': 'Génération shop...',
};

export function ForetAutoModeToggle({
  isAutoMode,
  currentStep,
  isLoading,
  onToggle,
  runnerStatus = 'NONE',
  lastError,
  failCounts,
  onResetFailCounters,
}: ForetAutoModeToggleProps) {
  const stepLabel = currentStep ? STEP_LABELS[currentStep] || currentStep : null;
  const totalFailures = failCounts 
    ? failCounts.bets + failCounts.positions + failCounts.resolveCombat + failCounts.shop 
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
                    : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white border-0' 
                  : 'border-[#4a7c4a]/50 text-[#7cb87c] hover:bg-[#4a7c4a]/10'
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
                  : 'Mode automatique activé : countdown 30s après majorité, résolution auto des phases'
                : 'Activer le mode automatique pour enchaîner les phases MJ'
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
            className="bg-green-900/30 border-green-500/50 text-green-300 text-xs animate-pulse"
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
                className="h-7 px-2 text-xs text-green-400 hover:text-green-300"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Reset ({totalFailures})
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Réinitialiser les compteurs d'échecs</p>
              {failCounts && (
                <ul className="text-xs mt-1 text-gray-400">
                  {failCounts.bets > 0 && <li>Mises: {failCounts.bets}</li>}
                  {failCounts.positions > 0 && <li>Positions: {failCounts.positions}</li>}
                  {failCounts.resolveCombat > 0 && <li>Combat: {failCounts.resolveCombat}</li>}
                  {failCounts.shop > 0 && <li>Shop: {failCounts.shop}</li>}
                </ul>
              )}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
