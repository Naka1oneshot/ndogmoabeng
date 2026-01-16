import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ForestButton } from '@/components/ui/ForestButton';
import { JoinGameModal } from '@/components/game/JoinGameModal';
import { Users, Gamepad2 } from 'lucide-react';
import logoNdogmoabeng from '@/assets/logo-ndogmoabeng.png';

export default function Index() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [joinModalOpen, setJoinModalOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-32 h-32 mb-6 animate-float">
          <img src={logoNdogmoabeng} alt="Ndogmoabeng" className="w-full h-full object-contain" />
        </div>
        <h1 className="font-display text-3xl md:text-4xl text-glow mb-4">
          La Forêt de Ndogmoabeng
        </h1>
        <p className="text-muted-foreground text-lg max-w-md mx-auto">
          Un jeu de rôle mystique où chaque décision façonne votre destin
        </p>
      </div>

      <div className="w-full max-w-sm space-y-4">
        <ForestButton 
          className="w-full" 
          size="lg"
          onClick={() => navigate(user ? '/mj' : '/auth')}
        >
          <Gamepad2 className="h-5 w-5" />
          {user ? 'Tableau MJ' : 'Créer une partie'}
        </ForestButton>

        <ForestButton 
          variant="secondary" 
          className="w-full" 
          size="lg"
          onClick={() => setJoinModalOpen(true)}
        >
          <Users className="h-5 w-5" />
          Rejoindre une partie
        </ForestButton>
      </div>

      <footer className="mt-12 text-center text-muted-foreground text-sm">
        <p>Entrez dans la forêt mystique...</p>
      </footer>

      <JoinGameModal 
        open={joinModalOpen} 
        onOpenChange={setJoinModalOpen} 
      />
    </div>
  );
}
