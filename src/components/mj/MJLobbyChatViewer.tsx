import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MessageCircle, Users, Send, Crown, AlertCircle } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useSystemSettings } from '@/hooks/useSystemSettings';

interface MJLobbyChatViewerProps {
  gameId: string;
}

interface Message {
  id: string;
  sender_num: number;
  sender_name: string;
  message: string;
  created_at: string;
}

const MJLobbyChatViewer: React.FC<MJLobbyChatViewerProps> = ({ gameId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { chatConfig, loading: settingsLoading } = useSystemSettings();

  // Check if lobby chat is enabled
  const isChatDisabled = !settingsLoading && !chatConfig.lobby_chat_enabled;

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('lobby_chat_messages')
        .select('*')
        .eq('game_id', gameId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setMessages(data);
      }
    };

    fetchMessages();

    // Real-time subscription
    const channel = supabase
      .channel(`mj-lobby-chat-${gameId}`)
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
          setMessages((prev) => [...prev, newMsg]);
          setTimeout(scrollToBottom, 100);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, scrollToBottom]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(scrollToBottom, 100);
    }
  }, [isOpen, scrollToBottom]);

  const handleSend = async () => {
    if (!newMessage.trim()) return;

    setSending(true);
    const { error } = await supabase.from('lobby_chat_messages').insert({
      game_id: gameId,
      sender_num: 0, // MJ uses 0 as identifier
      sender_name: 'MJ',
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

  // If chat is disabled, show a compact message
  if (isChatDisabled) {
    return (
      <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium text-muted-foreground">Chat Salle d'attente</span>
          <Badge variant="outline" className="ml-2 text-muted-foreground">
            <AlertCircle className="h-3 w-3 mr-1" />
            Désactivé
          </Badge>
        </div>
      </div>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg hover:bg-secondary/70 transition-colors cursor-pointer">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            <span className="font-medium">Chat Salle d'attente</span>
            <Badge variant="secondary" className="ml-2">
              {messages.length} message{messages.length !== 1 ? 's' : ''}
            </Badge>
          </div>
          <span className="text-sm text-muted-foreground">
            {isOpen ? '▼' : '▶'}
          </span>
        </div>
      </CollapsibleTrigger>
      
      <CollapsibleContent>
        <div className="mt-2 border border-border rounded-lg overflow-hidden">
          <div className="max-h-80 overflow-y-auto p-4 bg-card/50">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Users className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">Aucun message dans la salle d'attente</p>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg) => (
                  <div key={msg.id} className="flex gap-3">
                    {/* Player/MJ badge */}
                    {msg.sender_num === 0 ? (
                      <span className="w-7 h-7 bg-amber-500/20 rounded-full flex items-center justify-center shrink-0">
                        <Crown className="h-4 w-4 text-amber-500" />
                      </span>
                    ) : (
                      <span className="w-7 h-7 bg-primary/20 rounded-full flex items-center justify-center text-xs font-bold text-primary shrink-0">
                        {msg.sender_num}
                      </span>
                    )}
                    
                    {/* Message content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className={`font-medium text-sm ${msg.sender_num === 0 ? 'text-amber-500' : ''}`}>
                          {msg.sender_name}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(msg.created_at).toLocaleTimeString('fr-FR', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-foreground/90 break-words">{msg.message}</p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
          
          {/* MJ Input */}
          <div className="p-3 border-t border-border/50 bg-card/30">
            <div className="flex gap-2">
              <Input
                placeholder="Écrire un message en tant que MJ..."
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
      </CollapsibleContent>
    </Collapsible>
  );
};

export default MJLobbyChatViewer;
