import { useState } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useIsMobile } from '@/hooks/use-mobile';

interface PlayerNameTooltipProps {
  fullName: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * A component that displays the full player name:
 * - On PC (hover): Uses a Tooltip
 * - On Mobile (tap): Uses a Popover
 */
export function PlayerNameTooltip({ fullName, children, className = '' }: PlayerNameTooltipProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  if (isMobile) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button 
            type="button"
            className={`inline-flex items-center cursor-pointer ${className}`}
            onClick={(e) => {
              e.stopPropagation();
              setOpen(true);
            }}
          >
            {children}
          </button>
        </PopoverTrigger>
        <PopoverContent 
          side="top" 
          className="w-auto max-w-[200px] p-2 text-sm font-medium bg-popover border border-border shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          {fullName}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center cursor-default ${className}`}>
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[200px] font-medium">
          {fullName}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
