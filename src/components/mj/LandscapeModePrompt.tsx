import { useState, useEffect } from 'react';
import { RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LandscapeModePromptProps {
  /** If true, persists dismissal in sessionStorage */
  persistDismissal?: boolean;
  /** Storage key for dismissal state */
  storageKey?: string;
}

export function LandscapeModePrompt({ 
  persistDismissal = true, 
  storageKey = 'mj-landscape-dismissed' 
}: LandscapeModePromptProps) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if previously dismissed
    if (persistDismissal) {
      const wasDismissed = sessionStorage.getItem(storageKey) === 'true';
      if (wasDismissed) {
        setDismissed(true);
        return;
      }
    }

    const checkOrientation = () => {
      const isMobile = window.innerWidth < 768;
      const isPortrait = window.innerHeight > window.innerWidth;
      setShowPrompt(isMobile && isPortrait && !dismissed);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, [dismissed, persistDismissal, storageKey]);

  const handleDismiss = () => {
    setDismissed(true);
    setShowPrompt(false);
    if (persistDismissal) {
      sessionStorage.setItem(storageKey, 'true');
    }
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4"
        onClick={handleDismiss}
      >
        <X className="h-5 w-5" />
      </Button>

      <div className="animate-pulse mb-6">
        <RotateCcw className="h-16 w-16 text-primary" />
      </div>

      <h2 className="text-xl font-bold mb-3">Mode paysage recommandé</h2>
      
      <p className="text-muted-foreground mb-6 max-w-xs">
        Tournez votre appareil en mode paysage pour une meilleure expérience du tableau MJ.
      </p>

      <Button variant="outline" onClick={handleDismiss}>
        Continuer en portrait
      </Button>
    </div>
  );
}
