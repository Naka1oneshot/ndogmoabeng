import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Users, Shuffle, Check } from 'lucide-react';
import { INFECTION_ROLE_LABELS } from './InfectionTheme';

interface Player {
  id: string;
  display_name: string;
  player_number: number | null;
  is_host?: boolean;
  is_bot?: boolean;
}

interface RoleAssignment {
  playerId: string;
  roleCode: string | null; // null = random
}

interface RoleAssignmentPanelProps {
  players: Player[];
  roleAssignments: RoleAssignment[];
  onAssignmentsChange: (assignments: RoleAssignment[]) => void;
  playerCount: number;
}

// Available roles for Infection
const AVAILABLE_ROLES = [
  { code: 'BA', label: 'Bras Armé', color: 'text-red-500', max: 1 },
  { code: 'PV', label: 'Porteur de Virus', color: 'text-red-400', max: 2 },
  { code: 'SY', label: 'Synthétiste', color: 'text-green-500', max: 2 },
  { code: 'AE', label: 'Agent Ezkar', color: 'text-yellow-500', max: 1 },
  { code: 'OC', label: 'Oracle', color: 'text-purple-500', max: 1 },
  { code: 'KK', label: 'Sans Cercle', color: 'text-gray-400', max: 1 },
  { code: 'CV', label: 'Citoyen Vulnérable', color: 'text-blue-400', max: 99 }, // No limit
];

// Calculate role limits based on player count
function getRoleLimits(playerCount: number): Record<string, number> {
  if (playerCount === 7) {
    return { BA: 1, PV: 2, SY: 2, AE: 0, OC: 1, KK: 0, CV: 1 };
  } else if (playerCount === 8) {
    return { BA: 1, PV: 2, SY: 2, AE: 0, OC: 1, KK: 1, CV: 1 };
  } else {
    // 9+ players
    return { BA: 1, PV: 2, SY: 2, AE: 1, OC: 1, KK: 1, CV: playerCount - 8 };
  }
}

export function RoleAssignmentPanel({
  players,
  roleAssignments,
  onAssignmentsChange,
  playerCount,
}: RoleAssignmentPanelProps) {
  const activePlayers = players.filter(p => !p.is_host && p.player_number !== null);
  const roleLimits = getRoleLimits(playerCount);
  
  // Count current assignments per role
  const currentCounts = roleAssignments.reduce((acc, assignment) => {
    if (assignment.roleCode) {
      acc[assignment.roleCode] = (acc[assignment.roleCode] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  // Get available roles for a player (considering limits)
  const getAvailableRoles = (playerId: string) => {
    const currentAssignment = roleAssignments.find(a => a.playerId === playerId)?.roleCode;
    
    return AVAILABLE_ROLES.filter(role => {
      // Role not available for this player count
      if (roleLimits[role.code] === 0) return false;
      
      // Role already at limit (unless this player has it)
      const count = currentCounts[role.code] || 0;
      if (count >= roleLimits[role.code] && currentAssignment !== role.code) {
        return false;
      }
      
      return true;
    });
  };

  const handleRoleChange = (playerId: string, roleCode: string | null) => {
    const newAssignments = roleAssignments.map(a => 
      a.playerId === playerId ? { ...a, roleCode } : a
    );
    
    // If player not in list, add them
    if (!newAssignments.find(a => a.playerId === playerId)) {
      newAssignments.push({ playerId, roleCode });
    }
    
    onAssignmentsChange(newAssignments);
  };

  const getPlayerAssignment = (playerId: string) => {
    return roleAssignments.find(a => a.playerId === playerId)?.roleCode || null;
  };

  const assignedCount = roleAssignments.filter(a => a.roleCode !== null).length;
  const randomCount = activePlayers.length - assignedCount;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <Users className="h-4 w-4" />
          Attribution des rôles
        </h3>
        <div className="flex gap-2 text-xs">
          <Badge variant="outline" className="border-[#2AB3A6]/50 text-[#2AB3A6]">
            <Check className="h-3 w-3 mr-1" />
            {assignedCount} assignés
          </Badge>
          <Badge variant="outline" className="border-[#D4AF37]/50 text-[#D4AF37]">
            <Shuffle className="h-3 w-3 mr-1" />
            {randomCount} aléatoires
          </Badge>
        </div>
      </div>

      {/* Role counts summary */}
      <div className="flex flex-wrap gap-2 p-2 bg-[#0B0E14] rounded-lg">
        {AVAILABLE_ROLES.map(role => {
          const limit = roleLimits[role.code];
          if (limit === 0) return null;
          const count = currentCounts[role.code] || 0;
          return (
            <Badge 
              key={role.code}
              variant="outline" 
              className={`${role.color} border-current/30 text-xs`}
            >
              {role.label}: {count}/{limit}
            </Badge>
          );
        })}
      </div>

      {/* Player list with role selectors */}
      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {activePlayers.map((player) => {
          const currentRole = getPlayerAssignment(player.id);
          const availableRoles = getAvailableRoles(player.id);
          
          return (
            <div 
              key={player.id}
              className="flex items-center justify-between p-2 bg-[#0B0E14] rounded-lg"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#6B7280] w-6">#{player.player_number}</span>
                <span className="text-white text-sm">
                  {player.display_name}
                  {player.is_bot && <span className="text-xs text-[#6B7280] ml-1">(Bot)</span>}
                </span>
              </div>
              
              <Select
                value={currentRole || 'random'}
                onValueChange={(value) => handleRoleChange(player.id, value === 'random' ? null : value)}
              >
                <SelectTrigger className="w-[160px] h-8 text-xs bg-[#1A2235] border-[#2D3748]">
                  <SelectValue>
                    {currentRole ? (
                      <span className={AVAILABLE_ROLES.find(r => r.code === currentRole)?.color}>
                        {INFECTION_ROLE_LABELS[currentRole]?.name || currentRole}
                      </span>
                    ) : (
                      <span className="text-[#D4AF37] flex items-center gap-1">
                        <Shuffle className="h-3 w-3" /> Aléatoire
                      </span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-[#1A2235] border-[#2D3748] z-50">
                  <SelectItem value="random" className="text-[#D4AF37]">
                    <span className="flex items-center gap-1">
                      <Shuffle className="h-3 w-3" /> Aléatoire
                    </span>
                  </SelectItem>
                  {availableRoles.map(role => (
                    <SelectItem 
                      key={role.code} 
                      value={role.code}
                      className={role.color}
                    >
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-[#6B7280]">
        💡 Les joueurs non assignés recevront un rôle aléatoire parmi les rôles restants au démarrage de la partie.
      </p>
    </div>
  );
}
