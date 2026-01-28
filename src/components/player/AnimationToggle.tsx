import { Sparkles, CircleSlash } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

interface AnimationToggleProps {
  enabled: boolean;
  onToggle: () => void;
  className?: string;
}

export function AnimationToggle({ enabled, onToggle, className }: AnimationToggleProps) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
        "bg-card/80 backdrop-blur border border-border shadow-sm",
        "hover:bg-card hover:shadow-md",
        enabled 
          ? "text-primary" 
          : "text-muted-foreground",
        className
      )}
      title={enabled ? "Désactiver les animations" : "Activer les animations"}
    >
      {enabled ? (
        <Sparkles className="h-3.5 w-3.5" />
      ) : (
        <CircleSlash className="h-3.5 w-3.5" />
      )}
      <span className="hidden sm:inline">Anims</span>
      <Switch
        checked={enabled}
        onCheckedChange={onToggle}
        className="h-4 w-7 data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted"
      />
    </button>
  );
}
