import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  CheckCircle, XCircle, Crosshair, Shield, Syringe, Eye, 
  Search, Target, Coins, Vote, Skull, Heart, AlertTriangle
} from 'lucide-react';
import { INFECTION_ROLE_LABELS } from './InfectionTheme';

interface Player {
  id: string;
  display_name: string;
  player_number: number | null;
  role_code: string | null;
  is_alive: boolean | null;
  is_bot?: boolean;
  has_antibodies?: boolean | null;
  is_carrier?: boolean | null;
  is_contagious?: boolean | null;
  infected_at_manche?: number | null;
  will_die_at_manche?: number | null;
  immune_permanent?: boolean | null;
}

interface InfectionInput {
  player_num: number;
  pv_shot_target_num: number | null;
  pv_antidote_target_num: number | null;
  pv_patient0_target_num: number | null;
  ba_shot_target_num: number | null;
  sy_research_target_num: number | null;
  oc_lookup_target_num: number | null;
  ae_sabotage_target_num: number | null;
  corruption_amount: number | null;
  vote_test_target_num: number | null;
}

interface InfectionShot {
  shooter_num: number;
  shooter_role: string;
  target_num: number;
  status: string;
  ignore_reason: string | null;
}

interface RoundResolutionSummaryProps {
  manche: number;
  players: Player[];
  inputs: InfectionInput[];
  shots: InfectionShot[];
  isResolved: boolean;
}

export function RoundResolutionSummary({ 
  manche, 
  players, 
  inputs, 
  shots,
  isResolved 
}: RoundResolutionSummaryProps) {
  
  const getPlayerName = (num: number | null) => {
    if (num === null) return '-';
    const p = players.find(p => p.player_number === num);
    return p ? `#${num} ${p.display_name}` : `#${num}`;
  };

  const getPlayerByNum = (num: number) => players.find(p => p.player_number === num);
  const getInputForPlayer = (num: number) => inputs.find(i => i.player_num === num);
  const getRoleInfo = (code: string | null) => INFECTION_ROLE_LABELS[code || ''] || { name: code, color: '#666', short: code };

  // Calculate summary stats
  const totalCorruption = inputs.reduce((sum, i) => sum + (i.corruption_amount || 0), 0);
  const pvCorruption = inputs
    .filter(i => getPlayerByNum(i.player_num)?.role_code === 'PV')
    .reduce((sum, i) => sum + (i.corruption_amount || 0), 0);
  const cvCorruption = totalCorruption - pvCorruption;

  const killedByShot = shots.filter(s => s.status === 'APPLIED' && !s.ignore_reason?.includes('blocked'));
  const blockedByGilet = shots.filter(s => s.ignore_reason === 'blocked_by_vest');
  const sabotaged = shots.filter(s => s.ignore_reason === 'sabotaged');

  const patient0ThisRound = manche === 1 
    ? players.find(p => p.infected_at_manche === 1 && p.role_code !== 'PV')
    : null;

  const newlyInfected = players.filter(p => p.infected_at_manche === manche && p.role_code !== 'PV');
  
  // Deaths from infection (players who died this round from infection, not shot)
  const deathsFromInfection = players.filter(p => 
    p.is_alive === false && 
    p.will_die_at_manche === manche &&
    !shots.some(s => s.target_num === p.player_number && s.status === 'APPLIED' && !s.ignore_reason)
  );
  
  // Players who became contagious this round (infected 2 rounds ago)
  const newlyContagious = players.filter(p => 
    p.is_contagious === true && 
    p.infected_at_manche === manche - 2 &&
    p.is_alive !== false
  );

  // Group actions by player
  const playerActions = players
    .filter(p => !p.is_bot || true) // Include all players
    .sort((a, b) => (a.player_number || 0) - (b.player_number || 0))
    .map(player => {
      const input = getInputForPlayer(player.player_number!);
      const playerShots = shots.filter(s => s.shooter_num === player.player_number);
      const wasShot = shots.find(s => s.target_num === player.player_number && s.status === 'APPLIED');
      
      const actions: Array<{ type: string; icon: React.ReactNode; text: string; color: string; result?: 'success' | 'blocked' | 'failed' }> = [];
      
      // Add actions based on role and inputs
      if (player.role_code === 'PV') {
        if (manche === 1 && input?.pv_patient0_target_num) {
          actions.push({
            type: 'patient0',
            icon: <Target className="h-3 w-3" />,
            text: `Patient 0: ${getPlayerName(input.pv_patient0_target_num)}`,
            color: '#9333EA',
            result: 'success'
          });
        }
        if (input?.pv_shot_target_num) {
          const shot = playerShots.find(s => s.target_num === input.pv_shot_target_num);
          actions.push({
            type: 'shot',
            icon: <Crosshair className="h-3 w-3" />,
            text: `Tir: ${getPlayerName(input.pv_shot_target_num)}`,
            color: '#B00020',
            result: shot?.status === 'APPLIED' && !shot.ignore_reason ? 'success' : 
                    shot?.ignore_reason === 'blocked_by_vest' ? 'blocked' : 'failed'
          });
        }
        if (input?.pv_antidote_target_num) {
          actions.push({
            type: 'antidote',
            icon: <Syringe className="h-3 w-3" />,
            text: `Antidote: ${getPlayerName(input.pv_antidote_target_num)}`,
            color: '#2AB3A6',
            result: 'success'
          });
        }
      }
      
      if (player.role_code === 'BA') {
        if (input?.ba_shot_target_num) {
          const shot = playerShots.find(s => s.target_num === input.ba_shot_target_num);
          actions.push({
            type: 'shot',
            icon: <Crosshair className="h-3 w-3" />,
            text: `Tir: ${getPlayerName(input.ba_shot_target_num)}`,
            color: '#3B82F6',
            result: shot?.status === 'APPLIED' && !shot.ignore_reason ? 'success' : 
                    shot?.ignore_reason === 'blocked_by_vest' ? 'blocked' :
                    shot?.ignore_reason === 'sabotaged' ? 'failed' : 'failed'
          });
        }
      }
      
      if (player.role_code === 'SY' && input?.sy_research_target_num) {
        actions.push({
          type: 'research',
          icon: <Search className="h-3 w-3" />,
          text: `Recherche: ${getPlayerName(input.sy_research_target_num)}`,
          color: '#2AB3A6'
        });
      }
      
      if (player.role_code === 'OC' && input?.oc_lookup_target_num) {
        const target = getPlayerByNum(input.oc_lookup_target_num);
        actions.push({
          type: 'oracle',
          icon: <Eye className="h-3 w-3" />,
          text: `Consultation: ${getPlayerName(input.oc_lookup_target_num)} (${getRoleInfo(target?.role_code || null).name})`,
          color: '#9333EA'
        });
      }
      
      if (player.role_code === 'AE' && input?.ae_sabotage_target_num) {
        const baPlayer = players.find(p => p.role_code === 'BA');
        const isCorrect = input.ae_sabotage_target_num === baPlayer?.player_number;
        actions.push({
          type: 'sabotage',
          icon: <Target className="h-3 w-3" />,
          text: `Sabotage: ${getPlayerName(input.ae_sabotage_target_num)}`,
          color: '#E6A23C',
          result: isCorrect ? 'success' : 'failed'
        });
      }
      
      if (input?.corruption_amount && input.corruption_amount > 0) {
        actions.push({
          type: 'corruption',
          icon: <Coins className="h-3 w-3" />,
          text: `Corruption: ${input.corruption_amount} jetons`,
          color: '#D4AF37'
        });
      }
      
      if (input?.vote_test_target_num) {
        actions.push({
          type: 'vote',
          icon: <Vote className="h-3 w-3" />,
          text: `Vote test: ${getPlayerName(input.vote_test_target_num)}`,
          color: '#9CA3AF'
        });
      }

      return {
        player,
        actions,
        wasShot,
        input
      };
    })
    .filter(p => p.actions.length > 0 || p.wasShot);

  if (!isResolved) {
    return (
      <div className="p-6 text-center text-[#6B7280]">
        <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-[#E6A23C]" />
        <p>Le récapitulatif sera disponible après la résolution de la manche.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Quick Stats Header */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="p-3 bg-[#B00020]/10 border border-[#B00020]/30 rounded-lg">
          <div className="flex items-center gap-2">
            <Skull className="h-4 w-4 text-[#B00020]" />
            <span className="text-xs text-[#9CA3AF]">Morts par balle</span>
          </div>
          <div className="text-lg font-bold text-[#B00020]">{killedByShot.length}</div>
        </div>
        
        <div className="p-3 bg-[#3B82F6]/10 border border-[#3B82F6]/30 rounded-lg">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-[#3B82F6]" />
            <span className="text-xs text-[#9CA3AF]">Bloqué par gilet</span>
          </div>
          <div className="text-lg font-bold text-[#3B82F6]">{blockedByGilet.length}</div>
        </div>
        
        <div className="p-3 bg-[#E6A23C]/10 border border-[#E6A23C]/30 rounded-lg">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-[#E6A23C]" />
            <span className="text-xs text-[#9CA3AF]">Tirs sabotés</span>
          </div>
          <div className="text-lg font-bold text-[#E6A23C]">{sabotaged.length}</div>
        </div>
        
        <div className="p-3 bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-lg">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-[#D4AF37]" />
            <span className="text-xs text-[#9CA3AF]">Corruption totale</span>
          </div>
          <div className="text-lg font-bold text-[#D4AF37]">{totalCorruption}</div>
          <div className="text-xs text-[#6B7280]">CV: {cvCorruption} | PV: {pvCorruption}</div>
        </div>
      </div>

      {/* Key Events */}
      <div className="p-3 bg-[#1A202C] rounded-lg border border-[#2D3748]">
        <h4 className="font-semibold mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-[#E6A23C]" />
          Événements clés
        </h4>
        <div className="space-y-2 text-sm">
          {patient0ThisRound && (
            <div className="flex items-center gap-2 p-2 bg-[#9333EA]/10 rounded">
              <Target className="h-4 w-4 text-[#9333EA]" />
              <span>Patient 0 désigné: <strong>{patient0ThisRound.display_name}</strong></span>
            </div>
          )}
          
          {killedByShot.map((shot, i) => (
            <div key={i} className="flex items-center gap-2 p-2 bg-[#B00020]/10 rounded">
              <Skull className="h-4 w-4 text-[#B00020]" />
              <span>
                <strong>{getPlayerName(shot.target_num)}</strong> tué par{' '}
                <strong>{getPlayerName(shot.shooter_num)}</strong> ({shot.shooter_role})
              </span>
            </div>
          ))}
          
          {blockedByGilet.map((shot, i) => (
            <div key={i} className="flex items-center gap-2 p-2 bg-[#3B82F6]/10 rounded">
              <Shield className="h-4 w-4 text-[#3B82F6]" />
              <span>
                Tir de <strong>{getPlayerName(shot.shooter_num)}</strong> bloqué par le gilet de{' '}
                <strong>{getPlayerName(shot.target_num)}</strong>
              </span>
            </div>
          ))}
          
          {sabotaged.map((shot, i) => (
            <div key={i} className="flex items-center gap-2 p-2 bg-[#E6A23C]/10 rounded">
              <XCircle className="h-4 w-4 text-[#E6A23C]" />
              <span>
                Tir de <strong>{getPlayerName(shot.shooter_num)}</strong> (BA) saboté par l'AE
              </span>
            </div>
          ))}
          
          {newlyInfected.length > 0 && (
            <div className="flex items-start gap-2 p-2 bg-[#B00020]/10 rounded">
              <Heart className="h-4 w-4 text-[#B00020] mt-0.5" />
              <div>
                <span>Nouvelles infections:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {newlyInfected.map(p => (
                    <Badge key={p.id} className="bg-[#B00020]/20 text-[#B00020] text-xs">
                      #{p.player_number} {p.display_name}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {deathsFromInfection.length > 0 && (
            <div className="flex items-start gap-2 p-2 bg-[#6B21A8]/10 rounded">
              <Skull className="h-4 w-4 text-[#9333EA] mt-0.5" />
              <div>
                <span>Morts par infection:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {deathsFromInfection.map(p => (
                    <Badge key={p.id} className="bg-[#9333EA]/20 text-[#9333EA] text-xs">
                      #{p.player_number} {p.display_name}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {newlyContagious.length > 0 && (
            <div className="flex items-start gap-2 p-2 bg-[#E6A23C]/10 rounded">
              <AlertTriangle className="h-4 w-4 text-[#E6A23C] mt-0.5" />
              <div>
                <span>Nouveaux contaminateurs:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {newlyContagious.map(p => (
                    <Badge key={p.id} className="bg-[#E6A23C]/20 text-[#E6A23C] text-xs">
                      #{p.player_number} {p.display_name}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {killedByShot.length === 0 && blockedByGilet.length === 0 && sabotaged.length === 0 && !patient0ThisRound && newlyInfected.length === 0 && deathsFromInfection.length === 0 && newlyContagious.length === 0 && (
            <div className="text-[#6B7280] text-center py-2">Aucun événement majeur cette manche</div>
          )}
        </div>
      </div>

      {/* Detailed Player Actions */}
      <div className="p-3 bg-[#1A202C] rounded-lg border border-[#2D3748]">
        <h4 className="font-semibold mb-3">Actions détaillées par joueur</h4>
        <ScrollArea className="h-[calc(100vh-600px)] min-h-[200px] max-h-[400px]">
          <div className="space-y-2">
            {playerActions.map(({ player, actions, wasShot }) => {
              const roleInfo = getRoleInfo(player.role_code);
              
              return (
                <div 
                  key={player.id} 
                  className={`p-3 rounded-lg border ${
                    player.is_alive === false 
                      ? 'bg-[#1F2937]/50 border-[#374151] opacity-60' 
                      : 'bg-[#121A2B] border-[#2D3748]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge 
                        style={{ backgroundColor: `${roleInfo.color}20`, color: roleInfo.color }}
                        className="text-xs"
                      >
                        {roleInfo.short}
                      </Badge>
                      <span className={player.is_alive === false ? 'line-through text-[#6B7280]' : ''}>
                        #{player.player_number} {player.display_name}
                      </span>
                      {player.is_bot && (
                        <Badge variant="outline" className="text-xs px-1 py-0">BOT</Badge>
                      )}
                    </div>
                    {player.is_alive === false && (
                      <Badge className="bg-[#B00020]/20 text-[#B00020] text-xs">
                        <Skull className="h-3 w-3 mr-1" />
                        Mort
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {actions.map((action, i) => (
                      <div 
                        key={i}
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs"
                        style={{ backgroundColor: `${action.color}15`, color: action.color }}
                      >
                        {action.icon}
                        <span>{action.text}</span>
                        {action.result === 'success' && (
                          <CheckCircle className="h-3 w-3 text-[#10B981]" />
                        )}
                        {action.result === 'blocked' && (
                          <Shield className="h-3 w-3 text-[#3B82F6]" />
                        )}
                        {action.result === 'failed' && (
                          <XCircle className="h-3 w-3 text-[#EF4444]" />
                        )}
                      </div>
                    ))}
                    
                    {wasShot && (
                      <div className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-[#B00020]/15 text-[#B00020]">
                        <Crosshair className="h-3 w-3" />
                        <span>Touché par {getPlayerName(wasShot.shooter_num)}</span>
                        {wasShot.ignore_reason === 'blocked_by_vest' ? (
                          <Shield className="h-3 w-3 text-[#3B82F6]" />
                        ) : (
                          <Skull className="h-3 w-3" />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            
            {playerActions.length === 0 && (
              <div className="text-center text-[#6B7280] py-4">
                Aucune action enregistrée pour cette manche
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
