import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, MessageCircle, Users } from 'lucide-react';
import { toast } from 'sonner';

interface TeamChatProps {
  gameId: string;
  playerNum: number;
  playerName: string;
  mateNum: number | null;
}

interface Message {
  id: string;
  sender_num: number;
  sender_name: string;
  mate_group: number;
  message: string;
  created_at: string;
}

interface Teammate {
  player_number: number;
  display_name: string;
}

const TeamChat: React.FC<TeamChatProps> = ({ gameId, playerNum, playerName, mateNum }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [teammates, setTeammates] = useState<Teammate[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch teammates (players with same mate_num)
  useEffect(() => {
    if (!mateNum) return;

    const fetchTeammates = async () => {
      const { data, error } = await supabase
        .from('game_players')
        .select('player_number, display_name')
        .eq('game_id', gameId)
        .eq('mate_num', mateNum)
        .neq('player_number', playerNum)
        .in('status', ['ACTIVE', 'IN_QUEUE']);

      if (!error && data) {
        setTeammates(data as Teammate[]);
      }
    };

    fetchTeammates();
  }, [gameId, mateNum, playerNum]);

  // Fetch and subscribe to messages
  useEffect(() => {
    if (!mateNum) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('team_messages')
        .select('*')
        .eq('game_id', gameId)
        .eq('mate_group', mateNum)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setMessages(data);
      }
    };

    fetchMessages();

    // Real-time subscription
    const channel = supabase
      .channel(`team-chat-${gameId}-${mateNum}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'team_messages',
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          if (newMsg.mate_group === mateNum) {
            setMessages((prev) => [...prev, newMsg]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, mateNum]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !mateNum) return;

    setSending(true);
    const { error } = await supabase.from('team_messages').insert({
      game_id: gameId,
      sender_num: playerNum,
      sender_name: playerName,
      mate_group: mateNum,
      message: newMessage.trim(),
    });

    if (error) {
      console.error('Error sending message:', error);
      toast.error('Erreur lors de l\'envoi du message');
    } else {
      setNewMessage('');
    }
    setSending(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // No mate assigned
  if (!mateNum) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-8 text-center text-muted-foreground">
        <Users className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-sm">Vous n'avez pas de coéquipier assigné.</p>
        <p className="text-xs mt-1">Le MJ peut vous assigner un coéquipier dans son dashboard.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b border-border/50 bg-card/50">
        <MessageCircle className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Chat Coéquipiers</span>
        {teammates.length > 0 && (
          <span className="text-xs text-muted-foreground ml-auto">
            avec {teammates.map(t => t.display_name).join(', ')}
          </span>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-3" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <MessageCircle className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-xs">Aucun message. Envoyez le premier !</p>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender_num === playerNum ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 ${
                    msg.sender_num === playerNum
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  {msg.sender_num !== playerNum && (
                    <p className="text-xs font-medium mb-1 opacity-75">{msg.sender_name}</p>
                  )}
                  <p className="text-sm break-words">{msg.message}</p>
                </div>
                <span className="text-[10px] text-muted-foreground mt-0.5 px-1">
                  {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t border-border/50">
        <div className="flex gap-2">
          <Input
            placeholder="Écrire un message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={sending}
            className="flex-1"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TeamChat;
