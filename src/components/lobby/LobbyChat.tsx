import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, MessageCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useSystemSettings } from '@/hooks/useSystemSettings';

interface LobbyChatProps {
  gameId: string;
  playerNum: number;
  playerName: string;
  isReadOnly?: boolean;
  maxHeight?: string;
}

interface Message {
  id: string;
  sender_num: number;
  sender_name: string;
  message: string;
  created_at: string;
}

const LobbyChat: React.FC<LobbyChatProps> = ({ 
  gameId, 
  playerNum, 
  playerName, 
  isReadOnly = false,
  maxHeight = '300px'
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const shouldScrollRef = useRef(false);
  const { chatConfig, loading: settingsLoading } = useSystemSettings();

  // Check if lobby chat is enabled
  const isChatDisabled = !settingsLoading && !chatConfig.lobby_chat_enabled;

  const scrollToBottom = useCallback(() => {
    if (shouldScrollRef.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      shouldScrollRef.current = false;
    }
  }, []);

  // Maximum messages to keep in memory to prevent unbounded growth
  const MAX_MESSAGES = 200;

  // Fetch and subscribe to messages
  useEffect(() => {
    const fetchMessages = async () => {
      // Fetch only the last MAX_MESSAGES, ordered desc, then reverse for display
      const { data, error } = await supabase
        .from('lobby_chat_messages')
        .select('id, sender_num, sender_name, message, created_at')
        .eq('game_id', gameId)
        .order('created_at', { ascending: false })
        .limit(MAX_MESSAGES);

      if (!error && data) {
        // Reverse to get chronological order for display
        setMessages(data.reverse());
        shouldScrollRef.current = true;
        setTimeout(scrollToBottom, 100);
      }
    };

    fetchMessages();

    // Real-time subscription
    const channel = supabase
      .channel(`lobby-chat-${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'lobby_chat_messages',
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            // Append new message, then trim to MAX_MESSAGES (keep most recent)
            const updated = [...prev, newMsg];
            return updated.length > MAX_MESSAGES 
              ? updated.slice(-MAX_MESSAGES) 
              : updated;
          });
          shouldScrollRef.current = true;
          setTimeout(scrollToBottom, 100);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, scrollToBottom]);

  const handleSend = async () => {
    if (!newMessage.trim() || isReadOnly) return;

    setSending(true);
    const { error } = await supabase.from('lobby_chat_messages').insert({
      game_id: gameId,
      sender_num: playerNum,
      sender_name: playerName,
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

  const hasFlexHeight = maxHeight === 'none';

  // If chat is disabled, show a message
  if (isChatDisabled) {
    return (
      <div className={`flex flex-col ${hasFlexHeight ? 'h-full' : ''}`}>
        <div className="flex items-center gap-2 p-3 border-b border-border/50 bg-card/50">
          <MessageCircle className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Chat Salle d'attente</span>
        </div>
        <div className="flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
          <AlertCircle className="h-8 w-8 mb-2 opacity-50" />
          <p className="text-sm">Le chat est temporairement désactivé</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${hasFlexHeight ? 'h-full' : ''}`}>
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b border-border/50 bg-card/50">
        <MessageCircle className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Chat Salle d'attente</span>
        {isReadOnly && (
          <span className="text-xs text-muted-foreground ml-auto">(lecture seule)</span>
        )}
      </div>

      {/* Messages */}
      <div 
        className={`overflow-y-auto p-3 ${hasFlexHeight ? 'flex-1' : ''}`}
        style={hasFlexHeight ? undefined : { maxHeight }}
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 text-muted-foreground">
            <MessageCircle className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-xs">Aucun message. {!isReadOnly && 'Envoyez le premier !'}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender_num === playerNum ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 ${
                    msg.sender_num === playerNum
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  {msg.sender_num !== playerNum && (
                    <p className="text-xs font-medium mb-1 opacity-75">
                      #{msg.sender_num} {msg.sender_name}
                    </p>
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

      {/* Input - only if not read-only */}
      {!isReadOnly && (
        <div className="p-3 border-t border-border/50 mt-auto">
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
      )}
    </div>
  );
};

export default LobbyChat;
