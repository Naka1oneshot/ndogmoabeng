import { Zap, ZapOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ForetAutoModeToggleProps {
  isAutoMode: boolean;
  currentStep: string | null;
  isLoading?: boolean;
  onToggle: () => void;
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
};

export function ForetAutoModeToggle({
  isAutoMode,
  currentStep,
  isLoading,
  onToggle,
}: ForetAutoModeToggleProps) {
  const stepLabel = currentStep ? STEP_LABELS[currentStep] || currentStep : null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2">
            <Button
              variant={isAutoMode ? 'default' : 'outline'}
              size="sm"
              onClick={onToggle}
              disabled={isLoading}
              className={`
                gap-2 transition-all
                ${isAutoMode 
                  ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white border-0' 
                  : 'border-[#4a7c4a]/50 text-[#7cb87c] hover:bg-[#4a7c4a]/10'
                }
              `}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isAutoMode ? (
                <Zap className="h-4 w-4" />
              ) : (
                <ZapOff className="h-4 w-4" />
              )}
              {isAutoMode ? 'Auto ON' : 'Auto OFF'}
            </Button>

            {isAutoMode && stepLabel && (
              <Badge 
                variant="outline" 
                className="bg-green-900/30 border-green-500/50 text-green-300 text-xs animate-pulse"
              >
                {stepLabel}
              </Badge>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-sm">
            {isAutoMode 
              ? 'Mode automatique activé : countdown 30s après majorité, résolution auto des phases'
              : 'Activer le mode automatique pour enchaîner les phases MJ'
            }
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
