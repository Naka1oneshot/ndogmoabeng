import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, LogOut, DoorOpen } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface UserAvatarButtonProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onLeaveGame?: () => void;
}

export function UserAvatarButton({ size = 'md', className = '', onLeaveGame }: UserAvatarButtonProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { profile } = useUserProfile();

  if (!user) {
    return (
      <button
        onClick={() => navigate('/auth', { state: { from: location.pathname } })}
        className={`flex items-center justify-center rounded-full bg-muted hover:bg-muted/80 transition-colors ${className}`}
        style={{ 
          width: size === 'sm' ? 32 : size === 'lg' ? 48 : 40, 
          height: size === 'sm' ? 32 : size === 'lg' ? 48 : 40 
        }}
        aria-label="Se connecter"
      >
        <User className={size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-6 h-6' : 'w-5 h-5'} />
      </button>
    );
  }

  const getInitials = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
    }
    return profile?.display_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U';
  };

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`rounded-full ring-2 ring-transparent hover:ring-primary/50 transition-all ${className}`}
          aria-label="Mon profil"
        >
          <Avatar className={sizeClasses[size]}>
            <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.display_name || 'Avatar'} />
            <AvatarFallback className="bg-primary/20 text-primary font-semibold">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => navigate('/profile')} className="cursor-pointer">
          <User className="mr-2 h-4 w-4" />
          Profil
        </DropdownMenuItem>
        {onLeaveGame && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLeaveGame} className="cursor-pointer text-amber-500 focus:text-amber-500">
              <DoorOpen className="mr-2 h-4 w-4" />
              Quitter la partie
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-red-500 focus:text-red-500">
          <LogOut className="mr-2 h-4 w-4" />
          Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
