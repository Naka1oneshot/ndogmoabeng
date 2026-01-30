import logoNdogmoabeng from '@/assets/logo-ndogmoabeng.png';

interface LoadingFallbackProps {
  message?: string;
  fullScreen?: boolean;
}

export function LoadingFallback({ message = "Chargement...", fullScreen = true }: LoadingFallbackProps) {
  if (fullScreen) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <img 
            src={logoNdogmoabeng} 
            alt="Chargement" 
            className="h-16 w-16 mx-auto animate-pulse"
          />
          <p className="text-muted-foreground">{message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-8">
      <div className="text-center space-y-2">
        <img 
          src={logoNdogmoabeng} 
          alt="Chargement" 
          className="h-10 w-10 mx-auto animate-pulse"
        />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
