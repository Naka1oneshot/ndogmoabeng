import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ForestButton } from '@/components/ui/ForestButton';
import { JoinGameModal } from '@/components/game/JoinGameModal';
import { Gamepad2, LogIn, ShoppingBag } from 'lucide-react';

export function MobileBottomBar() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [joinModalOpen, setJoinModalOpen] = useState(false);

  return (
    <>
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border p-3">
        <div className="flex gap-2">
          <ForestButton 
            variant="secondary" 
            className="flex-1"
            onClick={() => setJoinModalOpen(true)}
          >
            <LogIn className="h-4 w-4" />
            Rejoindre
          </ForestButton>
          <ForestButton 
            variant="ghost"
            className="px-3"
            onClick={() => navigate('/boutique')}
          >
            <ShoppingBag className="h-4 w-4" />
          </ForestButton>
          <ForestButton 
            className="flex-1"
            onClick={() => navigate(user ? '/mj' : '/auth')}
          >
            <Gamepad2 className="h-4 w-4" />
            Créer
          </ForestButton>
        </div>
      </div>

      <JoinGameModal open={joinModalOpen} onOpenChange={setJoinModalOpen} />
    </>
  );
}
