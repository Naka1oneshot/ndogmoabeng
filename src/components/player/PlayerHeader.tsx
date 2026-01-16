import { Link } from 'react-router-dom';
import { User, Coins, Lock } from 'lucide-react';
import logoNdogmoabeng from '@/assets/logo-ndogmoabeng.png';

interface Game {
  name: string;
  join_code: string;
  manche_active: number;
  phase: string;
  phase_locked: boolean;
}

interface Player {
  displayName: string;
  playerNumber: number;
  jetons: number;
}

interface PlayerHeaderProps {
  game: Game;
  player: Player;
}

const phaseLabels: Record<string, string> = {
  PHASE1_MISES: 'Phase 1 — Mises',
  PHASE2_POSITIONS: 'Phase 2 — Positions',
  PHASE3_SHOP: 'Phase 3 — Boutique',
  PHASE4_COMBAT: 'Phase 4 — Combat',
  RESOLUTION: 'Résolution',
};

export function PlayerHeader({ game, player }: PlayerHeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border px-4 py-3">
      <div className="max-w-6xl mx-auto">
        {/* Top row: Logo + Session info */}
        <div className="flex items-center justify-between mb-2">
          <Link to="/" className="flex items-center gap-2">
            <img src={logoNdogmoabeng} alt="Ndogmoabeng" className="h-8 w-8 object-contain" />
            <span className="font-display text-sm hidden sm:inline">{game.name}</span>
          </Link>
          
          <div className="flex items-center gap-3 text-sm">
            <span className="font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">
              {game.join_code}
            </span>
            <span className="text-muted-foreground">
              Manche <strong className="text-forest-gold">{game.manche_active}</strong>
            </span>
          </div>
        </div>

        {/* Bottom row: Phase + Player info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {phaseLabels[game.phase] || game.phase}
            </span>
            {game.phase_locked && (
              <span className="flex items-center gap-1 text-xs text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">
                <Lock className="h-3 w-3" />
                Verrouillée
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Coins className="h-4 w-4 text-yellow-500" />
              <span className="font-bold text-sm">{player.jetons}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-primary/10 px-2 py-1 rounded">
              <User className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">#{player.playerNumber}</span>
              <span className="text-xs text-muted-foreground hidden sm:inline">{player.displayName}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}