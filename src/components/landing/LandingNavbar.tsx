import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useActiveGames } from '@/hooks/useActiveGames';
import { ForestButton } from '@/components/ui/ForestButton';
import { JoinGameModal } from '@/components/game/JoinGameModal';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { UserAvatarButton } from '@/components/ui/UserAvatarButton';
import { Menu, X, Gamepad2, LogIn, User, LogOut, Shield, Store } from 'lucide-react';
import logoNdogmoabeng from '@/assets/logo-ndogmoabeng.png';

export function LandingNavbar() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isAdmin, isSuperAdmin } = useUserRole();
  const { gamesCount } = useActiveGames();
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    setMobileMenuOpen(false);
    navigate('/');
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setMobileMenuOpen(false);
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div 
              className="flex items-center gap-3 cursor-pointer" 
              onClick={() => navigate('/')}
            >
              <img 
                src={logoNdogmoabeng} 
                alt="Ndogmoabeng" 
                className="w-10 h-10 object-contain" 
              />
              <span className="font-display text-lg hidden sm:block text-foreground">
                Le Village de Ndogmoabeng
              </span>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-6">
              <button 
                onClick={() => scrollToSection('concept')}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Concept
              </button>
              <button 
                onClick={() => scrollToSection('jeux')}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Jeux
              </button>
              <button 
                onClick={() => scrollToSection('clans')}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Clans
              </button>
              <button 
                onClick={() => scrollToSection('meetups')}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Participer
              </button>
              <button 
                onClick={() => navigate('/boutique')}
                className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                <Store className="h-4 w-4" />
                Boutique
              </button>
              
              {gamesCount > 0 && (
                <div className="flex items-center gap-2 text-primary text-sm">
                  <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                  <span>{gamesCount} partie{gamesCount > 1 ? 's' : ''} en cours</span>
                </div>
              )}
            </div>

            {/* Desktop CTA */}
            <div className="hidden md:flex items-center gap-3">
              <ThemeToggle />
              {(isAdmin || isSuperAdmin) && (
                <ForestButton 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate('/admin/subscriptions')}
                >
                  <Shield className="h-4 w-4" />
                  Administration
                </ForestButton>
              )}
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
              <UserAvatarButton size="sm" />
            </div>

            {/* Mobile: Theme toggle + avatar + menu button */}
            <div className="md:hidden flex items-center gap-2">
              <ThemeToggle />
              <UserAvatarButton size="sm" />
              <button 
                className="p-2"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-border">
              <div className="flex flex-col gap-2">
                {/* Profile section at the top of mobile menu */}
                <div className="flex items-center gap-3 pb-3 border-b border-border">
                  <UserAvatarButton size="md" />
                  <span className="text-sm text-muted-foreground">Mon profil</span>
                </div>
                
                {/* Quick actions */}
                {user && (
                  <div className="flex flex-col gap-1 pb-3 border-b border-border">
                    <button
                      onClick={() => { navigate('/profile'); setMobileMenuOpen(false); }}
                      className="flex items-center gap-2 text-left text-foreground hover:text-primary transition-colors py-2 px-2 rounded-md hover:bg-muted/50"
                    >
                      <User className="h-4 w-4" />
                      Profil
                    </button>
                    
                    {(isAdmin || isSuperAdmin) && (
                      <button
                        onClick={() => { navigate('/admin/subscriptions'); setMobileMenuOpen(false); }}
                        className="flex items-center gap-2 text-left text-primary hover:text-primary/80 transition-colors py-2 px-2 rounded-md hover:bg-muted/50"
                      >
                        <Shield className="h-4 w-4" />
                        Administration
                      </button>
                    )}
                    
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-2 text-left text-destructive hover:text-destructive/80 transition-colors py-2 px-2 rounded-md hover:bg-muted/50"
                    >
                      <LogOut className="h-4 w-4" />
                      Se déconnecter
                    </button>
                  </div>
                )}
                
                <button 
                  onClick={() => scrollToSection('concept')}
                  className="text-left text-muted-foreground hover:text-foreground transition-colors py-2"
                >
                  Concept
                </button>
                <button 
                  onClick={() => scrollToSection('jeux')}
                  className="text-left text-muted-foreground hover:text-foreground transition-colors py-2"
                >
                  Jeux
                </button>
                <button 
                  onClick={() => scrollToSection('clans')}
                  className="text-left text-muted-foreground hover:text-foreground transition-colors py-2"
                >
                  Clans
                </button>
                <button 
                  onClick={() => scrollToSection('meetups')}
                  className="text-left text-muted-foreground hover:text-foreground transition-colors py-2"
                >
                  Participer
                </button>
                <button 
                  onClick={() => { navigate('/boutique'); setMobileMenuOpen(false); }}
                  className="flex items-center gap-2 text-left text-muted-foreground hover:text-foreground transition-colors py-2"
                >
                  <Store className="h-4 w-4" />
                  Boutique
                </button>
                {gamesCount > 0 && (
                  <div className="flex items-center gap-2 text-primary text-sm py-2">
                    <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                    <span>{gamesCount} partie{gamesCount > 1 ? 's' : ''} en cours</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </nav>

      <JoinGameModal open={joinModalOpen} onOpenChange={setJoinModalOpen} />
    </>
  );
}
