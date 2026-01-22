import { Link } from "react-router-dom";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ForestButton } from "@/components/ui/ForestButton";
import { Home, AlertTriangle } from "lucide-react";
import logoNdogmoabeng from "@/assets/logo-ndogmoabeng.png";

const NotFound = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img 
              src={logoNdogmoabeng} 
              alt="Ndogmoabeng" 
              className="h-8 w-8 object-contain" 
            />
            <span className="font-display text-lg hidden sm:block">Ndogmoabeng</span>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-10 h-10 text-destructive" />
            </div>
          </div>
          <div>
            <h1 className="text-6xl font-bold text-primary mb-2">404</h1>
            <p className="text-xl text-muted-foreground">Page non trouvée</p>
          </div>
          <p className="text-muted-foreground max-w-md">
            La page que vous recherchez n'existe pas ou a été déplacée.
          </p>
          <Link to="/">
            <ForestButton size="lg">
              <Home className="w-5 h-5 mr-2" />
              Retour à l'accueil
            </ForestButton>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
