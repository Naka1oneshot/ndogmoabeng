import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ForestButton } from '@/components/ui/ForestButton';
import { Badge } from '@/components/ui/badge';
import { 
  Lock, Unlock, ArrowRight, RotateCcw, Loader2, 
  CheckCircle2, AlertCircle, Users, ClipboardList
} from 'lucide-react';
import { toast } from 'sonner';

interface Game {
  id: string;
  status: string;
  manche_active: number;
  phase: string;
  phase_locked: boolean;
}

interface MJPhasesTabProps {
  game: Game;
  onGameUpdate: () => void;
}

const PHASE_LABELS: Record<string, string> = {
  'PHASE1_MISES': 'Phase 1 - Mises',
  'PHASE2_POSITIONS': 'Phase 2 - Positions',
  'PHASE3_SHOP': 'Phase 3 - Boutique',
  'PHASE4_COMBAT': 'Phase 4 - Combat',
  'RESOLUTION': 'Résolution',
};

export function MJPhasesTab({ game, onGameUpdate }: MJPhasesTabProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [playerCount, setPlayerCount] = useState(0);
  const [submissionCount, setSubmissionCount] = useState(0);

  useEffect(() => {
    fetchStats();
    
    const channel = supabase
      .channel(`mj-phases-stats-${game.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${game.id}` }, fetchStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'round_bets', filter: `game_id=eq.${game.id}` }, fetchStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'actions', filter: `game_id=eq.${game.id}` }, fetchStats)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [game.id, game.phase, game.manche_active]);

  const fetchStats = async () => {
    // Count active players
    const { count: players } = await supabase
      .from('game_players')
      .select('*', { count: 'exact', head: true })
      .eq('game_id', game.id)
      .eq('status', 'ACTIVE')
      .eq('is_host', false);

    setPlayerCount(players || 0);

    // Count submissions based on current phase
    let submissions = 0;
    if (game.phase === 'PHASE1_MISES') {
      const { count } = await supabase
        .from('round_bets')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id)
        .eq('manche', game.manche_active);
      submissions = count || 0;
    } else if (game.phase === 'PHASE2_POSITIONS') {
      const { count } = await supabase
        .from('actions')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id)
        .eq('manche', game.manche_active);
      submissions = count || 0;
    }
    setSubmissionCount(submissions);
  };

  const handleAction = async (action: string) => {
    setLoading(action);
    try {
      const { data, error } = await supabase.functions.invoke('manage-phase', {
        body: { gameId: game.id, action },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || 'Erreur lors de l\'action');
      }

      toast.success(getActionMessage(action));
      onGameUpdate();
    } catch (error: any) {
      console.error('Phase action error:', error);
      toast.error(error.message || 'Erreur');
    } finally {
      setLoading(null);
    }
  };

  const getActionMessage = (action: string): string => {
    switch (action) {
      case 'lock_phase': return 'Phase verrouillée';
      case 'unlock_phase': return 'Phase déverrouillée';
      case 'next_phase': return 'Phase suivante démarrée';
      case 'next_round': return 'Nouvelle manche démarrée';
      default: return 'Action effectuée';
    }
  };

  const isResolution = game.phase === 'RESOLUTION';
  const allSubmitted = submissionCount >= playerCount && playerCount > 0;

  return (
    <div className="space-y-6">
      {/* État actuel */}
      <div className="card-gradient rounded-lg border border-border p-6">
        <h3 className="font-display text-lg mb-4">État de la partie</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-secondary/50 rounded-lg">
            <div className="text-3xl font-bold text-primary">{game.manche_active}</div>
            <div className="text-sm text-muted-foreground">Manche</div>
          </div>
          
          <div className="text-center p-4 bg-secondary/50 rounded-lg col-span-2">
            <div className="text-lg font-semibold text-primary mb-1">
              {PHASE_LABELS[game.phase] || game.phase}
            </div>
            <Badge variant={game.phase_locked ? 'destructive' : 'default'}>
              {game.phase_locked ? (
                <><Lock className="h-3 w-3 mr-1" /> Verrouillée</>
              ) : (
                <><Unlock className="h-3 w-3 mr-1" /> Ouverte</>
              )}
            </Badge>
          </div>
          
          <div className="text-center p-4 bg-secondary/50 rounded-lg">
            <div className="text-3xl font-bold text-primary">{playerCount}</div>
            <div className="text-sm text-muted-foreground">Joueurs</div>
          </div>
        </div>
      </div>

      {/* Contrôles de phase */}
      <div className="card-gradient rounded-lg border border-border p-6">
        <h3 className="font-display text-lg mb-4">Contrôles</h3>
        
        <div className="flex flex-wrap gap-3">
          {game.phase_locked ? (
            <ForestButton
              variant="outline"
              onClick={() => handleAction('unlock_phase')}
              disabled={loading !== null}
            >
              {loading === 'unlock_phase' ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Unlock className="h-4 w-4 mr-2" />
              )}
              Déverrouiller la phase
            </ForestButton>
          ) : (
            <ForestButton
              onClick={() => handleAction('lock_phase')}
              disabled={loading !== null}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {loading === 'lock_phase' ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Lock className="h-4 w-4 mr-2" />
              )}
              Verrouiller la phase
            </ForestButton>
          )}

          <ForestButton
            variant="outline"
            onClick={() => handleAction('next_phase')}
            disabled={loading !== null || isResolution}
          >
            {loading === 'next_phase' ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <ArrowRight className="h-4 w-4 mr-2" />
            )}
            Phase suivante
          </ForestButton>

          <ForestButton
            variant="outline"
            onClick={() => handleAction('next_round')}
            disabled={loading !== null}
            className="border-green-500/50 text-green-500 hover:bg-green-500/10"
          >
            {loading === 'next_round' ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RotateCcw className="h-4 w-4 mr-2" />
            )}
            Manche suivante
          </ForestButton>
        </div>
      </div>

      {/* Checklist */}
      <div className="card-gradient rounded-lg border border-border p-6">
        <h3 className="font-display text-lg mb-4 flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          Checklist
        </h3>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-muted-foreground" />
              <span>Joueurs actifs</span>
            </div>
            <Badge variant={playerCount > 0 ? 'default' : 'secondary'}>
              {playerCount}
            </Badge>
          </div>

          {(game.phase === 'PHASE1_MISES' || game.phase === 'PHASE2_POSITIONS') && (
            <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
              <div className="flex items-center gap-3">
                {allSubmitted ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                )}
                <span>Soumissions reçues</span>
              </div>
              <Badge variant={allSubmitted ? 'default' : 'secondary'}>
                {submissionCount} / {playerCount}
              </Badge>
            </div>
          )}

          {!allSubmitted && playerCount > 0 && (game.phase === 'PHASE1_MISES' || game.phase === 'PHASE2_POSITIONS') && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <p className="text-sm text-amber-200">
                <AlertCircle className="h-4 w-4 inline mr-2" />
                {playerCount - submissionCount} joueur(s) n'ont pas encore soumis leurs actions
              </p>
            </div>
          )}

          {allSubmitted && playerCount > 0 && (
            <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <p className="text-sm text-green-200">
                <CheckCircle2 className="h-4 w-4 inline mr-2" />
                Tous les joueurs ont soumis. Vous pouvez verrouiller et passer à la phase suivante.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
