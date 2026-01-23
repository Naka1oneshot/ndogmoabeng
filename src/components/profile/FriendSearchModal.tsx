import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Search, UserPlus, Clock, Check, X, Loader2 } from 'lucide-react';
import { useFriendships } from '@/hooks/useFriendships';

interface FriendSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SearchResult {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  friendship_status: string | null;
  friendship_id: string | null;
  is_requester: boolean | null;
}

export function FriendSearchModal({ open, onOpenChange }: FriendSearchModalProps) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [sendingRequest, setSendingRequest] = useState<string | null>(null);
  
  const { searchUsers, sendFriendRequest } = useFriendships();

  const handleSearch = useCallback(async () => {
    if (searchTerm.length < 2) {
      setResults([]);
      return;
    }

    setSearching(true);
    const data = await searchUsers(searchTerm);
    setResults(data);
    setSearching(false);
  }, [searchTerm, searchUsers]);

  const handleSendRequest = async (userId: string) => {
    setSendingRequest(userId);
    await sendFriendRequest(userId);
    // Refresh search results
    await handleSearch();
    setSendingRequest(null);
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const renderStatus = (result: SearchResult) => {
    if (!result.friendship_status) {
      return (
        <Button
          size="sm"
          onClick={() => handleSendRequest(result.user_id)}
          disabled={sendingRequest === result.user_id}
        >
          {sendingRequest === result.user_id ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <UserPlus className="w-4 h-4 mr-1" />
              Inviter
            </>
          )}
        </Button>
      );
    }

    switch (result.friendship_status) {
      case 'accepted':
        return (
          <Badge variant="secondary" className="bg-green-500/10 text-green-600">
            <Check className="w-3 h-3 mr-1" />
            Ami
          </Badge>
        );
      case 'pending':
        if (result.is_requester) {
          return (
            <Badge variant="secondary" className="bg-amber-500/10 text-amber-600">
              <Clock className="w-3 h-3 mr-1" />
              En attente
            </Badge>
          );
        }
        return (
          <Badge variant="secondary" className="bg-blue-500/10 text-blue-600">
            <Clock className="w-3 h-3 mr-1" />
            Demande reçue
          </Badge>
        );
      case 'declined':
        return (
          <Badge variant="secondary" className="bg-red-500/10 text-red-600">
            <X className="w-3 h-3 mr-1" />
            Refusée
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Rechercher des amis
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Rechercher par pseudo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={searching || searchTerm.length < 2}>
              {searching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </Button>
          </div>

          {searchTerm.length > 0 && searchTerm.length < 2 && (
            <p className="text-sm text-muted-foreground text-center">
              Entrez au moins 2 caractères
            </p>
          )}

          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {results.length === 0 && searchTerm.length >= 2 && !searching && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucun utilisateur trouvé
              </p>
            )}

            {results.map((result) => (
              <div
                key={result.user_id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={result.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/20 text-primary">
                      {getInitials(result.display_name)}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    onClick={() => {
                      onOpenChange(false);
                      navigate(`/profile/${result.user_id}`);
                    }}
                    className="font-medium hover:underline hover:text-primary transition-colors"
                  >
                    {result.display_name}
                  </button>
                </div>
                {renderStatus(result)}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
