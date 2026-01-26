import { Film } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { CinematicSequence } from './CinematicSequenceContent';
import { getSequenceForGameType, getEndSequence } from './CinematicSequenceContent';

interface CinematicButtonProps {
  gameTypeCode: string | null;
  onBroadcast: (sequence: CinematicSequence[]) => void;
  showEndOption?: boolean;
  className?: string;
}

export function CinematicButton({ 
  gameTypeCode, 
  onBroadcast, 
  showEndOption = false,
  className = ''
}: CinematicButtonProps) {
  const sequence = getSequenceForGameType(gameTypeCode, true);
  
  const handleClick = () => {
    if (sequence.length > 0) {
      onBroadcast(sequence);
    }
  };
  
  const handleEndClick = () => {
    onBroadcast(getEndSequence());
  };

  if (sequence.length === 0 && !showEndOption) return null;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {sequence.length > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClick}
              className="bg-[#1A1510]/80 border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/20 hover:text-[#D4AF37]"
            >
              <Film className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">Cinématique</span>
              <span className="sm:hidden">Ciné</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Diffuser la cinématique à tous les joueurs</p>
          </TooltipContent>
        </Tooltip>
      )}
      
      {showEndOption && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={handleEndClick}
              className="bg-[#1A1510]/80 border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/20 hover:text-[#D4AF37]"
            >
              <Film className="w-4 h-4 mr-1.5" />
              <span>Fin</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Diffuser la cinématique de fin</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
