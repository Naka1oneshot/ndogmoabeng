import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { 
  Users, 
  UserPlus, 
  Check, 
  X, 
  Trash2, 
  Clock, 
  Loader2,
  BarChart3,
  Search,
  Gamepad2
} from 'lucide-react';
import { useFriendships } from '@/hooks/useFriendships';
import { FriendSearchModal } from './FriendSearchModal';
import { FriendComparisonModal } from './FriendComparisonModal';
import { InviteToGameModal } from './InviteToGameModal';
import { Skeleton } from '@/components/ui/skeleton';

interface Friend {
  friendship_id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'blocked';
  is_requester: boolean;
  created_at: string;
}

export function FriendsSection() {
  const {
    friends,
    pendingRequests,
    sentRequests,
    loading,
    acceptFriendRequest,
    declineFriendRequest,
    removeFriend,
    cancelFriendRequest,
  } = useFriendships();

  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [comparisonModalOpen, setComparisonModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleAccept = async (friendshipId: string) => {
    setActionLoading(friendshipId);
    await acceptFriendRequest(friendshipId);
    setActionLoading(null);
  };

  const handleDecline = async (friendshipId: string) => {
    setActionLoading(friendshipId);
    await declineFriendRequest(friendshipId);
    setActionLoading(null);
  };

  const handleRemove = async (friendshipId: string) => {
    setActionLoading(friendshipId);
    await removeFriend(friendshipId);
    setActionLoading(null);
  };

  const handleCancel = async (friendshipId: string) => {
    setActionLoading(friendshipId);
    await cancelFriendRequest(friendshipId);
    setActionLoading(null);
  };

  const openComparison = (friend: Friend) => {
    setSelectedFriend(friend);
    setComparisonModalOpen(true);
  };

  const openInvite = (friend: Friend) => {
    setSelectedFriend(friend);
    setInviteModalOpen(true);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const totalPending = pendingRequests.length;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Amis
                {totalPending > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {totalPending} en attente
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Gérez vos amis et comparez vos statistiques
              </CardDescription>
            </div>
            <Button onClick={() => setSearchModalOpen(true)}>
              <Search className="w-4 h-4 mr-2" />
              Rechercher
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="friends">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="friends" className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                Amis ({friends.length})
              </TabsTrigger>
              <TabsTrigger value="pending" className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                Reçues ({pendingRequests.length})
              </TabsTrigger>
              <TabsTrigger value="sent" className="flex items-center gap-1">
                <UserPlus className="w-4 h-4" />
                Envoyées ({sentRequests.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="friends" className="mt-4">
              {friends.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Vous n'avez pas encore d'amis</p>
                  <Button 
                    variant="outline" 
                    className="mt-3"
                    onClick={() => setSearchModalOpen(true)}
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Rechercher des amis
                  </Button>
                </div>
              ) : (
                <div className="max-h-[300px] overflow-y-auto space-y-3 pr-1">
                  {friends.map((friend) => (
                    <div
                      key={friend.friendship_id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={friend.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary/20 text-primary">
                            {getInitials(friend.display_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{friend.display_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openInvite(friend)}
                          title="Inviter à une partie"
                        >
                          <Gamepad2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openComparison(friend)}
                        >
                          <BarChart3 className="w-4 h-4 mr-1" />
                          Comparer
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              disabled={actionLoading === friend.friendship_id}
                            >
                              {actionLoading === friend.friendship_id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Supprimer cet ami ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                {friend.display_name} sera retiré de votre liste d'amis. 
                                Vous pourrez l'ajouter à nouveau plus tard.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleRemove(friend.friendship_id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Supprimer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="pending" className="mt-4 space-y-3">
              {pendingRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Aucune demande en attente</p>
                </div>
              ) : (
                pendingRequests.map((request) => (
                  <div
                    key={request.friendship_id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={request.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/20 text-primary">
                          {getInitials(request.display_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <span className="font-medium">{request.display_name}</span>
                        <p className="text-xs text-muted-foreground">
                          Souhaite devenir votre ami
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleAccept(request.friendship_id)}
                        disabled={actionLoading === request.friendship_id}
                      >
                        {actionLoading === request.friendship_id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Check className="w-4 h-4 mr-1" />
                            Accepter
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDecline(request.friendship_id)}
                        disabled={actionLoading === request.friendship_id}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="sent" className="mt-4 space-y-3">
              {sentRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <UserPlus className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Aucune demande envoyée</p>
                </div>
              ) : (
                sentRequests.map((request) => (
                  <div
                    key={request.friendship_id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={request.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/20 text-primary">
                          {getInitials(request.display_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <span className="font-medium">{request.display_name}</span>
                        <p className="text-xs text-muted-foreground">
                          En attente de réponse
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCancel(request.friendship_id)}
                      disabled={actionLoading === request.friendship_id}
                    >
                      {actionLoading === request.friendship_id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <X className="w-4 h-4 mr-1" />
                          Annuler
                        </>
                      )}
                    </Button>
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <FriendSearchModal
        open={searchModalOpen}
        onOpenChange={setSearchModalOpen}
      />

      <FriendComparisonModal
        open={comparisonModalOpen}
        onOpenChange={setComparisonModalOpen}
        friend={selectedFriend}
      />

      {selectedFriend && (
        <InviteToGameModal
          open={inviteModalOpen}
          onOpenChange={setInviteModalOpen}
          friendUserId={selectedFriend.user_id}
          friendName={selectedFriend.display_name}
        />
      )}
    </>
  );
}
