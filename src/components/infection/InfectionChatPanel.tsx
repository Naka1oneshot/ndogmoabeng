import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, Users, Syringe, FlaskConical, Send, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useSystemSettings } from '@/hooks/useSystemSettings';

interface Player {
  id: string;
  display_name: string;
  player_number: number | null;
  role_code: string | null;
}

interface ChatMessage {
  id: string;
  channel_type: string;
  author_num: number;
  author_name: string;
  message: string;
  created_at: string;
}

interface InfectionChatPanelProps {
  gameId: string;
  sessionGameId: string;
  player: Player;
}

export function InfectionChatPanel({
  gameId,
  sessionGameId,
  player,
}: InfectionChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [activeChannel, setActiveChannel] = useState('PUBLIC');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { chatConfig, loading: settingsLoading } = useSystemSettings();

  const canAccessPV = player.role_code === 'PV';
  const canAccessSY = player.role_code === 'SY';
  
  // Check if in-game chat is enabled
  const isChatDisabled = !settingsLoading && !chatConfig.ingame_chat_enabled;

  useEffect(() => {
    fetchMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel(`infection-chat-${sessionGameId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'infection_chat_messages',
          filter: `session_game_id=eq.${sessionGameId}`,
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          // Only add if we have access to this channel
          if (
            newMsg.channel_type === 'PUBLIC' ||
            (newMsg.channel_type === 'PV' && canAccessPV) ||
            (newMsg.channel_type === 'SY' && canAccessSY)
          ) {
            setMessages(prev => [...prev, newMsg]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionGameId, canAccessPV, canAccessSY]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchMessages = async () => {
    // Build channel filter based on access
    const channels = ['PUBLIC'];
    if (canAccessPV) channels.push('PV');
    if (canAccessSY) channels.push('SY');

    const { data, error } = await supabase
      .from('infection_chat_messages')
      .select('*')
      .eq('session_game_id', sessionGameId)
      .in('channel_type', channels)
      .order('created_at', { ascending: true });

    if (data) {
      setMessages(data as ChatMessage[]);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    // Validate channel access
    if (activeChannel === 'PV' && !canAccessPV) {
      toast.error('Accès non autorisé au canal PV');
      return;
    }
    if (activeChannel === 'SY' && !canAccessSY) {
      toast.error('Accès non autorisé au canal SY');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('infection_chat_messages')
        .insert({
          game_id: gameId,
          session_game_id: sessionGameId,
          channel_type: activeChannel,
          channel_key: activeChannel,
          author_num: player.player_number,
          author_name: player.display_name,
          message: newMessage.trim(),
        });

      if (error) throw error;

      setNewMessage('');
    } catch (err: any) {
      toast.error(err.message || 'Erreur envoi message');
    } finally {
      setLoading(false);
    }
  };

  const filteredMessages = messages.filter(m => m.channel_type === activeChannel);

  const getChannelColor = (channel: string) => {
    switch (channel) {
      case 'PV': return '#B00020';
      case 'SY': return '#2AB3A6';
      default: return '#D4AF37';
    }
  };

  // If chat is disabled, show a message
  if (isChatDisabled) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-center p-8">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
        <p className="text-muted-foreground font-medium">Chat temporairement désactivé</p>
        <p className="text-sm text-muted-foreground/70 mt-2">
          Le chat in-game a été désactivé par les administrateurs
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Tabs value={activeChannel} onValueChange={setActiveChannel} className="flex-1 flex flex-col">
        <TabsList className="bg-[#121A2B] border-b border-[#2D3748] rounded-none">
          <TabsTrigger value="PUBLIC" className="flex-1 data-[state=active]:bg-[#1A2235]">
            <Users className="h-4 w-4 mr-1" />
            Public
          </TabsTrigger>
          {canAccessPV && (
            <TabsTrigger value="PV" className="flex-1 data-[state=active]:bg-[#1A2235]">
              <Syringe className="h-4 w-4 mr-1 text-[#B00020]" />
              PV
            </TabsTrigger>
          )}
          {canAccessSY && (
            <TabsTrigger value="SY" className="flex-1 data-[state=active]:bg-[#1A2235]">
              <FlaskConical className="h-4 w-4 mr-1 text-[#2AB3A6]" />
              SY
            </TabsTrigger>
          )}
        </TabsList>

        <div className="flex-1 overflow-auto p-4 space-y-2">
          {filteredMessages.length === 0 ? (
            <p className="text-center text-[#6B7280] py-8">
              Aucun message dans ce canal.
            </p>
          ) : (
            filteredMessages.map((msg) => (
              <div
                key={msg.id}
                className={`p-3 rounded-lg ${
                  msg.author_num === player.player_number
                    ? 'bg-[#2D3748] ml-8'
                    : 'bg-[#1A2235] mr-8'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span 
                    className="font-semibold text-sm"
                    style={{ color: msg.author_num === 0 ? getChannelColor(msg.channel_type) : '#EAEAF2' }}
                  >
                    {msg.author_num === 0 ? '🔔 SYSTÈME' : `#${msg.author_num} ${msg.author_name}`}
                  </span>
                  <span className="text-xs text-[#6B7280]">
                    {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-sm text-[#EAEAF2]">{msg.message}</p>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </Tabs>

      {/* Message input */}
      <div className="p-4 border-t border-[#2D3748]">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={`Message ${activeChannel}...`}
            className="flex-1 bg-[#0B0E14] border-[#2D3748]"
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            disabled={loading}
          />
          <Button
            onClick={sendMessage}
            disabled={loading || !newMessage.trim()}
            style={{ backgroundColor: getChannelColor(activeChannel) }}
            className="hover:opacity-80"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
