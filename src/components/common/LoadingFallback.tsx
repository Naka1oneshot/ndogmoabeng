import { Loader2 } from 'lucide-react';

interface LoadingFallbackProps {
  message?: string;
  fullScreen?: boolean;
}

export function LoadingFallback({ message = "Chargement...", fullScreen = true }: LoadingFallbackProps) {
  if (fullScreen) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">{message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-8">
      <div className="text-center space-y-2">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
