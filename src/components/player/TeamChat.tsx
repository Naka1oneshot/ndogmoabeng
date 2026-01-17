import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, MessageCircle, Users } from 'lucide-react';
import { toast } from 'sonner';

interface TeamChatProps {
  gameId: string;
  playerNum: number;
  playerName: string;
  mateNum: number | null;
  onUnreadChange?: (count: number) => void;
  isVisible?: boolean;
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

const TeamChat: React.FC<TeamChatProps> = ({ 
  gameId, 
  playerNum, 
  playerName, 
  mateNum,
  onUnreadChange,
  isVisible = true
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [teammates, setTeammates] = useState<Teammate[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastReadCount = useRef(0);

  // Calculate a consistent mate_group ID from the pair (min of playerNum and mateNum)
  const mateGroupId = mateNum ? Math.min(playerNum, mateNum) : null;

  // Scroll to bottom function
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  // Reset unread when chat becomes visible
  useEffect(() => {
    if (isVisible && unreadCount > 0) {
      setUnreadCount(0);
      lastReadCount.current = messages.length;
      onUnreadChange?.(0);
    }
  }, [isVisible, unreadCount, messages.length, onUnreadChange]);

  // Fetch teammates
  useEffect(() => {
    if (!mateNum) return;

    const fetchTeammates = async () => {
      const { data, error } = await supabase
        .from('game_players')
        .select('player_number, display_name')
        .eq('game_id', gameId)
        .eq('player_number', mateNum)
        .in('status', ['ACTIVE', 'IN_QUEUE']);

      if (!error && data) {
        setTeammates(data as Teammate[]);
      }
    };

    fetchTeammates();
  }, [gameId, mateNum]);

  // Fetch and subscribe to messages
  useEffect(() => {
    if (!mateGroupId) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('team_messages')
        .select('*')
        .eq('game_id', gameId)
        .eq('mate_group', mateGroupId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setMessages(data);
        lastReadCount.current = data.length;
        // Scroll after initial load
        setTimeout(scrollToBottom, 100);
      }
    };

    fetchMessages();

    // Real-time subscription
    const channel = supabase
      .channel(`team-chat-${gameId}-${mateGroupId}`)
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
          if (newMsg.mate_group === mateGroupId) {
            setMessages((prev) => [...prev, newMsg]);
            
            // If message is from teammate and chat is not visible, increment unread
            if (newMsg.sender_num !== playerNum && !isVisible) {
              setUnreadCount((prev) => {
                const newCount = prev + 1;
                onUnreadChange?.(newCount);
                return newCount;
              });
            }
            
            // Scroll to bottom for new messages
            setTimeout(scrollToBottom, 100);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, mateGroupId, playerNum, isVisible, onUnreadChange, scrollToBottom]);

  const handleSend = async () => {
    if (!newMessage.trim() || !mateGroupId) return;

    setSending(true);
    const { error } = await supabase.from('team_messages').insert({
      game_id: gameId,
      sender_num: playerNum,
      sender_name: playerName,
      mate_group: mateGroupId,
      message: newMessage.trim(),
    });

    if (error) {
      console.error('Error sending message:', error);
      toast.error('Erreur lors de l\'envoi du message');
    } else {
      setNewMessage('');
      // Scroll after sending
      setTimeout(scrollToBottom, 100);
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
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto p-3"
      >
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
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

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
