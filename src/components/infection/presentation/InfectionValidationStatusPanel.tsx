import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CheckCircle, Clock } from 'lucide-react';
import { INFECTION_COLORS } from '../InfectionTheme';

interface Player {
  id: string;
  display_name: string;
  player_number: number | null;
  user_id: string | null;
  is_alive: boolean | null;
}

interface InfectionValidationStatusPanelProps {
  players: Player[];
  validatedPlayerIds: Set<string>;
  avatarUrls: Map<string, string>;
  type: 'validated' | 'pending';
  isMobile?: boolean;
}

export function InfectionValidationStatusPanel({
  players,
  validatedPlayerIds,
  avatarUrls,
  type,
  isMobile = false,
}: InfectionValidationStatusPanelProps) {
  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const getAvatarUrl = (player: Player) => {
    if (player.user_id && avatarUrls.has(player.user_id)) {
      return avatarUrls.get(player.user_id);
    }
    return null;
  };

  // Filter players based on validation status (only alive players need to validate)
  const filteredPlayers = players.filter(p => {
    if (p.is_alive === false) return false; // Dead players don't validate
    const isValidated = validatedPlayerIds.has(p.id);
    return type === 'validated' ? isValidated : !isValidated;
  });

  const isValidated = type === 'validated';
  const Icon = isValidated ? CheckCircle : Clock;
  const title = isValidated ? 'Validés' : 'En attente';
  const iconColor = isValidated ? INFECTION_COLORS.success : INFECTION_COLORS.warning;

  return (
    <div 
      className="rounded-lg p-3 h-full flex flex-col"
      style={{ 
        backgroundColor: INFECTION_COLORS.bgCard,
        border: `1px solid ${INFECTION_COLORS.border}`,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4" style={{ color: iconColor }} />
        <span 
          className="text-sm font-semibold"
          style={{ color: INFECTION_COLORS.textPrimary }}
        >
          {title}
        </span>
        <span 
          className="text-xs ml-auto"
          style={{ color: INFECTION_COLORS.textMuted }}
        >
          ({filteredPlayers.length})
        </span>
      </div>

      {/* Player List */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {filteredPlayers.length === 0 ? (
          <p 
            className="text-xs text-center py-4"
            style={{ color: INFECTION_COLORS.textMuted }}
          >
            {isValidated ? 'Aucun joueur validé' : 'Tous les joueurs ont validé'}
          </p>
        ) : (
          filteredPlayers.map(player => {
            const avatarUrl = getAvatarUrl(player);
            return (
              <div 
                key={player.id}
                className="flex items-center gap-2 p-1.5 rounded"
                style={{ backgroundColor: `${INFECTION_COLORS.bgSecondary}80` }}
              >
                <Avatar className="h-7 w-7 border" style={{ borderColor: iconColor }}>
                  <AvatarImage src={avatarUrl || undefined} alt={player.display_name} />
                  <AvatarFallback 
                    className="text-[10px] font-bold"
                    style={{ 
                      backgroundColor: INFECTION_COLORS.bgSecondary,
                      color: INFECTION_COLORS.accent 
                    }}
                  >
                    {getInitials(player.display_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <span 
                    className={`text-xs font-medium truncate block ${isMobile ? 'max-w-20' : ''}`}
                    style={{ color: INFECTION_COLORS.textPrimary }}
                  >
                    {player.display_name}
                  </span>
                </div>
                <span 
                  className="text-[10px] font-mono"
                  style={{ color: INFECTION_COLORS.textMuted }}
                >
                  #{player.player_number}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
