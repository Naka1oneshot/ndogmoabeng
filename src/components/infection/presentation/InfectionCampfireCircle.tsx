import { useMemo } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skull } from 'lucide-react';
import { INFECTION_COLORS } from '../InfectionTheme';
import logoNdogmoabeng from '@/assets/logo-ndogmoabeng.png';
import { PlayerNameTooltip } from '@/components/mj/presentation/PlayerNameTooltip';

interface Player {
  id: string;
  display_name: string;
  player_number: number | null;
  is_alive: boolean | null;
  role_code: string | null;
  user_id: string | null;
}

interface InfectionCampfireCircleProps {
  players: Player[];
  avatarUrls: Map<string, string>;
  isMobile: boolean;
}

export function InfectionCampfireCircle({ players, avatarUrls, isMobile }: InfectionCampfireCircleProps) {
  // Calculate positions for players in a circle
  const playerPositions = useMemo(() => {
    const count = players.length;
    if (count === 0) return [];

    // Circle parameters - responsive sizing
    const baseRadius = isMobile ? 35 : 38; // percentage of container
    const radius = Math.max(baseRadius - count * 0.5, isMobile ? 28 : 32);

    return players.map((player, index) => {
      // Start from top (-90 degrees) and go clockwise
      const angle = ((index / count) * 360 - 90) * (Math.PI / 180);
      const x = 50 + radius * Math.cos(angle);
      const y = 50 + radius * Math.sin(angle);
      return { player, x, y, angle: (index / count) * 360 - 90 };
    });
  }, [players, isMobile]);

  const getAvatarUrl = (player: Player) => {
    if (player.user_id && avatarUrls.has(player.user_id)) {
      return avatarUrls.get(player.user_id);
    }
    return null;
  };

  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  // Avatar size based on player count and mobile
  const getAvatarSize = () => {
    const count = players.length;
    if (isMobile) {
      if (count > 15) return 'h-8 w-8';
      if (count > 10) return 'h-10 w-10';
      return 'h-12 w-12';
    }
    if (count > 20) return 'h-12 w-12';
    if (count > 15) return 'h-14 w-14';
    if (count > 10) return 'h-16 w-16';
    return 'h-20 w-20';
  };

  const getNameSize = () => {
    const count = players.length;
    if (isMobile) {
      if (count > 15) return 'text-[8px]';
      if (count > 10) return 'text-[9px]';
      return 'text-[10px]';
    }
    if (count > 20) return 'text-[10px]';
    if (count > 15) return 'text-xs';
    return 'text-sm';
  };

  const avatarSize = getAvatarSize();
  const nameSize = getNameSize();

  return (
    <div className="relative w-full h-full">
      {/* Central Logo with glow effect */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
        <div className="relative">
          {/* Glow effect */}
          <div 
            className="absolute inset-0 rounded-full blur-xl animate-pulse"
            style={{ 
              background: `radial-gradient(circle, ${INFECTION_COLORS.accent}40 0%, transparent 70%)`,
              width: isMobile ? '120px' : '200px',
              height: isMobile ? '120px' : '200px',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)'
            }}
          />
          {/* Fire-like inner glow */}
          <div 
            className="absolute inset-0 rounded-full blur-md animate-pulse"
            style={{ 
              background: `radial-gradient(circle, ${INFECTION_COLORS.danger}30 0%, transparent 60%)`,
              width: isMobile ? '100px' : '160px',
              height: isMobile ? '100px' : '160px',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              animationDelay: '0.5s'
            }}
          />
          <img 
            src={logoNdogmoabeng} 
            alt="Ndogmoabeng" 
            className={`relative z-10 ${isMobile ? 'w-16 h-16' : 'w-28 h-28'} object-contain drop-shadow-lg`}
          />
        </div>
      </div>

      {/* Players in circle */}
      {playerPositions.map(({ player, x, y }) => {
        const isDead = player.is_alive === false;
        const avatarUrl = getAvatarUrl(player);

        return (
          <div
            key={player.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 transition-all duration-500"
            style={{ 
              left: `${x}%`, 
              top: `${y}%`,
              opacity: isDead ? 0.5 : 1,
            }}
          >
            {/* Avatar with status indicator */}
            <div className="relative">
              <Avatar 
                className={`${avatarSize} border-2 transition-all duration-300`}
                style={{ 
                  borderColor: isDead ? INFECTION_COLORS.danger : INFECTION_COLORS.accent,
                  filter: isDead ? 'grayscale(1)' : 'none'
                }}
              >
                <AvatarImage src={avatarUrl || undefined} alt={player.display_name} />
                <AvatarFallback 
                  className="font-bold"
                  style={{ 
                    backgroundColor: isDead ? INFECTION_COLORS.bgCard : INFECTION_COLORS.bgSecondary,
                    color: isDead ? INFECTION_COLORS.textMuted : INFECTION_COLORS.accent
                  }}
                >
                  {getInitials(player.display_name)}
                </AvatarFallback>
              </Avatar>

              {/* Death overlay */}
              {isDead && (
                <div 
                  className="absolute inset-0 flex items-center justify-center rounded-full"
                  style={{ backgroundColor: `${INFECTION_COLORS.bgPrimary}60` }}
                >
                  <Skull className="h-5 w-5" style={{ color: INFECTION_COLORS.danger }} />
                </div>
              )}

              {/* Player number badge */}
              <div 
                className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                style={{ 
                  backgroundColor: isDead ? INFECTION_COLORS.danger : INFECTION_COLORS.accent,
                  color: INFECTION_COLORS.bgPrimary
                }}
              >
                {player.player_number}
              </div>
            </div>

            {/* Player name - with tooltip for full name */}
            <PlayerNameTooltip fullName={player.display_name}>
              <span 
                className={`${nameSize} font-medium text-center max-w-16 truncate`}
                style={{ color: isDead ? INFECTION_COLORS.textMuted : INFECTION_COLORS.textPrimary }}
              >
                {player.display_name}
              </span>
            </PlayerNameTooltip>
          </div>
        );
      })}
    </div>
  );
}
