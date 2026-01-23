import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useGameInvitations } from '@/hooks/useGameInvitations';
import { 
  Mail, 
  Play,
  X,
  Loader2,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export function GameInvitationsSection() {
  const navigate = useNavigate();
  const { invitations, loading, dismissInvitation } = useGameInvitations();

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (invitations.length === 0) {
    return null;
  }

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-primary" />
          Invitations à des parties
          <Badge variant="default">{invitations.length}</Badge>
        </CardTitle>
        <CardDescription>
          Des amis vous ont invité à rejoindre leurs parties
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {invitations.map((invitation) => (
          <div
            key={invitation.id}
            className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
          >
            <div className="flex-1">
              <div className="font-medium">{invitation.game_name}</div>
              <div className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                <span>
                  Invité par{' '}
                  <button
                    onClick={() => navigate(`/profile/${invitation.invited_by_user_id}`)}
                    className="font-medium hover:underline hover:text-primary transition-colors"
                  >
                    {invitation.invited_by_name}
                  </button>
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {format(new Date(invitation.created_at), 'dd MMM à HH:mm', { locale: fr })}
                </span>
              </div>
              <code className="text-xs bg-background px-2 py-0.5 rounded mt-1 inline-block">
                Code: {invitation.join_code}
              </code>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => navigate(`/join?code=${invitation.join_code}`)}
              >
                <Play className="w-4 h-4 mr-1" />
                Rejoindre
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => dismissInvitation(invitation.id)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
