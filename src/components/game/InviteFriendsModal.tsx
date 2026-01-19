import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFriendships } from '@/hooks/useFriendships';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Users, 
  Send, 
  Loader2, 
  Check,
  UserPlus,
  Copy
} from 'lucide-react';

interface InviteFriendsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gameId: string;
  gameName: string;
  joinCode: string;
}

export function InviteFriendsModal({
  open,
  onOpenChange,
  gameId,
  gameName,
  joinCode,
}: InviteFriendsModalProps) {
  const { user } = useAuth();
  const { friends, loading: friendsLoading } = useFriendships();
  const [invitedFriends, setInvitedFriends] = useState<Set<string>>(new Set());
  const [invitingFriend, setInvitingFriend] = useState<string | null>(null);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleInviteFriend = async (friendUserId: string, friendName: string) => {
    if (!user) return;
    
    setInvitingFriend(friendUserId);
    
    try {
      // Insert into game_invitations table
      const { error } = await supabase
        .from('game_invitations')
        .insert({
          game_id: gameId,
          invited_by_user_id: user.id,
          invited_user_id: friendUserId,
          game_name: gameName,
          join_code: joinCode,
        });

      if (error) throw error;

      setInvitedFriends(prev => new Set([...prev, friendUserId]));
      toast.success(`Invitation envoyée à ${friendName} !`);
    } catch (error) {
      console.error('Error inviting friend:', error);
      toast.error('Erreur lors de l\'envoi de l\'invitation');
    } finally {
      setInvitingFriend(null);
    }
  };

  const copyJoinCode = () => {
    navigator.clipboard.writeText(joinCode);
    toast.success('Code copié !');
  };

  const shareLink = () => {
    const url = `${window.location.origin}/join?code=${joinCode}`;
    navigator.clipboard.writeText(url);
    toast.success('Lien de partage copié !');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Inviter des amis
          </DialogTitle>
          <DialogDescription>
            Invitez vos amis à rejoindre "{gameName}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Quick share section */}
          <div className="p-3 rounded-lg bg-muted/50 space-y-2">
            <p className="text-sm font-medium">Code d'accès</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-2 bg-background rounded font-mono text-lg text-center">
                {joinCode}
              </code>
              <Button size="sm" variant="outline" onClick={copyJoinCode}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <Button 
              variant="outline" 
              className="w-full" 
              size="sm"
              onClick={shareLink}
            >
              <Send className="w-4 h-4 mr-2" />
              Copier le lien de partage
            </Button>
          </div>

          {/* Friends list */}
          <div className="space-y-2">
            <p className="text-sm font-medium flex items-center gap-2">
              <Users className="w-4 h-4" />
              Vos amis ({friends.length})
            </p>
            
            {friendsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : friends.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Vous n'avez pas encore d'amis</p>
                <p className="text-xs mt-1">Partagez le code d'accès ci-dessus</p>
              </div>
            ) : (
              <ScrollArea className="h-[200px]">
                <div className="space-y-2 pr-3">
                  {friends.map((friend) => {
                    const isInvited = invitedFriends.has(friend.user_id);
                    const isInviting = invitingFriend === friend.user_id;

                    return (
                      <div
                        key={friend.friendship_id}
                        className="flex items-center justify-between p-2 rounded-lg bg-background hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={friend.avatar_url || undefined} />
                            <AvatarFallback className="bg-primary/20 text-primary text-xs">
                              {getInitials(friend.display_name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-sm">{friend.display_name}</span>
                        </div>
                        
                        {isInvited ? (
                          <Badge variant="secondary" className="gap-1">
                            <Check className="w-3 h-3" />
                            Invité
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleInviteFriend(friend.user_id, friend.display_name)}
                            disabled={isInviting}
                          >
                            {isInviting ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <Send className="w-3 h-3 mr-1" />
                                Inviter
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
