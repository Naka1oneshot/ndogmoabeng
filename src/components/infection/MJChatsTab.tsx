import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Users, Syringe, FlaskConical } from 'lucide-react';
import { getInfectionThemeClasses } from './InfectionTheme';

interface ChatMessage {
  id: string;
  author_name: string;
  author_num: number;
  message: string;
  channel_type: string;
  channel_key: string;
  created_at: string | null;
  manche: number | null;
}

interface Player {
  id: string;
  display_name: string;
  player_number: number | null;
  role_code: string | null;
}

interface MJChatsTabProps {
  gameId: string;
  sessionGameId: string;
  players: Player[];
}

export function MJChatsTab({ gameId, sessionGameId, players }: MJChatsTabProps) {
  const theme = getInfectionThemeClasses();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeChannel, setActiveChannel] = useState('PUBLIC');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages();

    const channel = supabase
      .channel(`mj-chats-${sessionGameId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'infection_chat_messages', 
        filter: `session_game_id=eq.${sessionGameId}` 
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as ChatMessage]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionGameId]);

  useEffect(() => {
    // Auto-scroll on new messages
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, activeChannel]);

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('infection_chat_messages')
      .select('*')
      .eq('session_game_id', sessionGameId)
      .order('created_at', { ascending: true });

    if (data) setMessages(data);
  };

  const getChannelMessages = (channelType: string) => {
    return messages.filter(m => m.channel_type === channelType);
  };

  const formatTime = (ts: string | null) => {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const getPlayerRole = (num: number) => {
    const p = players.find(pl => pl.player_number === num);
    return p?.role_code || null;
  };

  const getRoleColor = (role: string | null) => {
    switch (role) {
      case 'PV': return '#B00020';
      case 'BA': return '#6B21A8';
      case 'SY': return '#2AB3A6';
      case 'OC': return '#E6A23C';
      case 'AE': return '#3B82F6';
      case 'CV': return '#6B7280';
      case 'KK': return '#D4AF37';
      default: return '#9CA3AF';
    }
  };

  const publicMessages = getChannelMessages('PUBLIC');
  const pvMessages = getChannelMessages('PV');
  const syMessages = getChannelMessages('SY');

  return (
    <div className="space-y-4">
      <Tabs value={activeChannel} onValueChange={setActiveChannel}>
        <TabsList className="w-full bg-[#121A2B] border-b border-[#2D3748] rounded-none">
          <TabsTrigger value="PUBLIC" className="flex-1 data-[state=active]:bg-[#1A2235]">
            <Users className="h-3 w-3 mr-1" />
            Public ({publicMessages.length})
          </TabsTrigger>
          <TabsTrigger value="PV" className="flex-1 data-[state=active]:bg-[#1A2235]">
            <Syringe className="h-3 w-3 mr-1 text-[#B00020]" />
            PV ({pvMessages.length})
          </TabsTrigger>
          <TabsTrigger value="SY" className="flex-1 data-[state=active]:bg-[#1A2235]">
            <FlaskConical className="h-3 w-3 mr-1 text-[#2AB3A6]" />
            SY ({syMessages.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="PUBLIC" className="mt-0">
          <ChatView 
            messages={publicMessages} 
            getPlayerRole={getPlayerRole}
            getRoleColor={getRoleColor}
            formatTime={formatTime}
            theme={theme}
            scrollRef={scrollRef}
            emptyText="Aucun message public"
          />
        </TabsContent>

        <TabsContent value="PV" className="mt-0">
          <ChatView 
            messages={pvMessages} 
            getPlayerRole={getPlayerRole}
            getRoleColor={getRoleColor}
            formatTime={formatTime}
            theme={theme}
            scrollRef={scrollRef}
            emptyText="Aucun message dans le canal PV"
            channelColor="#B00020"
          />
        </TabsContent>

        <TabsContent value="SY" className="mt-0">
          <ChatView 
            messages={syMessages} 
            getPlayerRole={getPlayerRole}
            getRoleColor={getRoleColor}
            formatTime={formatTime}
            theme={theme}
            scrollRef={scrollRef}
            emptyText="Aucun message dans le canal SY"
            channelColor="#2AB3A6"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface ChatViewProps {
  messages: ChatMessage[];
  getPlayerRole: (num: number) => string | null;
  getRoleColor: (role: string | null) => string;
  formatTime: (ts: string | null) => string;
  theme: ReturnType<typeof getInfectionThemeClasses>;
  scrollRef: React.RefObject<HTMLDivElement>;
  emptyText: string;
  channelColor?: string;
}

function ChatView({ messages, getPlayerRole, getRoleColor, formatTime, theme, scrollRef, emptyText, channelColor }: ChatViewProps) {
  return (
    <div className={theme.card}>
      <ScrollArea className="h-[400px]" ref={scrollRef}>
        <div className="p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="text-center text-[#6B7280] py-8">{emptyText}</div>
          ) : (
            messages.map(msg => {
              const role = getPlayerRole(msg.author_num);
              const isSystem = msg.author_num === 0;
              
              return (
                <div 
                  key={msg.id} 
                  className={`p-3 rounded-lg ${isSystem ? 'bg-[#2D3748]/50 border border-[#4A5568]' : 'bg-[#1A2235]'}`}
                  style={channelColor ? { borderLeft: `3px solid ${channelColor}` } : {}}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {isSystem ? (
                        <span className="font-semibold text-[#D4AF37]">🔔 Système</span>
                      ) : (
                        <>
                          <span 
                            className="font-semibold"
                            style={{ color: getRoleColor(role) }}
                          >
                            #{msg.author_num} {msg.author_name}
                          </span>
                          {role && (
                            <Badge 
                              variant="outline" 
                              className="text-[10px] px-1"
                              style={{ borderColor: getRoleColor(role), color: getRoleColor(role) }}
                            >
                              {role}
                            </Badge>
                          )}
                        </>
                      )}
                    </div>
                    <span className="text-[10px] text-[#6B7280]">
                      {msg.manche && `M${msg.manche} • `}{formatTime(msg.created_at)}
                    </span>
                  </div>
                  <p className={`text-sm ${isSystem ? 'text-[#E6A23C]' : 'text-[#E5E7EB]'}`}>
                    {msg.message}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
