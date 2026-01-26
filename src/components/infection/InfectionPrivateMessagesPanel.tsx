import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Mail, Eye, FlaskConical, Syringe, Shield } from 'lucide-react';
import { getInfectionThemeClasses } from './InfectionTheme';

interface PrivateMessage {
  id: string;
  event_type: string;
  message: string;
  manche: number;
  created_at: string;
  payload: Record<string, unknown> | null;
}

interface Player {
  id: string;
  player_number: number | null;
  role_code: string | null;
}

interface InfectionPrivateMessagesPanelProps {
  gameId: string;
  sessionGameId: string;
  player: Player;
}

export function InfectionPrivateMessagesPanel({ 
  gameId, 
  sessionGameId, 
  player 
}: InfectionPrivateMessagesPanelProps) {
  const theme = getInfectionThemeClasses();
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMessages();

    const channel = supabase
      .channel(`private-msgs-${sessionGameId}-${player.player_number}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'game_events',
          filter: `session_game_id=eq.${sessionGameId}`,
        },
        (payload) => {
          const event = payload.new as PrivateMessage & { visibility: string; player_num: number };
          // Only add if it's a private message for this player
          if (event.visibility === 'PRIVATE' && event.player_num === player.player_number) {
            setMessages(prev => [event, ...prev]);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionGameId, player.player_number]);

  const fetchMessages = async () => {
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('game_events')
      .select('id, event_type, message, manche, created_at, payload')
      .eq('session_game_id', sessionGameId)
      .eq('visibility', 'PRIVATE')
      .eq('player_num', player.player_number)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('[PrivateMessages] Fetch error:', fetchError);
      setError(fetchError.message || 'Erreur lors du chargement des messages');
    } else if (data) {
      setMessages(data as PrivateMessage[]);
    }
    setLoading(false);
  };

  const getMessageIcon = (eventType: string) => {
    switch (eventType) {
      case 'OC_REVEAL':
        return <Eye className="h-4 w-4 text-[#E6A23C]" />;
      case 'ANTIBODY_TEST':
        return <FlaskConical className="h-4 w-4 text-[#D4AF37]" />;
      case 'ANTIDOTE_RECEIVED':
        return <Shield className="h-4 w-4 text-[#2AB3A6]" />;
      case 'INFECTION_STATUS':
        return <Syringe className="h-4 w-4 text-[#B00020]" />;
      default:
        return <Mail className="h-4 w-4 text-[#9CA3AF]" />;
    }
  };

  const getMessageColor = (eventType: string) => {
    switch (eventType) {
      case 'OC_REVEAL':
        return '#E6A23C';
      case 'ANTIBODY_TEST':
        return '#D4AF37';
      case 'ANTIDOTE_RECEIVED':
        return '#2AB3A6';
      case 'INFECTION_STATUS':
        return '#B00020';
      default:
        return '#9CA3AF';
    }
  };

  const formatTime = (ts: string) => {
    return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-[#6B7280]">Chargement...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={theme.card}>
        <div className="p-3 border-b border-[#2D3748] flex items-center gap-2">
          <Mail className="h-4 w-4 text-[#D4AF37]" />
          <span className="font-semibold">Messages privés</span>
        </div>
        <div className="p-4 text-center">
          <p className="text-[#B00020] text-sm">⚠️ {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={theme.card}>
      <div className="p-3 border-b border-[#2D3748] flex items-center gap-2">
        <Mail className="h-4 w-4 text-[#D4AF37]" />
        <span className="font-semibold">Messages privés</span>
        {messages.length > 0 && (
          <Badge className="bg-[#D4AF37]/20 text-[#D4AF37] ml-auto">{messages.length}</Badge>
        )}
      </div>
      
      <ScrollArea className="h-[200px]">
        <div className="p-3 space-y-2">
          {messages.length === 0 ? (
            <div className="text-center text-[#6B7280] py-4">
              <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Aucun message privé</p>
            </div>
          ) : (
            messages.map(msg => (
              <div 
                key={msg.id} 
                className="p-3 bg-[#1A2235] rounded-lg border-l-4"
                style={{ borderLeftColor: getMessageColor(msg.event_type) }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getMessageIcon(msg.event_type)}
                    <Badge variant="outline" className="text-xs" style={{ color: getMessageColor(msg.event_type) }}>
                      Manche {msg.manche}
                    </Badge>
                  </div>
                  <span className="text-xs text-[#6B7280]">{formatTime(msg.created_at)}</span>
                </div>
                <p className="text-sm text-[#EAEAF2]">{msg.message}</p>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
