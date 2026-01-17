import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MancheSelectorProps {
  currentManche: number;
  selectedManche: number;
  onMancheChange: (manche: number) => void;
  className?: string;
}

export function MancheSelector({ 
  currentManche, 
  selectedManche, 
  onMancheChange,
  className 
}: MancheSelectorProps) {
  const isViewingHistory = selectedManche !== currentManche;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        disabled={selectedManche <= 1}
        onClick={() => onMancheChange(selectedManche - 1)}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <span className={`text-sm font-medium ${isViewingHistory ? 'text-amber-400' : ''}`}>
        Manche {selectedManche}
      </span>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        disabled={selectedManche >= currentManche}
        onClick={() => onMancheChange(selectedManche + 1)}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      {isViewingHistory && (
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs ml-1"
          onClick={() => onMancheChange(currentManche)}
        >
          <RotateCcw className="h-3 w-3 mr-1" />
          Manche actuelle
        </Button>
      )}
    </div>
  );
}
