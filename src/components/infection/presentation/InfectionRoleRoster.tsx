import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Skull, Users } from 'lucide-react';
import { INFECTION_COLORS, INFECTION_ROLE_LABELS, INFECTION_TEAM_LABELS } from '../InfectionTheme';

interface RoleStat {
  roleCode: string;
  alive: number;
  dead: number;
  total: number;
}

interface InfectionRoleRosterProps {
  roleStats: RoleStat[];
  isMobile: boolean;
}

export function InfectionRoleRoster({ roleStats, isMobile }: InfectionRoleRosterProps) {
  // Group by team
  const teamGroups = {
    PV: roleStats.filter(r => INFECTION_ROLE_LABELS[r.roleCode]?.team === 'PV'),
    SY: roleStats.filter(r => INFECTION_ROLE_LABELS[r.roleCode]?.team === 'SY'),
    NEUTRE: roleStats.filter(r => INFECTION_ROLE_LABELS[r.roleCode]?.team === 'NEUTRE'),
    CITOYEN: roleStats.filter(r => INFECTION_ROLE_LABELS[r.roleCode]?.team === 'CITOYEN'),
  };

  // Get icon for role status
  const getRoleIcon = (alive: number, dead: number) => {
    if (dead > 0 && alive === 0) {
      return <Skull className="h-3 w-3" style={{ color: INFECTION_COLORS.danger }} />;
    }
    if (alive > 0) {
      return <CheckCircle className="h-3 w-3" style={{ color: INFECTION_COLORS.success }} />;
    }
    return <Users className="h-3 w-3" style={{ color: INFECTION_COLORS.textMuted }} />;
  };

  if (isMobile) {
    // Compact mobile view - just show team totals
    return (
      <div 
        className="rounded-lg p-2 h-full"
        style={{ backgroundColor: INFECTION_COLORS.bgCard, border: `1px solid ${INFECTION_COLORS.border}` }}
      >
        <div className="text-xs font-bold mb-2" style={{ color: INFECTION_COLORS.accent }}>
          Rôles
        </div>
        <div className="grid grid-cols-2 gap-1">
          {Object.entries(teamGroups).map(([team, roles]) => {
            const totalAlive = roles.reduce((sum, r) => sum + r.alive, 0);
            const totalDead = roles.reduce((sum, r) => sum + r.dead, 0);
            const teamInfo = INFECTION_TEAM_LABELS[team];
            
            if (roles.length === 0 || (totalAlive === 0 && totalDead === 0)) return null;

            return (
              <div 
                key={team}
                className="flex items-center justify-between p-1 rounded text-[10px]"
                style={{ backgroundColor: INFECTION_COLORS.bgSecondary }}
              >
                <span style={{ color: teamInfo?.color || INFECTION_COLORS.textSecondary }}>
                  {team}
                </span>
                <div className="flex items-center gap-1">
                  <span style={{ color: INFECTION_COLORS.success }}>{totalAlive}</span>
                  <span style={{ color: INFECTION_COLORS.textMuted }}>/</span>
                  <span style={{ color: INFECTION_COLORS.danger }}>{totalDead}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Desktop view - full role roster
  return (
    <div 
      className="rounded-lg h-full flex flex-col"
      style={{ backgroundColor: INFECTION_COLORS.bgCard, border: `1px solid ${INFECTION_COLORS.border}` }}
    >
      <div 
        className="p-3 border-b flex items-center gap-2"
        style={{ borderColor: INFECTION_COLORS.border }}
      >
        <Users className="h-4 w-4" style={{ color: INFECTION_COLORS.accent }} />
        <span className="font-bold text-sm" style={{ color: INFECTION_COLORS.textPrimary }}>
          Rôles en Jeu
        </span>
      </div>

      <ScrollArea className="flex-1 p-3">
        <div className="space-y-4">
          {Object.entries(teamGroups).map(([team, roles]) => {
            if (roles.length === 0) return null;
            
            const totalAlive = roles.reduce((sum, r) => sum + r.alive, 0);
            const totalDead = roles.reduce((sum, r) => sum + r.dead, 0);
            
            if (totalAlive === 0 && totalDead === 0) return null;

            const teamInfo = INFECTION_TEAM_LABELS[team];

            return (
              <div key={team} className="space-y-2">
                {/* Team header */}
                <div className="flex items-center justify-between">
                  <Badge 
                    className="text-xs font-bold"
                    style={{ backgroundColor: `${teamInfo?.color || INFECTION_COLORS.accent}30`, color: teamInfo?.color || INFECTION_COLORS.accent }}
                  >
                    {teamInfo?.name || team}
                  </Badge>
                  <div className="flex items-center gap-2 text-xs">
                    <span style={{ color: INFECTION_COLORS.success }}>{totalAlive} ✓</span>
                    <span style={{ color: INFECTION_COLORS.danger }}>{totalDead} ✗</span>
                  </div>
                </div>

                {/* Role list */}
                <div className="space-y-1">
                  {roles.map((stat) => {
                    const roleInfo = INFECTION_ROLE_LABELS[stat.roleCode];
                    if (!roleInfo || stat.total === 0) return null;

                    return (
                      <div 
                        key={stat.roleCode}
                        className="flex items-center justify-between p-2 rounded text-sm"
                        style={{ backgroundColor: INFECTION_COLORS.bgSecondary }}
                      >
                        <div className="flex items-center gap-2">
                          {getRoleIcon(stat.alive, stat.dead)}
                          <span 
                            className="font-medium"
                            style={{ 
                              color: stat.dead > 0 && stat.alive === 0 
                                ? INFECTION_COLORS.textMuted 
                                : INFECTION_COLORS.textPrimary 
                            }}
                          >
                            {roleInfo.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {stat.alive > 0 && (
                            <Badge 
                              className="text-xs h-5 px-1.5"
                              style={{ backgroundColor: `${INFECTION_COLORS.success}20`, color: INFECTION_COLORS.success }}
                            >
                              {stat.alive}
                            </Badge>
                          )}
                          {stat.dead > 0 && (
                            <Badge 
                              className="text-xs h-5 px-1.5"
                              style={{ backgroundColor: `${INFECTION_COLORS.danger}20`, color: INFECTION_COLORS.danger }}
                            >
                              <Skull className="h-3 w-3 mr-0.5" />
                              {stat.dead}
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
