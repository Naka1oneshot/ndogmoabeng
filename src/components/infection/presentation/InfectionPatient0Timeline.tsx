import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Skull, AlertTriangle, Activity, HeartPulse } from 'lucide-react';
import { INFECTION_COLORS } from '../InfectionTheme';

interface Player {
  id: string;
  is_alive: boolean | null;
}

interface RoundState {
  id: string;
  manche: number;
  status: string;
  resolved_at: string | null;
}

interface InfectionPatient0TimelineProps {
  roundStates: RoundState[];
  currentManche: number;
  players: Player[];
  isMobile: boolean;
}

export function InfectionPatient0Timeline({ 
  roundStates, 
  currentManche, 
  players,
  isMobile 
}: InfectionPatient0TimelineProps) {
  // Calculate timeline data - shows virus progression WITHOUT revealing who Patient 0 is
  const timelineData = useMemo(() => {
    // Build timeline for manches 1-N
    const maxManche = Math.max(currentManche, roundStates.length, 1);
    const timeline = [];

    for (let m = 1; m <= maxManche; m++) {
      const roundState = roundStates.find(r => r.manche === m);
      const isResolved = roundState?.status === 'RESOLVED';
      const isCurrent = m === currentManche;
      
      // Count players that will/have died at this manche
      // This info is public knowledge after the round is resolved
      const deathsAtManche = players.filter(p => {
        // For resolved rounds, we can show deaths
        if (isResolved) {
          // We'd need to track actual deaths per round - for now just show is_alive
          return false;
        }
        return false;
      }).length;

      // Calculate potential deaths (virus spread) - PUBLIC INFO
      // Infection spreads: Patient 0 infects at M+2, they die at M+3
      // Each newly infected person contaminates at infection+2, dies at infection+3
      let potentialDeaths = 0;
      if (m >= 3) {
        // Simplified model: exponential growth starting from manche 3
        potentialDeaths = Math.min(Math.floor(Math.pow(1.5, m - 3)), players.length);
      }

      timeline.push({
        manche: m,
        isResolved,
        isCurrent,
        potentialDeaths,
        actualDeaths: deathsAtManche,
        status: isResolved ? 'resolved' : isCurrent ? 'current' : 'pending'
      });
    }

    return timeline;
  }, [roundStates, currentManche, players]);

  // Calculate virus spread visualization
  const virusSpreadInfo = useMemo(() => {
    // Public info: show general virus progression without revealing who is infected
    const deadCount = players.filter(p => p.is_alive === false).length;
    const aliveCount = players.filter(p => p.is_alive !== false).length;
    
    // Danger level based on time passed
    let dangerLevel = 'low';
    if (currentManche >= 5) dangerLevel = 'critical';
    else if (currentManche >= 3) dangerLevel = 'high';
    else if (currentManche >= 2) dangerLevel = 'medium';

    return { deadCount, aliveCount, dangerLevel };
  }, [players, currentManche]);

  if (isMobile) {
    // Compact mobile timeline
    return (
      <div 
        className="rounded-lg p-2"
        style={{ backgroundColor: INFECTION_COLORS.bgCard, border: `1px solid ${INFECTION_COLORS.border}` }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4" style={{ color: INFECTION_COLORS.danger }} />
            <span className="text-xs font-medium" style={{ color: INFECTION_COLORS.textPrimary }}>
              Propagation du Virus
            </span>
          </div>
          
          <div className="flex items-center gap-1">
            {timelineData.slice(0, 6).map((data) => (
              <div
                key={data.manche}
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                  data.isCurrent ? 'ring-2 ring-offset-1 ring-[#B00020]' : ''
                }`}
                style={{ 
                  backgroundColor: data.isResolved 
                    ? INFECTION_COLORS.bgSecondary 
                    : data.isCurrent 
                      ? INFECTION_COLORS.accent 
                      : INFECTION_COLORS.bgCard,
                  color: data.isCurrent ? INFECTION_COLORS.bgPrimary : INFECTION_COLORS.textSecondary,
                  borderColor: data.isResolved ? INFECTION_COLORS.border : 'transparent'
                }}
              >
                {data.manche}
              </div>
            ))}
            {timelineData.length > 6 && (
              <span className="text-xs" style={{ color: INFECTION_COLORS.textMuted }}>+{timelineData.length - 6}</span>
            )}
          </div>

          <Badge 
            className="text-[10px]"
            style={{ 
              backgroundColor: virusSpreadInfo.dangerLevel === 'critical' 
                ? INFECTION_COLORS.danger 
                : virusSpreadInfo.dangerLevel === 'high'
                  ? INFECTION_COLORS.warning
                  : INFECTION_COLORS.success,
              color: INFECTION_COLORS.bgPrimary
            }}
          >
            <Skull className="h-3 w-3 mr-1" />
            {virusSpreadInfo.deadCount}
          </Badge>
        </div>
      </div>
    );
  }

  // Desktop timeline
  return (
    <div 
      className="rounded-lg p-4"
      style={{ backgroundColor: INFECTION_COLORS.bgCard, border: `1px solid ${INFECTION_COLORS.border}` }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div 
            className="p-2 rounded-lg"
            style={{ backgroundColor: `${INFECTION_COLORS.danger}20` }}
          >
            <Activity className="h-5 w-5" style={{ color: INFECTION_COLORS.danger }} />
          </div>
          <div>
            <h3 className="font-bold" style={{ color: INFECTION_COLORS.textPrimary }}>
              Propagation du Virus
            </h3>
            <p className="text-xs" style={{ color: INFECTION_COLORS.textMuted }}>
              Patient 0 a été infecté - Le virus se propage...
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge 
            className="text-sm"
            style={{ 
              backgroundColor: virusSpreadInfo.dangerLevel === 'critical' 
                ? INFECTION_COLORS.danger 
                : virusSpreadInfo.dangerLevel === 'high'
                  ? INFECTION_COLORS.warning
                  : INFECTION_COLORS.success,
              color: INFECTION_COLORS.bgPrimary
            }}
          >
            {virusSpreadInfo.dangerLevel === 'critical' && <AlertTriangle className="h-4 w-4 mr-1" />}
            {virusSpreadInfo.dangerLevel === 'high' && <AlertTriangle className="h-4 w-4 mr-1" />}
            {virusSpreadInfo.dangerLevel === 'medium' && <HeartPulse className="h-4 w-4 mr-1" />}
            Niveau: {virusSpreadInfo.dangerLevel.toUpperCase()}
          </Badge>
          
          <div className="flex items-center gap-2">
            <Skull className="h-5 w-5" style={{ color: INFECTION_COLORS.danger }} />
            <span className="font-bold" style={{ color: INFECTION_COLORS.danger }}>
              {virusSpreadInfo.deadCount}
            </span>
            <span style={{ color: INFECTION_COLORS.textMuted }}>morts</span>
          </div>
        </div>
      </div>

      {/* Timeline bar */}
      <div className="relative">
        {/* Background line */}
        <div 
          className="absolute top-4 left-0 right-0 h-1 rounded-full"
          style={{ backgroundColor: INFECTION_COLORS.bgSecondary }}
        />

        {/* Timeline nodes */}
        <div className="relative flex justify-between">
          {timelineData.map((data) => (
            <div 
              key={data.manche} 
              className="flex flex-col items-center gap-1 relative z-10"
            >
              {/* Node */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                  data.isCurrent ? 'ring-4 ring-offset-2 ring-[#B00020]/60 animate-pulse' : ''
                }`}
                style={{ 
                  backgroundColor: data.isResolved 
                    ? INFECTION_COLORS.bgSecondary 
                    : data.isCurrent 
                      ? INFECTION_COLORS.accent 
                      : INFECTION_COLORS.bgCard,
                  color: data.isCurrent ? INFECTION_COLORS.bgPrimary : INFECTION_COLORS.textSecondary,
                  border: `2px solid ${data.isResolved ? INFECTION_COLORS.success : data.isCurrent ? INFECTION_COLORS.accent : INFECTION_COLORS.border}`
                }}
              >
                {data.manche}
              </div>

              {/* Potential deaths indicator */}
              {data.manche >= 3 && (
                <div 
                  className="flex items-center gap-1 text-xs"
                  style={{ color: INFECTION_COLORS.textMuted }}
                >
                  <Skull className="h-3 w-3" style={{ color: INFECTION_COLORS.danger }} />
                  <span style={{ color: INFECTION_COLORS.danger }}>?</span>
                </div>
              )}

              {/* Status label */}
              <span 
                className="text-[10px] font-medium"
                style={{ 
                  color: data.isCurrent ? INFECTION_COLORS.accent : 
                    data.isResolved ? INFECTION_COLORS.success : INFECTION_COLORS.textMuted 
                }}
              >
                {data.isCurrent ? 'EN COURS' : data.isResolved ? 'Résolu' : ''}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
