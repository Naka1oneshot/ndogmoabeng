import { Zap, ZapOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface RivieresAutoModeToggleProps {
  isAutoMode: boolean;
  currentStep: string | null;
  isLoading?: boolean;
  onToggle: () => void;
}

const STEP_LABELS: Record<string, string> = {
  'ENABLED': 'Activé',
  'DANGER_SET': 'Danger défini',
  'BOTS_VALIDATED': 'Bots validés',
  'COUNTDOWN_STARTED': 'Compte à rebours',
  'LOCKING': 'Verrouillage...',
  'RESOLVING': 'Résolution...',
  'LEVEL_COMPLETE': 'Niveau terminé',
};

export function RivieresAutoModeToggle({
  isAutoMode,
  currentStep,
  isLoading,
  onToggle,
}: RivieresAutoModeToggleProps) {
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
                  ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white border-0' 
                  : 'border-[#D4AF37]/50 text-[#D4AF37] hover:bg-[#D4AF37]/10'
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
                className="bg-amber-900/30 border-amber-500/50 text-amber-300 text-xs animate-pulse"
              >
                {stepLabel}
              </Badge>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-sm">
            {isAutoMode 
              ? 'Mode automatique activé : danger auto, countdown 15s après majorité, résolution auto'
              : 'Activer le mode automatique pour enchaîner les actions MJ'
            }
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
