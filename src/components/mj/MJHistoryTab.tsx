import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { History, Calendar, Clock, User, Zap, ShoppingCart, Swords, Trophy } from 'lucide-react';

interface GameEvent {
  id: string;
  manche: number;
  phase: string;
  visibility: string;
  event_type: string;
  player_id: string | null;
  player_num: number | null;
  message: string;
  payload: Record<string, unknown> | null;
  created_at: string;
}

interface MJHistoryTabProps {
  gameId: string;
  currentManche: number;
}

const PHASES = [
  { value: 'PHASE1_MISES', label: 'Phase 1 - Mises' },
  { value: 'PHASE2_POSITIONS', label: 'Phase 2 - Positions' },
  { value: 'PHASE3_SHOP', label: 'Phase 3 - Shop' },
  { value: 'COMBAT', label: 'Combat' },
  { value: 'FIN_MANCHE', label: 'Fin de manche' },
];

const EVENT_ICONS: Record<string, React.ReactNode> = {
  'MISE_VALIDEE': <Trophy className="h-4 w-4 text-yellow-500" />,
  'PRIORITE_CALCULEE': <Trophy className="h-4 w-4 text-amber-500" />,
  'POSITIONS_FINALES': <User className="h-4 w-4 text-blue-500" />,
  'SHOP_GEN': <ShoppingCart className="h-4 w-4 text-green-500" />,
  'SHOP_BUY_OK': <ShoppingCart className="h-4 w-4 text-emerald-500" />,
  'SHOP_BUY_REFUS': <ShoppingCart className="h-4 w-4 text-red-500" />,
  'DEGATS': <Swords className="h-4 w-4 text-red-500" />,
  'SOIN': <Zap className="h-4 w-4 text-green-500" />,
  'KILL': <Swords className="h-4 w-4 text-destructive" />,
  'FIN_MANCHE': <Calendar className="h-4 w-4 text-purple-500" />,
};

export function MJHistoryTab({ gameId, currentManche }: MJHistoryTabProps) {
  const [selectedManche, setSelectedManche] = useState<string>(String(currentManche));
  const [selectedPhase, setSelectedPhase] = useState<string>('PHASE1_MISES');
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [availableManches, setAvailableManches] = useState<number[]>([]);

  // Fetch available manches
  useEffect(() => {
    const fetchManches = async () => {
      const { data } = await supabase
        .from('game_events')
        .select('manche')
        .eq('game_id', gameId)
        .order('manche', { ascending: true });

      if (data) {
        const uniqueManches = [...new Set(data.map(e => e.manche))];
        // Always include at least manche 1 to currentManche
        const allManches = Array.from({ length: currentManche }, (_, i) => i + 1);
        const combined = [...new Set([...allManches, ...uniqueManches])].sort((a, b) => a - b);
        setAvailableManches(combined);
      } else {
        setAvailableManches(Array.from({ length: currentManche }, (_, i) => i + 1));
      }
    };

    fetchManches();
  }, [gameId, currentManche]);

  // Fetch events when selection changes
  useEffect(() => {
    const fetchEvents = async () => {
      if (!selectedManche || !selectedPhase) return;

      setLoading(true);
      const { data, error } = await supabase
        .from('game_events')
        .select('*')
        .eq('game_id', gameId)
        .eq('manche', parseInt(selectedManche))
        .eq('phase', selectedPhase)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching history events:', error);
      } else {
        setEvents((data as GameEvent[]) || []);
      }
      setLoading(false);
    };

    fetchEvents();
  }, [gameId, selectedManche, selectedPhase]);

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getEventIcon = (eventType: string) => {
    return EVENT_ICONS[eventType] || <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  const getVisibilityBadge = (visibility: string) => {
    if (visibility === 'PUBLIC') {
      return <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/30">PUBLIC</Badge>;
    }
    return <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30">MJ</Badge>;
  };

  const renderPayloadDetails = (event: GameEvent) => {
    if (!event.payload) return null;

    const payload = event.payload;

    // Render different layouts based on event type
    switch (event.event_type) {
      case 'PRIORITE_CALCULEE':
        if (Array.isArray(payload.classement)) {
          return (
            <div className="mt-2 pl-4 border-l-2 border-muted">
              <p className="text-xs text-muted-foreground mb-1">Classement :</p>
              <ul className="text-sm space-y-0.5">
                {payload.classement.map((item: { rank: number; name: string; mise?: number }, idx: number) => (
                  <li key={idx} className="flex items-center gap-2">
                    <span className="font-medium">#{item.rank}</span>
                    <span>{item.name}</span>
                    {item.mise !== undefined && (
                      <span className="text-muted-foreground">(mise: {item.mise})</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        }
        break;

      case 'SHOP_GEN':
        if (Array.isArray(payload.items)) {
          return (
            <div className="mt-2 pl-4 border-l-2 border-muted">
              <p className="text-xs text-muted-foreground mb-1">Objets proposés :</p>
              <ul className="text-sm space-y-0.5">
                {payload.items.map((item: string, idx: number) => (
                  <li key={idx}>• {item}</li>
                ))}
              </ul>
            </div>
          );
        }
        break;

      case 'SHOP_BUY_OK':
      case 'SHOP_BUY_REFUS':
        return (
          <div className="mt-2 pl-4 border-l-2 border-muted text-sm">
            {payload.item && <p>Objet : {String(payload.item)}</p>}
            {payload.cost !== undefined && <p>Coût : {String(payload.cost)} jetons</p>}
            {payload.reason && <p className="text-destructive">Raison : {String(payload.reason)}</p>}
          </div>
        );

      case 'DEGATS':
      case 'SOIN':
        return (
          <div className="mt-2 pl-4 border-l-2 border-muted text-sm">
            {payload.cible && <p>Cible : {String(payload.cible)}</p>}
            {payload.montant !== undefined && <p>Montant : {String(payload.montant)}</p>}
            {payload.arme && <p>Arme : {String(payload.arme)}</p>}
          </div>
        );

      default:
        // Generic JSON display for unknown types
        return (
          <details className="mt-2">
            <summary className="text-xs text-muted-foreground cursor-pointer">Voir les détails</summary>
            <pre className="mt-1 text-xs bg-muted/50 p-2 rounded overflow-auto max-h-32">
              {JSON.stringify(payload, null, 2)}
            </pre>
          </details>
        );
    }

    return null;
  };

  return (
    <Card className="bg-card/95 backdrop-blur">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <History className="h-5 w-5 text-primary" />
          Historique de la partie
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Consultez les événements passés sans impacter la partie en cours (lecture seule)
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Selection controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="text-sm font-medium mb-1.5 block">Manche</label>
            <Select value={selectedManche} onValueChange={setSelectedManche}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une manche" />
              </SelectTrigger>
              <SelectContent>
                {availableManches.map((manche) => (
                  <SelectItem key={manche} value={String(manche)}>
                    Manche {manche}
                    {manche === currentManche && ' (en cours)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1">
            <label className="text-sm font-medium mb-1.5 block">Phase</label>
            <Select value={selectedPhase} onValueChange={setSelectedPhase}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une phase" />
              </SelectTrigger>
              <SelectContent>
                {PHASES.map((phase) => (
                  <SelectItem key={phase.value} value={phase.value}>
                    {phase.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        {/* Events timeline */}
        <div>
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Chronologie des événements
          </h4>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Chargement...
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucun événement enregistré pour cette manche/phase.
            </div>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="p-3 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {getEventIcon(event.event_type)}
                        <span className="font-medium text-sm">{event.message}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {getVisibilityBadge(event.visibility)}
                        <span className="text-xs text-muted-foreground">
                          {formatTime(event.created_at)}
                        </span>
                      </div>
                    </div>

                    {event.player_num && (
                      <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                        <User className="h-3 w-3" />
                        Joueur {event.player_num}
                      </div>
                    )}

                    {renderPayloadDetails(event)}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Summary stats */}
        {events.length > 0 && (
          <>
            <Separator />
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{events.length} événement(s) trouvé(s)</span>
              <span>
                Du {formatTime(events[0].created_at)} au {formatTime(events[events.length - 1].created_at)}
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
