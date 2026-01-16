import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type GameStatus = 'LOBBY' | 'IN_GAME' | 'ENDED';

interface GameStatusBadgeProps {
  status: GameStatus;
  className?: string;
}

const statusConfig: Record<GameStatus, { label: string; className: string }> = {
  LOBBY: {
    label: 'En attente',
    className: 'bg-forest-glow/20 text-forest-glow border-forest-glow/30',
  },
  IN_GAME: {
    label: 'En cours',
    className: 'bg-forest-gold/20 text-forest-gold border-forest-gold/30',
  },
  ENDED: {
    label: 'Terminée',
    className: 'bg-muted text-muted-foreground border-muted',
  },
};

export function GameStatusBadge({ status, className }: GameStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge 
      variant="outline" 
      className={cn(
        'px-3 py-1 font-medium animate-pulse-glow',
        config.className,
        className
      )}
    >
      {config.label}
    </Badge>
  );
}
