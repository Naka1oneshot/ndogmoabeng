import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useChatVisibility } from '@/contexts/ChatContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, LogOut, DoorOpen, MessageCircle, Sparkles } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CLAN_MAP, CLAN_CODES, type ClanCode } from '@/components/clanAffinityQuiz/quizData';

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
  const { isChatHidden, showChat } = useChatVisibility();

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
      <DropdownMenuContent align="end" className="w-56">
        {/* Quiz CTA or Affinity badge */}
        {!profile?.clan_affinity_completed_at ? (
          <DropdownMenuItem 
            onClick={() => navigate('/onboarding/clan-quiz')} 
            className="cursor-pointer text-primary font-medium"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Faire mon test d'affinités
          </DropdownMenuItem>
        ) : (
          <div className="px-2 py-1.5 text-sm text-muted-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>Affinité : </span>
            <span className="font-medium text-foreground">
              {(() => {
                const code = CLAN_CODES.find(c => CLAN_MAP[c].id === profile.clan_affinity_id);
                return code ? CLAN_MAP[code].label : profile.clan_affinity_id;
              })()}
            </span>
          </div>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate('/profile')} className="cursor-pointer">
          <User className="mr-2 h-4 w-4" />
          Profil
        </DropdownMenuItem>
        {isChatHidden && (
          <DropdownMenuItem onClick={showChat} className="cursor-pointer">
            <MessageCircle className="mr-2 h-4 w-4" />
            Afficher le chat
          </DropdownMenuItem>
        )}
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
