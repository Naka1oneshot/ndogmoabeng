import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface LionPlayerAvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showBorder?: boolean;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function LionPlayerAvatar({ 
  name, 
  avatarUrl, 
  size = 'md',
  className,
  showBorder = true
}: LionPlayerAvatarProps) {
  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-12 w-12 text-sm',
    lg: 'h-16 w-16 text-lg',
    xl: 'h-24 w-24 text-2xl'
  };

  return (
    <Avatar className={cn(
      sizeClasses[size],
      showBorder && 'ring-2 ring-amber-500/60',
      className
    )}>
      {avatarUrl ? (
        <AvatarImage src={avatarUrl} alt={name} />
      ) : null}
      <AvatarFallback className="bg-gradient-to-br from-amber-600 to-amber-800 text-amber-100 font-bold">
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
