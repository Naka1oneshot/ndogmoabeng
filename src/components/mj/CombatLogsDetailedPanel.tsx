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
  AlertTriangle,
  ArrowRight,
  Bomb,
  Wind,
  Eye,
  ChevronDown,
  ChevronUp,
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

type LogCategory = 'damage' | 'protection' | 'heal' | 'kill' | 'effect' | 'inventory' | 'system';

interface ParsedLog extends CombatLog {
  category: LogCategory;
  icon: React.ReactNode;
  colorClass: string;
  bgClass: string;
  borderClass: string;
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
    damage: true,
    protection: true,
    kill: true,
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
      icon: <AlertTriangle className="h-4 w-4" />,
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
    kill: { label: 'Éliminations', icon: <Skull className="h-4 w-4 text-amber-400" /> },
    damage: { label: 'Dégâts infligés', icon: <Swords className="h-4 w-4 text-red-400" /> },
    protection: { label: 'Protections & Annulations', icon: <Shield className="h-4 w-4 text-blue-400" /> },
    effect: { label: 'Effets spéciaux', icon: <Zap className="h-4 w-4 text-yellow-400" /> },
    heal: { label: 'Soins', icon: <Heart className="h-4 w-4 text-green-400" /> },
    inventory: { label: 'Consommation inventaire', icon: <Package className="h-4 w-4 text-amber-400" /> },
    system: { label: 'Système', icon: <AlertTriangle className="h-4 w-4 text-muted-foreground" /> },
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
          <div className="space-y-1 mt-2 pl-2 border-l-2 border-border ml-2">
            {logsInCategory.map(renderLogEntry)}
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
          <ScrollArea className="h-[400px] pr-2">
            <div className="space-y-3">
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
