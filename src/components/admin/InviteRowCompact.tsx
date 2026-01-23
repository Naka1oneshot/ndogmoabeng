import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  MoreHorizontal, User, Link2, Edit2, CreditCard, 
  UserCheck, Trash2, Phone, Mail, MapPin
} from 'lucide-react';
import { EventInvite, InviteStatus } from '@/hooks/useEventInvites';

interface InviteRowCompactProps {
  invite: EventInvite;
  onEdit: (invite: EventInvite) => void;
  onMarkPaid: (invite: EventInvite) => void;
  onConfirm: (invite: EventInvite) => void;
  onDelete: (id: string) => void;
}

const STATUS_LABELS: Record<InviteStatus, string> = {
  paid: 'Payé',
  confirmed_unpaid: 'Confirmé',
  pending: 'En attente',
  free: 'Gratuit',
  declined: 'Refusé',
  not_invited_yet: 'Pas invité',
  not_invited: 'Non invité',
};

const STATUS_COLORS: Record<InviteStatus, string> = {
  paid: 'bg-green-500',
  confirmed_unpaid: 'bg-yellow-500',
  pending: 'bg-blue-500',
  free: 'bg-purple-500',
  declined: 'bg-red-500',
  not_invited_yet: 'bg-gray-400',
  not_invited: 'bg-gray-600',
};

export function InviteRowCompact({
  invite,
  onEdit,
  onMarkPaid,
  onConfirm,
  onDelete,
}: InviteRowCompactProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);

  const truncateName = (name: string, maxLen = 14) => {
    if (name.length <= maxLen) return name;
    return name.slice(0, maxLen) + '…';
  };

  return (
    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-card/50 border border-border/50">
      {/* Avatar or initial */}
      {invite.user_profile ? (
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={invite.user_profile.avatar_url || undefined} />
          <AvatarFallback className="text-xs bg-primary/20 text-primary">
            {invite.user_profile.display_name[0]}
          </AvatarFallback>
        </Avatar>
      ) : (
        <div className="h-8 w-8 shrink-0 rounded-full bg-muted flex items-center justify-center">
          <span className="text-xs font-medium text-muted-foreground">
            {invite.full_name[0]?.toUpperCase()}
          </span>
        </div>
      )}

      {/* Name + status */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-sm truncate">
            {truncateName(invite.full_name)}
          </span>
          {invite.user_profile && (
            <User className="h-3 w-3 shrink-0 text-primary" />
          )}
          {invite.registration && (
            <Link2 className="h-3 w-3 shrink-0 text-muted-foreground" />
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <Badge className={`text-[10px] px-1.5 py-0 ${STATUS_COLORS[invite.invite_status]}`}>
            {STATUS_LABELS[invite.invite_status]}
          </Badge>
          {invite.contributed_amount > 0 && (
            <span className="text-xs font-medium text-green-600">
              {invite.contributed_amount}€
            </span>
          )}
        </div>
      </div>

      {/* More button -> Popover with details */}
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-72 p-3 bg-card border-border z-50" 
          align="end"
          sideOffset={4}
        >
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center gap-3">
              {invite.user_profile ? (
                <Avatar className="h-10 w-10">
                  <AvatarImage src={invite.user_profile.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/20 text-primary">
                    {invite.user_profile.display_name[0]}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-sm font-medium text-muted-foreground">
                    {invite.full_name[0]?.toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{invite.full_name}</p>
                {invite.user_profile && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {invite.user_profile.display_name}
                  </p>
                )}
              </div>
              <Badge className={`shrink-0 ${STATUS_COLORS[invite.invite_status]}`}>
                {STATUS_LABELS[invite.invite_status]}
              </Badge>
            </div>

            {/* Contact details */}
            <div className="space-y-1.5 text-xs">
              {invite.email && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{invite.email}</span>
                </div>
              )}
              {invite.phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  <span>{invite.phone}</span>
                </div>
              )}
              {invite.address && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{invite.address}</span>
                </div>
              )}
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-2 gap-2 text-xs border-t border-border/50 pt-2">
              <div>
                <span className="text-muted-foreground">Pack:</span>
                <span className="ml-1 font-medium">{invite.pack_label || '-'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Montant:</span>
                <span className="ml-1 font-medium text-green-600">
                  {invite.contributed_amount > 0 ? `${invite.contributed_amount}€` : '-'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Parking:</span>
                <span className="ml-1 font-medium">
                  {invite.parking_amount > 0 ? `${invite.parking_amount}€` : '-'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Invité par:</span>
                <span className="ml-1 font-medium">{invite.invited_by || '-'}</span>
              </div>
            </div>

            {/* Notes */}
            {invite.notes && (
              <div className="text-xs border-t border-border/50 pt-2">
                <span className="text-muted-foreground">Notes:</span>
                <p className="mt-0.5 text-foreground">{invite.notes}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/50">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { onEdit(invite); setPopoverOpen(false); }}
                className="h-8 text-xs flex-1"
              >
                <Edit2 className="h-3.5 w-3.5 mr-1" />
                Modifier
              </Button>
              {invite.invite_status !== 'paid' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { onMarkPaid(invite); setPopoverOpen(false); }}
                  className="h-8 text-xs flex-1"
                >
                  <CreditCard className="h-3.5 w-3.5 mr-1" />
                  Payé
                </Button>
              )}
              {invite.invite_status === 'pending' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { onConfirm(invite); setPopoverOpen(false); }}
                  className="h-8 text-xs"
                >
                  <UserCheck className="h-3.5 w-3.5 mr-1" />
                  Confirmer
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { onDelete(invite.id); setPopoverOpen(false); }}
                className="h-8 text-xs text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}