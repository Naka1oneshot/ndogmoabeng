import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Loader2, Info, Zap, ShoppingBag, Swords, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface SessionEvent {
  id: string;
  type: string;
  message: string;
  created_at: string;
  payload?: unknown;
}

interface EventsFeedProps {
  gameId: string;
  className?: string;
}

const typeIcons: Record<string, React.ReactNode> = {
  SYSTEM: <Info className="h-4 w-4 text-blue-400" />,
  PHASE: <Zap className="h-4 w-4 text-amber-400" />,
  COMBAT: <Swords className="h-4 w-4 text-red-400" />,
  SHOP: <ShoppingBag className="h-4 w-4 text-green-400" />,
  INFO: <MessageSquare className="h-4 w-4 text-primary" />,
  ADMIN: <AlertCircle className="h-4 w-4 text-purple-400" />,
};

export function EventsFeed({ gameId, className }: EventsFeedProps) {
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isUserScrolling = useRef(false);

  useEffect(() => {
    fetchEvents();

    const channel = supabase
      .channel(`events-${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'session_events',
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          const newEvent = payload.new as SessionEvent;
          // Only show public events (audience = 'ALL')
          if ((payload.new as { audience?: string }).audience === 'ALL') {
            setEvents((prev) => [newEvent, ...prev]);
            
            // Auto-scroll to top if user isn't scrolling
            if (!isUserScrolling.current && scrollRef.current) {
              scrollRef.current.scrollTop = 0;
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  const fetchEvents = async () => {
    const { data, error } = await supabase
      .from('session_events')
      .select('id, type, message, created_at, payload')
      .eq('game_id', gameId)
      .eq('audience', 'ALL')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      setEvents(data);
    }
    setLoading(false);
  };

  const handleScroll = () => {
    if (scrollRef.current) {
      isUserScrolling.current = scrollRef.current.scrollTop > 10;
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className={`card-gradient rounded-lg border border-border flex flex-col overflow-hidden ${className}`}>
      <div className="p-3 border-b border-border flex items-center gap-2 flex-shrink-0">
        <MessageSquare className="h-4 w-4 text-primary" />
        <h3 className="font-display text-sm">Événements</h3>
      </div>
      
      <ScrollArea 
        className="flex-1 min-h-0"
        onScroll={handleScroll}
        ref={scrollRef}
      >
        <div className="p-3 space-y-2">
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucun événement pour le moment
            </p>
          ) : (
            events.map((event) => (
              <div
                key={event.id}
                className="p-2 rounded bg-secondary/30 hover:bg-secondary/50 transition-colors"
              >
                <div className="flex items-start gap-2">
                  <div className="mt-0.5">
                    {typeIcons[event.type] || typeIcons.INFO}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm break-words">{event.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(event.created_at), {
                        addSuffix: true,
                        locale: fr,
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}