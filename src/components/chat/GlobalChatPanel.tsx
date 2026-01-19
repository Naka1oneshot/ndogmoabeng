import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useFriendChat } from '@/hooks/useFriendChat';
import { useFriendships } from '@/hooks/useFriendships';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  MessageCircle,
  Send,
  ArrowLeft,
  Users,
  Gamepad2,
  Loader2,
  ExternalLink,
} from 'lucide-react';

export function GlobalChatPanel() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, conversations, loading, totalUnread, sendMessage } = useFriendChat(selectedFriendId || undefined);
  const { friends } = useFriendships();

  const selectedFriend = friends.find(f => f.user_id === selectedFriendId);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!selectedFriendId || !newMessage.trim()) return;

    setSending(true);
    const { error } = await sendMessage(selectedFriendId, newMessage);
    setSending(false);

    if (!error) {
      setNewMessage('');
    }
  };

  const handleJoinGame = (joinCode: string) => {
    setIsOpen(false);
    navigate(`/join/${joinCode}`);
  };

  if (!user) return null;

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="fixed bottom-4 right-4 z-50 h-14 w-14 rounded-full shadow-lg bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <MessageCircle className="h-6 w-6" />
          {totalUnread > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 text-xs"
            >
              {totalUnread > 99 ? '99+' : totalUnread}
            </Badge>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
        {!selectedFriendId ? (
          // Conversations list
          <>
            <SheetHeader className="p-4 border-b">
              <SheetTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Messages
              </SheetTitle>
            </SheetHeader>

            <ScrollArea className="flex-1">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <MessageCircle className="h-12 w-12 text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">Aucune conversation</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Commencez à discuter avec vos amis !
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {conversations.map((conv) => (
                    <button
                      key={conv.friend_id}
                      onClick={() => setSelectedFriendId(conv.friend_id)}
                      className="w-full p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left"
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={conv.friend_avatar || undefined} />
                        <AvatarFallback className="bg-primary/20 text-primary">
                          {getInitials(conv.friend_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-medium truncate">{conv.friend_name}</span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(conv.last_message_at), 'HH:mm', { locale: fr })}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {conv.last_message}
                        </p>
                      </div>
                      {conv.unread_count > 0 && (
                        <Badge variant="default" className="ml-2">
                          {conv.unread_count}
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Start new conversation with friends */}
              {friends.length > 0 && (
                <div className="p-4 border-t">
                  <p className="text-sm font-medium text-muted-foreground mb-3">Démarrer une conversation</p>
                  <div className="flex flex-wrap gap-2">
                    {friends
                      .filter(f => !conversations.some(c => c.friend_id === f.user_id))
                      .slice(0, 5)
                      .map((friend) => (
                        <Button
                          key={friend.user_id}
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedFriendId(friend.user_id)}
                          className="gap-2"
                        >
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={friend.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">
                              {getInitials(friend.display_name)}
                            </AvatarFallback>
                          </Avatar>
                          {friend.display_name}
                        </Button>
                      ))}
                  </div>
                </div>
              )}
            </ScrollArea>
          </>
        ) : (
          // Chat with selected friend
          <>
            <div className="p-4 border-b flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedFriendId(null)}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <Avatar className="h-8 w-8">
                <AvatarImage src={selectedFriend?.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/20 text-primary text-sm">
                  {getInitials(selectedFriend?.display_name || 'U')}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium">{selectedFriend?.display_name || 'Utilisateur'}</span>
            </div>

            <ScrollArea className="flex-1 p-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <MessageCircle className="h-10 w-10 text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Aucun message. Envoyez le premier !
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg) => {
                    const isOwn = msg.sender_id === user.id;
                    const isGameInvite = msg.message_type === 'game_invite';

                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg p-3 ${
                            isOwn
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          } ${isGameInvite ? 'border-2 border-amber-500/50' : ''}`}
                        >
                          {isGameInvite && (
                            <div className="flex items-center gap-2 mb-2">
                              <Gamepad2 className="h-4 w-4 text-primary" />
                              <span className="text-xs font-medium text-primary">
                                Invitation de jeu
                              </span>
                            </div>
                          )}
                          <p className="text-sm">{msg.message}</p>
                          {isGameInvite && msg.payload?.join_code && (
                            <Button
                              size="sm"
                              variant={isOwn ? 'secondary' : 'default'}
                              className="w-full mt-2 gap-2"
                              onClick={() => handleJoinGame(msg.payload!.join_code!)}
                            >
                              <ExternalLink className="h-3 w-3" />
                              Rejoindre
                            </Button>
                          )}
                          <p className={`text-xs mt-1 ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                            {format(new Date(msg.created_at), 'HH:mm', { locale: fr })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            <div className="p-4 border-t">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex gap-2"
              >
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Écrivez un message..."
                  className="flex-1"
                  disabled={sending}
                />
                <Button type="submit" size="icon" disabled={sending || !newMessage.trim()}>
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
