import { Moon, Sun } from 'lucide-react';
import { useColorMode } from '@/contexts/ColorModeContext';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const { colorMode, toggleColorMode } = useColorMode();
  
  const isDark = colorMode === 'dark';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={toggleColorMode}
          className={`relative p-2 rounded-lg border border-border bg-background/50 hover:bg-muted transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background ${className}`}
          aria-label={isDark ? 'Activer le mode clair' : 'Activer le mode sombre'}
        >
          <div className="relative w-5 h-5">
            {/* Sun icon - visible in dark mode */}
            <Sun 
              className={`absolute inset-0 h-5 w-5 text-yellow-500 transition-all duration-200 ${
                isDark 
                  ? 'opacity-100 rotate-0 scale-100' 
                  : 'opacity-0 -rotate-90 scale-0'
              }`}
            />
            {/* Moon icon - visible in light mode */}
            <Moon 
              className={`absolute inset-0 h-5 w-5 text-primary transition-all duration-200 ${
                isDark 
                  ? 'opacity-0 rotate-90 scale-0' 
                  : 'opacity-100 rotate-0 scale-100'
              }`}
            />
          </div>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>{isDark ? 'Mode clair' : 'Mode sombre'}</p>
      </TooltipContent>
    </Tooltip>
  );
}
