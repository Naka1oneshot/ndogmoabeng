import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type GameStatus = 'LOBBY' | 'IN_GAME' | 'IN_ROUND' | 'RESOLVING_COMBAT' | 'RESOLVING_SHOP' | 'ENDED' | 'FINISHED';

interface GameStatusBadgeProps {
  status: GameStatus | string;
  className?: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  LOBBY: {
    label: 'En attente',
    className: 'bg-forest-glow/20 text-forest-glow border-forest-glow/30',
  },
  IN_GAME: {
    label: 'En cours',
    className: 'bg-forest-gold/20 text-forest-gold border-forest-gold/30',
  },
  IN_ROUND: {
    label: 'En manche',
    className: 'bg-forest-gold/20 text-forest-gold border-forest-gold/30',
  },
  RESOLVING_COMBAT: {
    label: 'Combat',
    className: 'bg-red-500/20 text-red-400 border-red-500/30',
  },
  RESOLVING_SHOP: {
    label: 'Boutique',
    className: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  },
  ENDED: {
    label: 'Terminée',
    className: 'bg-muted text-muted-foreground border-muted',
  },
  FINISHED: {
    label: 'Terminée',
    className: 'bg-muted text-muted-foreground border-muted',
  },
};

export function GameStatusBadge({ status, className }: GameStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.LOBBY;

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
