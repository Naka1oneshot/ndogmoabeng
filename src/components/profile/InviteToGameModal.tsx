import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUserProfile, CurrentGame } from '@/hooks/useUserProfile';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { 
  Gamepad2, 
  Send, 
  Loader2, 
  Users,
  Crown
} from 'lucide-react';

interface InviteToGameModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  friendUserId: string;
  friendName: string;
}

export function InviteToGameModal({
  open,
  onOpenChange,
  friendUserId,
  friendName,
}: InviteToGameModalProps) {
  const { user } = useAuth();
  const { currentGames, loading: gamesLoading } = useUserProfile();
  const [invitingTo, setInvitingTo] = useState<string | null>(null);
  const isMobile = useIsMobile();

  // Only show LOBBY games where user is the host
  const lobbyGames = currentGames.filter(g => g.status === 'LOBBY' && g.is_host);

  const handleInvite = async (game: CurrentGame) => {
    if (!user) return;
    
    setInvitingTo(game.id);
    
    try {
      const { error } = await supabase
        .from('session_events')
        .insert({
          game_id: game.id,
          type: 'game_invite',
          audience: 'private',
          message: `${friendName} a été invité à rejoindre la partie`,
          payload: {
            invited_user_id: friendUserId,
            invited_by_user_id: user.id,
            join_code: game.join_code,
            game_name: game.name,
          },
        });

      if (error) throw error;

      toast.success(`${friendName} a été invité à "${game.name}" !`);
      onOpenChange(false);
    } catch (error) {
      console.error('Error inviting friend:', error);
      toast.error('Erreur lors de l\'envoi de l\'invitation');
    } finally {
      setInvitingTo(null);
    }
  };

  const content = (
    <div className="space-y-3">
      {gamesLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : lobbyGames.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <Gamepad2 className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Vous n'avez pas de partie en attente</p>
          <p className="text-xs mt-1">Créez une partie pour inviter des amis</p>
        </div>
      ) : (
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-2 pr-3">
            {lobbyGames.map((game) => (
              <div
                key={game.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <span className="font-medium truncate">{game.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <Badge variant="outline" className="text-xs">
                      {game.status}
                    </Badge>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {game.player_count} joueurs
                    </span>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleInvite(game)}
                  disabled={invitingTo === game.id}
                  className="flex-shrink-0 ml-2"
                >
                  {invitingTo === game.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-3 h-3 mr-1" />
                      Inviter
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="px-4 pb-6">
          <DrawerHeader className="text-left">
            <DrawerTitle className="flex items-center gap-2">
              <Gamepad2 className="w-5 h-5" />
              Inviter {friendName}
            </DrawerTitle>
            <DrawerDescription>
              Sélectionnez une partie en attente pour y inviter {friendName}
            </DrawerDescription>
          </DrawerHeader>
          {content}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gamepad2 className="w-5 h-5" />
            Inviter {friendName}
          </DialogTitle>
          <DialogDescription>
            Sélectionnez une partie en attente pour y inviter {friendName}
          </DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
