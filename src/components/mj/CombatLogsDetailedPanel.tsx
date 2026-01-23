import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileText,
  Clock,
  Copy,
  Check,
  Swords,
  Shield,
  Heart,
  Skull,
  Zap,
  Package,
  ArrowRight,
  Bomb,
  Wind,
  Eye,
  ChevronDown,
  ChevronUp,
  Trophy,
  Target,
  Users,
  Activity,
  TreePine,
  Ban,
} from 'lucide-react';
import { ForestButton } from '@/components/ui/ForestButton';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface CombatLog {
  id: string;
  manche: number | null;
  num_joueur: number | null;
  action: string;
  details: string | null;
  timestamp: string | null;
}

interface CombatLogsDetailedPanelProps {
  logs: CombatLog[];
  currentManche: number;
  availableManches: number[];
  className?: string;
}

type LogCategory = 'damage' | 'protection' | 'heal' | 'kill' | 'effect' | 'inventory' | 'resolution' | 'combatData' | 'system';

interface ParsedLog extends CombatLog {
  category: LogCategory;
  icon: React.ReactNode;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  parsedResolution?: ParsedResolution | null;
  parsedCombatData?: CombatDataDetails | null;
}

interface ParsedResolution {
  kills: Array<{ killerName: string; monsterName: string; slot: number; reward: number }>;
  actions: Array<{
    position: number;
    nom: string;
    weapons: string[];
    totalDamage: number;
    cancelled: boolean;
    cancelReason?: string;
  }>;
  forestState?: { totalPvRemaining: number; monstersKilled: number };
  totalDamage: number;
  totalRewards: number;
}

interface CombatDataDetails {
  kills: Array<{ killerName: string; monsterName: string; slot: number; reward: number }>;
  rewards: Array<{ playerNum: number; reward: number }>;
  berserkerPenalties: Array<{ playerNum: number; tokens: number }>;
  voilePenalties: Array<{ playerNum: number; playerName: string; tokens: number; reason: string }>;
  amuletteEffects: Array<{ playerNum: number; multiplier: number }>;
  mineEffects: string[];
  dotEffects: string[];
}

// Try to parse COMBAT_DATA details (contains dotEffects, voilePenalties, etc.)
function parseCombatDataDetails(details: string | null): CombatDataDetails | null {
  if (!details) return null;
  
  try {
    const jsonMatch = details.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    
    const data = JSON.parse(jsonMatch[0]);
    
    return {
      kills: Array.isArray(data.kills) ? data.kills : [],
      rewards: Array.isArray(data.rewards) ? data.rewards : [],
      berserkerPenalties: Array.isArray(data.berserkerPenalties) ? data.berserkerPenalties : [],
      voilePenalties: Array.isArray(data.voilePenalties) ? data.voilePenalties : [],
      amuletteEffects: Array.isArray(data.amuletteEffects) ? data.amuletteEffects : [],
      mineEffects: Array.isArray(data.mineEffects) ? data.mineEffects : [],
      dotEffects: Array.isArray(data.dotEffects) ? data.dotEffects : [],
    };
  } catch {
    return null;
  }
}

// Try to parse COMBAT_RESOLU or COMBAT_DATA details
function parseResolutionDetails(details: string | null): ParsedResolution | null {
  if (!details) return null;
  
  try {
    // Try to extract JSON from the details string
    const jsonMatch = details.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    
    const data = JSON.parse(jsonMatch[0]);
    
    const kills = Array.isArray(data.kills) ? data.kills : [];
    const actions = Array.isArray(data.public_summary) 
      ? data.public_summary 
      : Array.isArray(data.actions) 
        ? data.actions 
        : [];
    const forestState = data.forest_state || data.forestState;
    
    const totalDamage = actions.reduce((sum: number, a: { totalDamage?: number; cancelled?: boolean }) => 
      sum + (a.cancelled ? 0 : (a.totalDamage || 0)), 0);
    const totalRewards = kills.reduce((sum: number, k: { reward?: number }) => sum + (k.reward || 0), 0);
    
    return {
      kills,
      actions,
      forestState,
      totalDamage,
      totalRewards,
    };
  } catch {
    return null;
  }
}

export function CombatLogsDetailedPanel({
  logs,
  currentManche,
  availableManches,
  className,
}: CombatLogsDetailedPanelProps) {
  const [selectedManche, setSelectedManche] = useState<string>('current');
  const [copied, setCopied] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    resolution: true,
    combatData: true,
    kill: true,
    damage: true,
    protection: true,
    effect: true,
    heal: false,
    inventory: false,
    system: false,
  });

  const displayManche = selectedManche === 'current' ? currentManche : parseInt(selectedManche);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => log.manche === displayManche);
  }, [logs, displayManche]);

  const categorizeLog = (log: CombatLog): ParsedLog => {
    const action = log.action.toUpperCase();

    // COMBAT_DATA logs with detailed effects
    if (action === 'COMBAT_DATA') {
      const parsed = parseCombatDataDetails(log.details);
      return {
        ...log,
        category: 'combatData',
        icon: <Zap className="h-4 w-4" />,
        colorClass: 'text-orange-400',
        bgClass: 'bg-orange-500/10',
        borderClass: 'border-orange-500/30',
        parsedCombatData: parsed,
      };
    }

    // COMBAT_RESOLU logs with action summary
    if (action.includes('COMBAT_RESOLU') || action.includes('RESOLUTION')) {
      const parsed = parseResolutionDetails(log.details);
      return {
        ...log,
        category: 'resolution',
        icon: <Activity className="h-4 w-4" />,
        colorClass: 'text-primary',
        bgClass: 'bg-primary/10',
        borderClass: 'border-primary/30',
        parsedResolution: parsed,
      };
    }

    if (action.includes('KILL')) {
      return {
        ...log,
        category: 'kill',
        icon: <Skull className="h-4 w-4" />,
        colorClass: 'text-amber-400',
        bgClass: 'bg-amber-500/10',
        borderClass: 'border-amber-500/30',
      };
    }

    if (action.includes('DEGATS') || action.includes('ATTAQUE') || action.includes('ATK')) {
      return {
        ...log,
        category: 'damage',
        icon: <Swords className="h-4 w-4" />,
        colorClass: 'text-red-400',
        bgClass: 'bg-red-500/10',
        borderClass: 'border-red-500/30',
      };
    }

    if (action.includes('PROTECTION') || action.includes('BOUCLIER')) {
      return {
        ...log,
        category: 'protection',
        icon: <Shield className="h-4 w-4" />,
        colorClass: 'text-blue-400',
        bgClass: 'bg-blue-500/10',
        borderClass: 'border-blue-500/30',
      };
    }

    if (action.includes('GAZ')) {
      return {
        ...log,
        category: 'protection',
        icon: <Wind className="h-4 w-4" />,
        colorClass: 'text-purple-400',
        bgClass: 'bg-purple-500/10',
        borderClass: 'border-purple-500/30',
      };
    }

    if (action.includes('VOILE')) {
      return {
        ...log,
        category: 'effect',
        icon: <Eye className="h-4 w-4" />,
        colorClass: 'text-indigo-400',
        bgClass: 'bg-indigo-500/10',
        borderClass: 'border-indigo-500/30',
      };
    }

    if (action.includes('SOIN')) {
      return {
        ...log,
        category: 'heal',
        icon: <Heart className="h-4 w-4" />,
        colorClass: 'text-green-400',
        bgClass: 'bg-green-500/10',
        borderClass: 'border-green-500/30',
      };
    }

    if (action.includes('PENDING') || action.includes('SCHEDULE') || action.includes('MINE')) {
      return {
        ...log,
        category: 'effect',
        icon: <Bomb className="h-4 w-4" />,
        colorClass: 'text-orange-400',
        bgClass: 'bg-orange-500/10',
        borderClass: 'border-orange-500/30',
      };
    }

    if (action.includes('EFFECT') || action.includes('FALLBACK')) {
      return {
        ...log,
        category: 'effect',
        icon: <Zap className="h-4 w-4" />,
        colorClass: 'text-yellow-400',
        bgClass: 'bg-yellow-500/10',
        borderClass: 'border-yellow-500/30',
      };
    }

    if (action.includes('CONSO') || action.includes('INVENTAIRE')) {
      return {
        ...log,
        category: 'inventory',
        icon: <Package className="h-4 w-4" />,
        colorClass: 'text-amber-400',
        bgClass: 'bg-amber-500/10',
        borderClass: 'border-amber-500/30',
      };
    }

    if (action.includes('REMPLACEMENT')) {
      return {
        ...log,
        category: 'system',
        icon: <ArrowRight className="h-4 w-4" />,
        colorClass: 'text-cyan-400',
        bgClass: 'bg-cyan-500/10',
        borderClass: 'border-cyan-500/30',
      };
    }

    return {
      ...log,
      category: 'system',
      icon: <Target className="h-4 w-4" />,
      colorClass: 'text-muted-foreground',
      bgClass: 'bg-muted/30',
      borderClass: 'border-border/50',
    };
  };

  const parsedLogs = useMemo(() => {
    return filteredLogs.map(categorizeLog);
  }, [filteredLogs]);

  const groupedLogs = useMemo(() => {
    const groups: Record<LogCategory, ParsedLog[]> = {
      resolution: [],
      combatData: [],
      kill: [],
      damage: [],
      protection: [],
      effect: [],
      heal: [],
      inventory: [],
      system: [],
    };

    parsedLogs.forEach((log) => {
      groups[log.category].push(log);
    });

    return groups;
  }, [parsedLogs]);

  const categoryLabels: Record<LogCategory, { label: string; icon: React.ReactNode }> = {
    resolution: { label: 'Résumé des actions', icon: <Activity className="h-4 w-4 text-primary" /> },
    combatData: { label: 'Effets détaillés (DOT, Voile, Mine...)', icon: <Zap className="h-4 w-4 text-orange-400" /> },
    kill: { label: 'Éliminations', icon: <Skull className="h-4 w-4 text-amber-400" /> },
    damage: { label: 'Dégâts infligés', icon: <Swords className="h-4 w-4 text-red-400" /> },
    protection: { label: 'Protections & Annulations', icon: <Shield className="h-4 w-4 text-blue-400" /> },
    effect: { label: 'Effets spéciaux', icon: <Zap className="h-4 w-4 text-yellow-400" /> },
    heal: { label: 'Soins', icon: <Heart className="h-4 w-4 text-green-400" /> },
    inventory: { label: 'Consommation inventaire', icon: <Package className="h-4 w-4 text-amber-400" /> },
    system: { label: 'Autres événements', icon: <Target className="h-4 w-4 text-muted-foreground" /> },
  };

  const handleCopyLogs = async () => {
    const logsText = filteredLogs
      .map(
        (log) =>
          `[${log.timestamp ? format(new Date(log.timestamp), 'HH:mm:ss') : '??:??:??'}] ${
            log.num_joueur ? `P${log.num_joueur}` : ''
          } ${log.action}: ${log.details || ''}`
      )
      .join('\n');

    try {
      await navigator.clipboard.writeText(logsText);
      setCopied(true);
      toast.success('Logs copiés !');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Erreur lors de la copie');
    }
  };

  const toggleSection = (category: LogCategory) => {
    setExpandedSections((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  // Render a resolution log with parsed data
  const renderResolutionLog = (log: ParsedLog) => {
    const data = log.parsedResolution;
    
    if (!data) {
      // Fallback to simple display if parsing failed
      return renderLogEntry(log);
    }

    return (
      <div
        key={log.id}
        className="rounded-lg border border-primary/30 bg-primary/5 overflow-hidden"
      >
        {/* Header */}
        <div className="p-3 bg-primary/10 border-b border-primary/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">Résolution Combat</span>
          </div>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {log.timestamp ? format(new Date(log.timestamp), 'HH:mm:ss', { locale: fr }) : '??:??:??'}
          </span>
        </div>

        {/* Stats summary */}
        <div className="p-3 grid grid-cols-3 gap-3 border-b border-border/50">
          <div className="text-center p-2 rounded bg-red-500/10 border border-red-500/20">
            <Swords className="h-4 w-4 mx-auto mb-1 text-red-400" />
            <div className="text-lg font-bold text-red-400">{data.totalDamage}</div>
            <div className="text-xs text-muted-foreground">Dégâts totaux</div>
          </div>
          <div className="text-center p-2 rounded bg-amber-500/10 border border-amber-500/20">
            <Skull className="h-4 w-4 mx-auto mb-1 text-amber-400" />
            <div className="text-lg font-bold text-amber-400">{data.kills.length}</div>
            <div className="text-xs text-muted-foreground">Éliminations</div>
          </div>
          <div className="text-center p-2 rounded bg-green-500/10 border border-green-500/20">
            <Trophy className="h-4 w-4 mx-auto mb-1 text-green-400" />
            <div className="text-lg font-bold text-green-400">{data.totalRewards}</div>
            <div className="text-xs text-muted-foreground">Récompenses</div>
          </div>
        </div>

        {/* Actions list */}
        {data.actions.length > 0 && (
          <div className="p-3 border-b border-border/50">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Actions des joueurs
              </span>
            </div>
            <div className="space-y-1">
              {data.actions.map((action, idx) => (
                <div
                  key={idx}
                  className={`p-2 rounded text-sm flex items-center justify-between ${
                    action.cancelled
                      ? 'bg-destructive/10 border border-destructive/20'
                      : 'bg-secondary/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      #{action.position}
                    </Badge>
                    <span className="font-medium">{action.nom}</span>
                    {action.weapons.length > 0 && (
                      <span className="text-muted-foreground text-xs">
                        ({action.weapons.join(' + ')})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {action.cancelled ? (
                      <span className="text-destructive text-xs flex items-center gap-1">
                        <Ban className="h-3 w-3" />
                        {action.cancelReason || 'Annulée'}
                      </span>
                    ) : (
                      <span className="text-green-500 text-xs flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        {action.totalDamage} dégâts
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Kills */}
        {data.kills.length > 0 && (
          <div className="p-3 border-b border-border/50">
            <div className="flex items-center gap-2 mb-2">
              <Skull className="h-4 w-4 text-amber-400" />
              <span className="text-xs font-medium text-amber-400 uppercase tracking-wide">
                Coups de grâce
              </span>
            </div>
            <div className="space-y-1">
              {data.kills.map((kill, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded bg-amber-500/10 border border-amber-500/30 text-sm"
                >
                  <span className="font-bold text-amber-400">{kill.killerName}</span>
                  {' a éliminé '}
                  <span className="font-bold text-red-400">{kill.monsterName}</span>
                  {' (Slot {kill.slot}) '}
                  <Badge variant="outline" className="text-xs ml-2 text-green-400 border-green-400/50">
                    +{kill.reward} jetons
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Forest state */}
        {data.forestState && (
          <div className="p-3 bg-green-500/5">
            <div className="flex items-center gap-2 text-sm">
              <TreePine className="h-4 w-4 text-green-500" />
              <span className="text-green-400">
                État de la forêt : {data.forestState.totalPvRemaining} PV restants
              </span>
              {data.forestState.monstersKilled > 0 && (
                <Badge variant="outline" className="text-xs text-amber-400 border-amber-400/50">
                  {data.forestState.monstersKilled} monstre(s) éliminé(s)
                </Badge>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render a COMBAT_DATA log with detailed effects
  const renderCombatDataLog = (log: ParsedLog) => {
    const data = log.parsedCombatData;
    
    if (!data) {
      return renderLogEntry(log);
    }

    const hasDotEffects = data.dotEffects.length > 0;
    const hasVoilePenalties = data.voilePenalties.length > 0;
    const hasBerserkerPenalties = data.berserkerPenalties.length > 0;
    const hasKills = data.kills.length > 0;
    const hasRewards = data.rewards.length > 0;
    const hasMineEffects = data.mineEffects.length > 0;
    const hasAmuletteEffects = data.amuletteEffects.length > 0;

    const hasAnyEffect = hasDotEffects || hasVoilePenalties || hasBerserkerPenalties || 
                         hasKills || hasRewards || hasMineEffects || hasAmuletteEffects;

    if (!hasAnyEffect) {
      return (
        <div
          key={log.id}
          className="p-3 rounded-lg border border-border/50 bg-muted/20 text-center text-sm text-muted-foreground"
        >
          <Clock className="h-4 w-4 inline mr-2" />
          Aucun effet spécial ce tour
          <span className="ml-2 text-xs">
            {log.timestamp ? format(new Date(log.timestamp), 'HH:mm:ss', { locale: fr }) : ''}
          </span>
        </div>
      );
    }

    return (
      <div
        key={log.id}
        className="rounded-lg border border-orange-500/30 bg-orange-500/5 overflow-hidden"
      >
        {/* Header */}
        <div className="p-2 bg-orange-500/10 border-b border-orange-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-orange-400" />
            <span className="font-medium text-sm text-orange-400">Effets détaillés</span>
          </div>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {log.timestamp ? format(new Date(log.timestamp), 'HH:mm:ss', { locale: fr }) : '??:??:??'}
          </span>
        </div>

        <div className="p-3 space-y-3">
          {/* DOT Effects - Most important for the user's question */}
          {hasDotEffects && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-1">
                <Bomb className="h-4 w-4 text-red-400" />
                <span className="text-xs font-medium text-red-400 uppercase tracking-wide">
                  Dégâts de zone (DOT)
                </span>
              </div>
              {data.dotEffects.map((effect, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded bg-red-500/10 border border-red-500/20 text-sm flex items-start gap-2"
                >
                  <Swords className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
                  <span>{effect}</span>
                </div>
              ))}
            </div>
          )}

          {/* Mine Effects */}
          {hasMineEffects && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-1">
                <Bomb className="h-4 w-4 text-orange-400" />
                <span className="text-xs font-medium text-orange-400 uppercase tracking-wide">
                  Explosions de mines
                </span>
              </div>
              {data.mineEffects.map((effect, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded bg-orange-500/10 border border-orange-500/20 text-sm"
                >
                  {effect}
                </div>
              ))}
            </div>
          )}

          {/* Voile penalties */}
          {hasVoilePenalties && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-1">
                <Eye className="h-4 w-4 text-indigo-400" />
                <span className="text-xs font-medium text-indigo-400 uppercase tracking-wide">
                  Pénalités Voile du Gardien
                </span>
              </div>
              {data.voilePenalties.map((penalty, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded bg-indigo-500/10 border border-indigo-500/20 text-sm flex items-center justify-between"
                >
                  <span>{penalty.playerName}</span>
                  <Badge variant="outline" className="text-xs text-red-400 border-red-400/50">
                    -{penalty.tokens} jetons
                  </Badge>
                </div>
              ))}
            </div>
          )}

          {/* Berserker penalties */}
          {hasBerserkerPenalties && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-1">
                <Swords className="h-4 w-4 text-purple-400" />
                <span className="text-xs font-medium text-purple-400 uppercase tracking-wide">
                  Pénalités Berseker
                </span>
              </div>
              {data.berserkerPenalties.map((penalty, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded bg-purple-500/10 border border-purple-500/20 text-sm flex items-center justify-between"
                >
                  <span>Joueur #{penalty.playerNum}</span>
                  <Badge variant="outline" className="text-xs text-red-400 border-red-400/50">
                    -{penalty.tokens} jetons
                  </Badge>
                </div>
              ))}
            </div>
          )}

          {/* Amulette effects */}
          {hasAmuletteEffects && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="h-4 w-4 text-cyan-400" />
                <span className="text-xs font-medium text-cyan-400 uppercase tracking-wide">
                  Effets Amulette
                </span>
              </div>
              {data.amuletteEffects.map((effect, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded bg-cyan-500/10 border border-cyan-500/20 text-sm"
                >
                  Joueur #{effect.playerNum}: multiplicateur x{effect.multiplier}
                </div>
              ))}
            </div>
          )}

          {/* Kills from this data */}
          {hasKills && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-1">
                <Skull className="h-4 w-4 text-amber-400" />
                <span className="text-xs font-medium text-amber-400 uppercase tracking-wide">
                  Éliminations
                </span>
              </div>
              {data.kills.map((kill, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-sm flex items-center justify-between"
                >
                  <span>
                    <span className="font-bold text-amber-400">{kill.killerName}</span>
                    {' → '}
                    <span className="font-bold text-red-400">{kill.monsterName}</span>
                  </span>
                  <Badge variant="outline" className="text-xs text-green-400 border-green-400/50">
                    +{kill.reward} jetons
                  </Badge>
                </div>
              ))}
            </div>
          )}

          {/* Rewards */}
          {hasRewards && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-1">
                <Trophy className="h-4 w-4 text-green-400" />
                <span className="text-xs font-medium text-green-400 uppercase tracking-wide">
                  Récompenses distribuées
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {data.rewards.map((reward, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs text-green-400 border-green-400/50">
                    P{reward.playerNum}: +{reward.reward} jetons
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderLogEntry = (log: ParsedLog) => (
    <div
      key={log.id}
      className={`p-2 rounded-md ${log.bgClass} border ${log.borderClass} flex items-start justify-between gap-2`}
    >
      <div className="flex items-start gap-2 flex-1 min-w-0">
        <span className={`shrink-0 mt-0.5 ${log.colorClass}`}>{log.icon}</span>
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {log.num_joueur && (
              <Badge variant="outline" className="text-xs shrink-0">
                P{log.num_joueur}
              </Badge>
            )}
            <Badge className={`text-xs ${log.bgClass} ${log.colorClass} border ${log.borderClass}`}>
              {log.action}
            </Badge>
          </div>
          <span className="text-sm text-foreground break-words">{log.details || '-'}</span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0 mt-0.5">
        <Clock className="h-3 w-3" />
        {log.timestamp ? format(new Date(log.timestamp), 'HH:mm:ss', { locale: fr }) : '??:??:??'}
      </span>
    </div>
  );

  const renderSection = (category: LogCategory, logsInCategory: ParsedLog[]) => {
    if (logsInCategory.length === 0) return null;

    const isExpanded = expandedSections[category];
    const { label, icon } = categoryLabels[category];

    return (
      <Collapsible key={category} open={isExpanded} onOpenChange={() => toggleSection(category)}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors group">
            <div className="flex items-center gap-2">
              {icon}
              <span className="font-medium text-sm">{label}</span>
              <Badge variant="secondary" className="text-xs">
                {logsInCategory.length}
              </Badge>
            </div>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            )}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-2 mt-2 pl-2 border-l-2 border-border ml-2">
            {category === 'resolution'
              ? logsInCategory.map(renderResolutionLog)
              : category === 'combatData'
                ? logsInCategory.map(renderCombatDataLog)
                : logsInCategory.map(renderLogEntry)}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <div className={`card-gradient rounded-lg border border-border ${className}`}>
      <div className="p-4 border-b border-border">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h3 className="font-display text-lg">Logs combat détaillés (MJ)</h3>
          </div>

          <div className="flex items-center gap-3">
            <Select value={selectedManche} onValueChange={setSelectedManche}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Manche {currentManche} (actuelle)</SelectItem>
                {availableManches
                  .filter((m) => m !== currentManche)
                  .map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      Manche {m}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            <ForestButton
              variant="outline"
              size="sm"
              onClick={handleCopyLogs}
              disabled={filteredLogs.length === 0}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </ForestButton>
          </div>
        </div>
      </div>

      <div className="p-4">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-muted-foreground text-sm">Aucun log de combat pour cette manche</p>
          </div>
        ) : (
          <ScrollArea className="h-[500px] pr-2">
            <div className="space-y-3">
              {renderSection('resolution', groupedLogs.resolution)}
              {renderSection('combatData', groupedLogs.combatData)}
              {renderSection('kill', groupedLogs.kill)}
              {renderSection('damage', groupedLogs.damage)}
              {renderSection('protection', groupedLogs.protection)}
              {renderSection('effect', groupedLogs.effect)}
              {renderSection('heal', groupedLogs.heal)}
              {renderSection('inventory', groupedLogs.inventory)}
              {renderSection('system', groupedLogs.system)}
            </div>
          </ScrollArea>
        )}
      </div>

      <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground flex items-center justify-between">
        <span>
          {filteredLogs.length} log(s) de combat pour la manche {displayManche}
        </span>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <Activity className="h-3 w-3 text-primary" />
            {groupedLogs.resolution.length}
          </span>
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3 text-orange-400" />
            {groupedLogs.combatData.length}
          </span>
          <span className="flex items-center gap-1">
            <Skull className="h-3 w-3 text-amber-400" />
            {groupedLogs.kill.length}
          </span>
          <span className="flex items-center gap-1">
            <Swords className="h-3 w-3 text-red-400" />
            {groupedLogs.damage.length}
          </span>
          <span className="flex items-center gap-1">
            <Shield className="h-3 w-3 text-blue-400" />
            {groupedLogs.protection.length}
          </span>
        </div>
      </div>
    </div>
  );
}
