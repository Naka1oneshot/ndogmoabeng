import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  Skull, 
  Heart, 
  Activity, 
  Clock,
  AlertTriangle,
  Target,
  Shield
} from 'lucide-react';
import { INFECTION_COLORS } from '../InfectionTheme';

interface RoundState {
  id: string;
  manche: number;
  status: string;
  resolved_at: string | null;
}

interface InfectionStatsPanelProps {
  totalPlayers: number;
  alivePlayers: number;
  deadPlayers: number;
  currentManche: number;
  roundStates: RoundState[];
  isMobile: boolean;
}

export function InfectionStatsPanel({ 
  totalPlayers, 
  alivePlayers, 
  deadPlayers, 
  currentManche,
  roundStates,
  isMobile 
}: InfectionStatsPanelProps) {
  // Calculate survival rate
  const survivalRate = totalPlayers > 0 ? Math.round((alivePlayers / totalPlayers) * 100) : 100;
  
  // Round status
  const currentRound = roundStates.find(r => r.manche === currentManche);
  const roundStatus = currentRound?.status || 'PENDING';
  const resolvedRounds = roundStates.filter(r => r.status === 'RESOLVED').length;

  // Danger level based on deaths
  const getDangerLevel = () => {
    if (deadPlayers >= 5) return { level: 'CRITIQUE', color: INFECTION_COLORS.danger };
    if (deadPlayers >= 3) return { level: 'ÉLEVÉ', color: INFECTION_COLORS.warning };
    if (deadPlayers >= 1) return { level: 'MOYEN', color: INFECTION_COLORS.accent };
    return { level: 'FAIBLE', color: INFECTION_COLORS.success };
  };

  const dangerInfo = getDangerLevel();

  if (isMobile) {
    // Compact mobile stats
    return (
      <div 
        className="rounded-lg p-2 h-full"
        style={{ backgroundColor: INFECTION_COLORS.bgCard, border: `1px solid ${INFECTION_COLORS.border}` }}
      >
        <div className="text-xs font-bold mb-2" style={{ color: INFECTION_COLORS.accent }}>
          Stats
        </div>
        <div className="grid grid-cols-2 gap-1 text-[10px]">
          <div 
            className="flex items-center gap-1 p-1 rounded"
            style={{ backgroundColor: INFECTION_COLORS.bgSecondary }}
          >
            <Users className="h-3 w-3" style={{ color: INFECTION_COLORS.success }} />
            <span style={{ color: INFECTION_COLORS.textPrimary }}>{alivePlayers}</span>
          </div>
          <div 
            className="flex items-center gap-1 p-1 rounded"
            style={{ backgroundColor: INFECTION_COLORS.bgSecondary }}
          >
            <Skull className="h-3 w-3" style={{ color: INFECTION_COLORS.danger }} />
            <span style={{ color: INFECTION_COLORS.textPrimary }}>{deadPlayers}</span>
          </div>
          <div 
            className="flex items-center gap-1 p-1 rounded"
            style={{ backgroundColor: INFECTION_COLORS.bgSecondary }}
          >
            <Heart className="h-3 w-3" style={{ color: INFECTION_COLORS.accent }} />
            <span style={{ color: INFECTION_COLORS.textPrimary }}>{survivalRate}%</span>
          </div>
          <div 
            className="flex items-center gap-1 p-1 rounded"
            style={{ backgroundColor: INFECTION_COLORS.bgSecondary }}
          >
            <Clock className="h-3 w-3" style={{ color: INFECTION_COLORS.textMuted }} />
            <span style={{ color: INFECTION_COLORS.textPrimary }}>M{currentManche}</span>
          </div>
        </div>
      </div>
    );
  }

  // Desktop full stats panel
  return (
    <div 
      className="rounded-lg h-full flex flex-col"
      style={{ backgroundColor: INFECTION_COLORS.bgCard, border: `1px solid ${INFECTION_COLORS.border}` }}
    >
      <div 
        className="p-3 border-b flex items-center gap-2"
        style={{ borderColor: INFECTION_COLORS.border }}
      >
        <Activity className="h-4 w-4" style={{ color: INFECTION_COLORS.accent }} />
        <span className="font-bold text-sm" style={{ color: INFECTION_COLORS.textPrimary }}>
          Indicateurs
        </span>
      </div>

      <ScrollArea className="flex-1 p-3">
        <div className="space-y-3">
          {/* Danger Level */}
          <div 
            className="p-3 rounded-lg"
            style={{ backgroundColor: `${dangerInfo.color}15`, border: `1px solid ${dangerInfo.color}40` }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium" style={{ color: INFECTION_COLORS.textSecondary }}>
                Niveau de Danger
              </span>
              <AlertTriangle className="h-4 w-4" style={{ color: dangerInfo.color }} />
            </div>
            <div className="text-lg font-bold" style={{ color: dangerInfo.color }}>
              {dangerInfo.level}
            </div>
          </div>

          {/* Population Stats */}
          <div 
            className="p-3 rounded-lg space-y-2"
            style={{ backgroundColor: INFECTION_COLORS.bgSecondary }}
          >
            <div className="text-xs font-medium mb-2" style={{ color: INFECTION_COLORS.textSecondary }}>
              Population
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" style={{ color: INFECTION_COLORS.success }} />
                <span className="text-sm" style={{ color: INFECTION_COLORS.textPrimary }}>En vie</span>
              </div>
              <span className="font-bold" style={{ color: INFECTION_COLORS.success }}>{alivePlayers}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skull className="h-4 w-4" style={{ color: INFECTION_COLORS.danger }} />
                <span className="text-sm" style={{ color: INFECTION_COLORS.textPrimary }}>Décédés</span>
              </div>
              <span className="font-bold" style={{ color: INFECTION_COLORS.danger }}>{deadPlayers}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4" style={{ color: INFECTION_COLORS.accent }} />
                <span className="text-sm" style={{ color: INFECTION_COLORS.textPrimary }}>Survie</span>
              </div>
              <span className="font-bold" style={{ color: INFECTION_COLORS.accent }}>{survivalRate}%</span>
            </div>
          </div>

          {/* Round Progress */}
          <div 
            className="p-3 rounded-lg space-y-2"
            style={{ backgroundColor: INFECTION_COLORS.bgSecondary }}
          >
            <div className="text-xs font-medium mb-2" style={{ color: INFECTION_COLORS.textSecondary }}>
              Progression
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" style={{ color: INFECTION_COLORS.textMuted }} />
                <span className="text-sm" style={{ color: INFECTION_COLORS.textPrimary }}>Manche</span>
              </div>
              <Badge style={{ backgroundColor: INFECTION_COLORS.accent, color: INFECTION_COLORS.bgPrimary }}>
                {currentManche}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4" style={{ color: INFECTION_COLORS.textMuted }} />
                <span className="text-sm" style={{ color: INFECTION_COLORS.textPrimary }}>Résolues</span>
              </div>
              <span className="font-medium" style={{ color: INFECTION_COLORS.textPrimary }}>{resolvedRounds}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" style={{ color: INFECTION_COLORS.textMuted }} />
                <span className="text-sm" style={{ color: INFECTION_COLORS.textPrimary }}>Status</span>
              </div>
              <Badge 
                className="text-xs"
                style={{ 
                  backgroundColor: roundStatus === 'OPEN' 
                    ? `${INFECTION_COLORS.success}20` 
                    : roundStatus === 'RESOLVED'
                      ? `${INFECTION_COLORS.accent}20`
                      : `${INFECTION_COLORS.textMuted}20`,
                  color: roundStatus === 'OPEN' 
                    ? INFECTION_COLORS.success 
                    : roundStatus === 'RESOLVED'
                      ? INFECTION_COLORS.accent
                      : INFECTION_COLORS.textMuted
                }}
              >
                {roundStatus === 'OPEN' ? 'EN COURS' : roundStatus === 'RESOLVED' ? 'RÉSOLU' : roundStatus}
              </Badge>
            </div>
          </div>

          {/* Warning */}
          <div 
            className="p-2 rounded-lg text-xs text-center"
            style={{ backgroundColor: `${INFECTION_COLORS.danger}10`, color: INFECTION_COLORS.danger }}
          >
            <AlertTriangle className="h-3 w-3 inline mr-1" />
            Le virus se propage en silence...
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
