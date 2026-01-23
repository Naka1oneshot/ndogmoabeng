import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Zap, Star, Crown, ShieldCheck, UserX, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
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

// Token bonus row
interface UserBonus {
  user_id: string;
  display_name: string;
  token_balance: number;
  updated_at: string;
}

interface TokenRowCompactProps {
  bonus: UserBonus;
}

export function TokenRowCompact({ bonus }: TokenRowCompactProps) {
  return (
    <Card className="border-border">
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <span className="font-medium truncate block">{bonus.display_name}</span>
            <span className="text-xs text-muted-foreground">
              {format(new Date(bonus.updated_at), 'dd MMM yyyy', { locale: fr })}
            </span>
          </div>
          <Badge variant="secondary" className="shrink-0">
            <Zap className="w-3 h-3 mr-1" />
            {bonus.token_balance}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

// Loyalty points row
interface LoyaltyUser {
  user_id: string;
  display_name: string;
  balance: number;
  total_earned: number;
  updated_at: string;
}

interface LoyaltyRowCompactProps {
  loyaltyUser: LoyaltyUser;
}

export function LoyaltyRowCompact({ loyaltyUser }: LoyaltyRowCompactProps) {
  return (
    <Card className="border-border">
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <span className="font-medium truncate block">{loyaltyUser.display_name}</span>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Total: {loyaltyUser.total_earned} pts</span>
              <span>•</span>
              <span>{format(new Date(loyaltyUser.updated_at), 'dd MMM', { locale: fr })}</span>
            </div>
          </div>
          <Badge className="shrink-0">
            <Star className="w-3 h-3 mr-1" />
            {loyaltyUser.balance}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

// User role row
interface UserWithRole {
  user_id: string;
  display_name: string;
  email: string;
  role: 'super_admin' | 'admin' | null;
  created_at: string;
}

interface RoleRowCompactProps {
  userRole: UserWithRole;
  revokingUserId: string | null;
  onRevoke: (userId: string, displayName: string) => void;
}

export function RoleRowCompact({ userRole, revokingUserId, onRevoke }: RoleRowCompactProps) {
  const getRoleBadge = (role: 'super_admin' | 'admin' | null) => {
    if (role === 'super_admin') {
      return (
        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
          <Crown className="w-3 h-3 mr-1" />
          Super
        </Badge>
      );
    }
    if (role === 'admin') {
      return (
        <Badge className="bg-primary/20 text-primary border-primary/30">
          <ShieldCheck className="w-3 h-3 mr-1" />
          Admin
        </Badge>
      );
    }
    return <Badge variant="outline">User</Badge>;
  };

  return (
    <Card className="border-border">
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">{userRole.display_name}</span>
              {getRoleBadge(userRole.role)}
            </div>
            <span className="text-xs text-muted-foreground truncate block">
              {userRole.email}
            </span>
          </div>
          
          {userRole.role === 'admin' && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                  disabled={revokingUserId === userRole.user_id}
                >
                  {revokingUserId === userRole.user_id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <UserX className="w-4 h-4" />
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Révoquer le rôle admin ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {userRole.display_name} perdra ses droits d'administration.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => onRevoke(userRole.user_id, userRole.display_name)}
                  >
                    Révoquer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          
          {userRole.role === 'super_admin' && (
            <Badge variant="outline" className="text-amber-400 border-amber-400/30 text-xs shrink-0">
              Protégé
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Audit log row
interface AuditLogEntry {
  id: string;
  performed_by_email: string;
  target_user_email: string;
  action: string;
  details: {
    display_name?: string;
    tokens_count?: number;
    points_count?: number;
    note?: string;
  } | null;
  created_at: string;
}

interface AuditRowCompactProps {
  entry: AuditLogEntry;
}

export function AuditRowCompact({ entry }: AuditRowCompactProps) {
  const getActionBadge = () => {
    switch (entry.action) {
      case 'PROMOTE_ADMIN':
        return (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
            Promotion
          </Badge>
        );
      case 'REVOKE_ADMIN':
        return (
          <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-xs">
            Révocation
          </Badge>
        );
      case 'GRANT_TOKENS':
        return (
          <Badge className="bg-accent/20 text-accent border-accent/30 text-xs">
            +{entry.details?.tokens_count || '?'} Tokens
          </Badge>
        );
      case 'GRANT_LOYALTY':
        return (
          <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">
            +{entry.details?.points_count || '?'} Points
          </Badge>
        );
      default:
        return <Badge variant="outline" className="text-xs">{entry.action}</Badge>;
    }
  };

  return (
    <Card className="border-border">
      <CardContent className="p-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            {getActionBadge()}
            <span className="text-xs text-muted-foreground">
              {format(new Date(entry.created_at), 'dd/MM HH:mm', { locale: fr })}
            </span>
          </div>
          <div className="text-xs">
            <span className="text-muted-foreground">Par: </span>
            <span className="font-medium truncate">{entry.performed_by_email}</span>
          </div>
          <div className="text-xs">
            <span className="text-muted-foreground">Cible: </span>
            <span>{entry.details?.display_name || entry.target_user_email}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
