import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ForestButton } from '@/components/ui/ForestButton';
import { JoinGameModal } from '@/components/game/JoinGameModal';
import { Gamepad2, LogIn, ShoppingBag } from 'lucide-react';
import logoNdogmoabeng from '@/assets/logo-ndogmoabeng.png';

export function LandingFooter() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [joinModalOpen, setJoinModalOpen] = useState(false);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <>
      <footer className="border-t border-border py-12 pb-24 md:pb-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 items-center">
            {/* Logo & Copyright */}
            <div className="text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-3 mb-3">
                <img 
                  src={logoNdogmoabeng} 
                  alt="Ndogmoabeng" 
                  className="w-10 h-10 object-contain" 
                />
                <span className="font-display text-lg">Ndogmoabeng</span>
              </div>
              <p className="text-sm text-muted-foreground">
                © {new Date().getFullYear()} Le Village de Ndogmoabeng
              </p>
            </div>

            {/* Navigation */}
            <div className="flex flex-wrap justify-center gap-4 md:gap-6">
              <button 
                onClick={() => scrollToSection('concept')}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Concept
              </button>
              <button 
                onClick={() => scrollToSection('jeux')}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Jeux
              </button>
              <button 
                onClick={() => scrollToSection('clans')}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Clans
              </button>
              <button 
                onClick={() => navigate('/boutique')}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                <ShoppingBag className="h-3 w-3" />
                Boutique
              </button>
            </div>

            {/* CTA Buttons */}
            <div className="flex justify-center md:justify-end gap-3">
              <ForestButton 
                variant="secondary" 
                size="sm"
                onClick={() => setJoinModalOpen(true)}
              >
                <LogIn className="h-4 w-4" />
                Rejoindre
              </ForestButton>
              <ForestButton 
                size="sm"
                onClick={() => navigate(user ? '/mj' : '/auth')}
              >
                <Gamepad2 className="h-4 w-4" />
                Créer
              </ForestButton>
            </div>
          </div>
        </div>
      </footer>

      <JoinGameModal open={joinModalOpen} onOpenChange={setJoinModalOpen} />
    </>
  );
}
