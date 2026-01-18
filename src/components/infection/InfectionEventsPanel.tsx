import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Activity, Bell } from 'lucide-react';

interface GameEvent {
  id: string;
  event_type: string;
  message: string;
  manche: number;
  created_at: string;
  visibility: string;
}

interface InfectionEventsPanelProps {
  gameId: string;
  sessionGameId: string;
}

export function InfectionEventsPanel({
  gameId,
  sessionGameId,
}: InfectionEventsPanelProps) {
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();

    const channel = supabase
      .channel(`infection-events-${sessionGameId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'game_events',
          filter: `session_game_id=eq.${sessionGameId}`,
        },
        (payload) => {
          const newEvent = payload.new as GameEvent;
          if (newEvent.visibility === 'PUBLIC') {
            setEvents(prev => [newEvent, ...prev]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionGameId]);

  const fetchEvents = async () => {
    const { data, error } = await supabase
      .from('game_events')
      .select('*')
      .eq('session_game_id', sessionGameId)
      .eq('visibility', 'PUBLIC')
      .order('created_at', { ascending: false })
      .limit(50);

    if (data) {
      setEvents(data as GameEvent[]);
    }
    setLoading(false);
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case 'GAME_START':
      case 'ROUND_START':
        return '#D4AF37';
      case 'DEATH':
        return '#B00020';
      case 'VICTORY':
        return '#2AB3A6';
      default:
        return '#9CA3AF';
    }
  };

  return (
    <div className="space-y-2">
      {loading ? (
        <p className="text-center text-[#6B7280] py-8">Chargement...</p>
      ) : events.length === 0 ? (
        <div className="text-center text-[#6B7280] py-8">
          <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Aucun événement pour le moment.</p>
        </div>
      ) : (
        events.map((event) => (
          <div
            key={event.id}
            className="p-3 bg-[#1A2235] rounded-lg border-l-4"
            style={{ borderLeftColor: getEventColor(event.event_type) }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-[#6B7280]">
                Manche {event.manche}
              </span>
              <span className="text-xs text-[#6B7280]">
                {new Date(event.created_at).toLocaleTimeString('fr-FR', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </span>
            </div>
            <p className="text-sm text-[#EAEAF2]">{event.message}</p>
          </div>
        ))
      )}
    </div>
  );
}
