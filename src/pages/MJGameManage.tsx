import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { MJDashboard } from '@/components/mj/MJDashboard';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Game {
  id: string;
  name: string;
  join_code: string;
  status: string;
  manche_active: number;
  sens_depart_egalite: string;
  x_nb_joueurs: number;
  starting_tokens: number;
  phase: string;
  phase_locked: boolean;
  created_at: string;
  active_players?: number;
  current_session_game_id: string | null;
  mode: string;
  adventure_id: string | null;
  current_step_index: number;
  selected_game_type_code: string | null;
  is_public?: boolean;
  host_user_id?: string;
}

export default function MJGameManage() {
  const { user, loading: authLoading } = useAuth();
  const { isAdminOrSuper, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const { gameId } = useParams<{ gameId: string }>();
  
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && gameId && !authLoading && !roleLoading) {
      fetchGame();
    }
  }, [user, gameId, authLoading, roleLoading, isAdminOrSuper]);

  const fetchGame = async () => {
    if (!gameId || !user) return;
    
    setLoading(true);
    try {
      // Build query - admins can see all games, users only their own
      let query = supabase
        .from('games')
        .select('*')
        .eq('id', gameId);
      
      if (!isAdminOrSuper) {
        query = query.eq('host_user_id', user.id);
      }
      
      const { data, error } = await query.maybeSingle();

      if (error) throw error;

      if (!data) {
        toast.error('Partie non trouvée ou accès non autorisé');
        navigate('/mj');
        return;
      }

      // Fetch player count
      const { count } = await supabase
        .from('game_players')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', data.id)
        .eq('status', 'ACTIVE')
        .eq('is_host', false);

      setGame({ ...data, active_players: count || 0 } as Game);
    } catch (error) {
      console.error('Error fetching game:', error);
      toast.error('Erreur lors du chargement de la partie');
      navigate('/mj');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/mj');
  };

  if (authLoading || roleLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !game) {
    return null;
  }

  return (
    <div className="min-h-screen px-4 py-6">
      <main className="max-w-5xl mx-auto">
        <MJDashboard 
          game={game} 
          onBack={handleBack} 
        />
      </main>
    </div>
  );
}
