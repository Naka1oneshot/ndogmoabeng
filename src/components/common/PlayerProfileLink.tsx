import { useNavigate } from 'react-router-dom';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import { useState } from 'react';

interface PlayerProfileLinkProps {
  userId?: string | null;
  displayName: string;
  className?: string;
  children?: React.ReactNode;
}

/**
 * A component that makes player names clickable to view their public profile.
 * Shows a popover with "Voir profil" option on click.
 * Only active if the player has a userId (registered user).
 */
export function PlayerProfileLink({ userId, displayName, className = '', children }: PlayerProfileLinkProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  // If no userId, just render the name without link
  if (!userId) {
    return (
      <span className={className}>
        {children || displayName}
      </span>
    );
  }

  const handleViewProfile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(false);
    navigate(`/profile/${userId}`);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button 
          type="button"
          className={`inline-flex items-center cursor-pointer hover:underline hover:text-primary transition-colors ${className}`}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
        >
          {children || displayName}
        </button>
      </PopoverTrigger>
      <PopoverContent 
        side="top" 
        className="w-auto p-2"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={handleViewProfile}
          className="gap-2 w-full justify-start"
        >
          <ExternalLink className="h-4 w-4" />
          Voir profil
        </Button>
      </PopoverContent>
    </Popover>
  );
}
