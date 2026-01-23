import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useActiveGames } from '@/hooks/useActiveGames';
import { ForestButton } from '@/components/ui/ForestButton';
import { JoinGameModal } from '@/components/game/JoinGameModal';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Gamepad2, QrCode, Users, Sparkles, Eye, ShoppingBag } from 'lucide-react';
import logoNdogmoabeng from '@/assets/logo-ndogmoabeng.png';

export function HeroSection() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { gamesCount, playersCount } = useActiveGames();
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [sessionCode, setSessionCode] = useState('');

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (sessionCode.trim()) {
      navigate(`/join/${sessionCode.trim().toUpperCase()}`);
    }
  };

  const handleScanQR = () => {
    setJoinModalOpen(true);
  };

  return (
    <section className="min-h-screen flex items-center pt-20 pb-16 md:pb-8" aria-labelledby="hero-title">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left: Title & Subtitle */}
          <header className="text-center md:text-left">
            <div className="inline-flex items-center justify-center w-24 h-24 md:w-32 md:h-32 mb-6 animate-float">
              <img 
                src={logoNdogmoabeng} 
                alt="Logo Ndogmoabeng - Jeux de société interactifs" 
                className="w-full h-full object-contain"
                width={128}
                height={128}
              />
            </div>
            <h1 id="hero-title" className="font-display text-4xl md:text-5xl lg:text-6xl text-glow mb-6">
              Ndogmoabeng
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-lg mx-auto md:mx-0 mb-8">
              Un univers de jeux immersifs. Sept clans, des choix, du bluff et une mémoire à défendre.
            </p>
            
            {/* Stats - Always visible counter */}
            <div className="flex items-center justify-center md:justify-start gap-6 text-sm">
              <div className="flex items-center gap-2 text-primary">
                <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                <Sparkles className="h-4 w-4" />
                <span>{gamesCount} partie{gamesCount !== 1 ? 's' : ''} en cours</span>
              </div>
              {playersCount > 0 && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{playersCount} joueur{playersCount > 1 ? 's' : ''} actif{playersCount > 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          </header>

          {/* Right: CTA Card */}
          <aside className="flex justify-center md:justify-end">
            <Card className="w-full max-w-md card-gradient border-border/50">
              <CardContent className="p-6">
                <h2 className="font-display text-xl mb-6 text-center">
                  Accéder à une partie
                </h2>

                {/* Code input form */}
                <form onSubmit={handleCodeSubmit} className="space-y-4 mb-6">
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">
                      Code de session
                    </label>
                    <Input
                      type="text"
                      placeholder="Ex: ABC123"
                      value={sessionCode}
                      onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                      className="text-center text-lg tracking-widest uppercase"
                      maxLength={6}
                    />
                  </div>
                  <ForestButton 
                    type="submit" 
                    className="w-full"
                    disabled={!sessionCode.trim()}
                  >
                    Rejoindre
                  </ForestButton>
                </form>

                {/* Separator */}
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">ou</span>
                  </div>
                </div>

                {/* Other actions */}
                <div className="space-y-3">
                  <ForestButton 
                    variant="secondary" 
                    className="w-full"
                    onClick={handleScanQR}
                  >
                    <QrCode className="h-4 w-4" />
                    Scanner un QR Code
                  </ForestButton>

                  <ForestButton 
                    variant="secondary" 
                    className="w-full"
                    onClick={() => navigate(user ? '/mj' : '/auth')}
                  >
                    <Gamepad2 className="h-4 w-4" />
                    Créer une partie (MJ)
                  </ForestButton>

                  {/* Watch a game */}
                  <ForestButton 
                    variant="ghost" 
                    className="w-full"
                    onClick={() => navigate('/watch')}
                  >
                    <Eye className="h-4 w-4" />
                    Regarder une partie
                  </ForestButton>

                  {/* Shop */}
                  <ForestButton 
                    variant="ghost" 
                    className="w-full"
                    onClick={() => navigate('/boutique')}
                  >
                    <ShoppingBag className="h-4 w-4" />
                    Boutique
                  </ForestButton>
                </div>

                {/* Stats under CTA - always visible */}
                <div className="mt-6 pt-4 border-t border-border text-center">
                  <p className="text-sm text-muted-foreground">
                    <span className="text-primary font-semibold">{gamesCount}</span> partie{gamesCount !== 1 ? 's' : ''} en cours
                  </p>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>

      <JoinGameModal open={joinModalOpen} onOpenChange={setJoinModalOpen} />
    </section>
  );
}
