import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ForestButton } from '@/components/ui/ForestButton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, Send, MessageSquare, Eye, EyeOff, 
  Megaphone, Info, Swords, ShoppingCart, Settings,
  Search, Filter
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Game {
  id: string;
}

interface SessionEvent {
  id: string;
  type: string;
  message: string;
  audience: string;
  created_at: string;
  payload: unknown;
}

interface MJEventsTabProps {
  game: Game;
}

const EVENT_TYPES = ['SYSTEM', 'PHASE', 'COMBAT', 'SHOP', 'INFO'];

const TYPE_ICONS: Record<string, React.ReactNode> = {
  SYSTEM: <Settings className="h-4 w-4" />,
  PHASE: <Info className="h-4 w-4" />,
  COMBAT: <Swords className="h-4 w-4" />,
  SHOP: <ShoppingCart className="h-4 w-4" />,
  INFO: <Megaphone className="h-4 w-4" />,
};

export function MJEventsTab({ game }: MJEventsTabProps) {
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  // Filters
  const [filterAudience, setFilterAudience] = useState<'ALL' | 'MJ' | 'BOTH'>('BOTH');
  const [filterType, setFilterType] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // New event form
  const [newAudience, setNewAudience] = useState<'ALL' | 'MJ'>('ALL');
  const [newType, setNewType] = useState('INFO');
  const [newMessage, setNewMessage] = useState('');

  useEffect(() => {
    fetchEvents();

    const channel = supabase
      .channel(`mj-events-${game.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'session_events', filter: `game_id=eq.${game.id}` },
        (payload) => {
          setEvents(prev => [payload.new as SessionEvent, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [game.id]);

  const fetchEvents = async () => {
    const { data, error } = await supabase
      .from('session_events')
      .select('*')
      .eq('game_id', game.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (!error && data) {
      setEvents(data);
    }
    setLoading(false);
  };

  const handlePublish = async () => {
    if (!newMessage.trim()) {
      toast.error('Veuillez saisir un message');
      return;
    }

    setPublishing(true);
    try {
      const { data, error } = await supabase.functions.invoke('publish-event', {
        body: {
          gameId: game.id,
          audience: newAudience,
          type: newType,
          message: newMessage.trim(),
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || 'Erreur lors de la publication');
      }

      toast.success('Évènement publié');
      setNewMessage('');
    } catch (error: any) {
      console.error('Publish error:', error);
      toast.error(error.message || 'Erreur');
    } finally {
      setPublishing(false);
    }
  };

  const filteredEvents = events.filter(event => {
    if (filterAudience !== 'BOTH' && event.audience !== filterAudience) return false;
    if (filterType && event.type !== filterType) return false;
    if (searchQuery && !event.message.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const publicEvents = filteredEvents.filter(e => e.audience === 'ALL');
  const mjEvents = filteredEvents.filter(e => e.audience === 'MJ');

  return (
    <div className="space-y-6">
      {/* Publier un évènement */}
      <div className="card-gradient rounded-lg border border-border p-6">
        <h3 className="font-display text-lg mb-4 flex items-center gap-2">
          <Send className="h-5 w-5 text-primary" />
          Publier un évènement
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="space-y-2">
            <Label>Audience</Label>
            <Select value={newAudience} onValueChange={(v) => setNewAudience(v as 'ALL' | 'MJ')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">
                  <span className="flex items-center gap-2">
                    <Eye className="h-4 w-4" /> Public (tous les joueurs)
                  </span>
                </SelectItem>
                <SelectItem value="MJ">
                  <span className="flex items-center gap-2">
                    <EyeOff className="h-4 w-4" /> MJ uniquement
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={newType} onValueChange={setNewType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map(type => (
                  <SelectItem key={type} value={type}>
                    <span className="flex items-center gap-2">
                      {TYPE_ICONS[type]} {type}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <ForestButton
              onClick={handlePublish}
              disabled={publishing || !newMessage.trim()}
              className="w-full"
            >
              {publishing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Publier
            </ForestButton>
          </div>
        </div>

        <Textarea
          placeholder="Saisissez votre message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          rows={3}
        />
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterAudience} onValueChange={(v) => setFilterAudience(v as any)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="BOTH">Tous</SelectItem>
              <SelectItem value="ALL">Public</SelectItem>
              <SelectItem value="MJ">MJ</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Select value={filterType || 'all'} onValueChange={(v) => setFilterType(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous types</SelectItem>
            {EVENT_TYPES.map(type => (
              <SelectItem key={type} value={type}>{type}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Liste des évènements */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Public events */}
          <div className="card-gradient rounded-lg border border-border p-4">
            <h4 className="font-display text-sm mb-3 flex items-center gap-2">
              <Eye className="h-4 w-4 text-green-500" />
              Évènements publics ({publicEvents.length})
            </h4>
            
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {publicEvents.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">
                  Aucun évènement public
                </p>
              ) : (
                publicEvents.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))
              )}
            </div>
          </div>

          {/* MJ events */}
          <div className="card-gradient rounded-lg border border-amber-500/30 p-4">
            <h4 className="font-display text-sm mb-3 flex items-center gap-2">
              <EyeOff className="h-4 w-4 text-amber-500" />
              Évènements MJ ({mjEvents.length})
            </h4>
            
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {mjEvents.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">
                  Aucun évènement MJ
                </p>
              ) : (
                mjEvents.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EventCard({ event }: { event: SessionEvent }) {
  return (
    <div className="p-3 bg-secondary/50 rounded-lg">
      <div className="flex items-start gap-2">
        <div className="text-muted-foreground mt-0.5">
          {TYPE_ICONS[event.type] || <MessageSquare className="h-4 w-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm">{event.message}</p>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-xs">
              {event.type}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(event.created_at), { addSuffix: true, locale: fr })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
