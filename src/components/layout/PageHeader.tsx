import { useNavigate, Link } from 'react-router-dom';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { UserAvatarButton } from '@/components/ui/UserAvatarButton';
import { ForestButton } from '@/components/ui/ForestButton';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, Crown } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import logoNdogmoabeng from '@/assets/logo-ndogmoabeng.png';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  showBackButton?: boolean;
  backPath?: string;
  backLabel?: string;
  showAdminBadge?: boolean;
  rightContent?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  showBackButton = false,
  backPath = '/',
  backLabel = 'Retour',
  showAdminBadge = false,
  rightContent,
  className,
}: PageHeaderProps) {
  const navigate = useNavigate();
  const { isAdminOrSuper } = useUserRole();

  return (
    <header className={cn(
      "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 max-w-5xl mx-auto",
      className
    )}>
      <div className="flex items-center gap-3">
        {showBackButton ? (
          <ForestButton
            variant="ghost"
            size="sm"
            onClick={() => navigate(backPath)}
            className="mr-1"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">{backLabel}</span>
          </ForestButton>
        ) : null}
        <Link to="/" className="flex items-center gap-3">
          <img 
            src={logoNdogmoabeng} 
            alt="Ndogmoabeng" 
            className="h-8 w-8 object-contain" 
          />
        </Link>
        <h1 className="font-display text-xl">{title}</h1>
        {showAdminBadge && isAdminOrSuper && (
          <Badge className="bg-amber-600/20 text-amber-400 border-amber-600/30">
            <Crown className="h-3 w-3 mr-1" />
            Admin
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
        {rightContent}
        <ThemeToggle />
        <UserAvatarButton size="sm" />
      </div>
    </header>
  );
}
