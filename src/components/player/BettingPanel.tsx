import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ForestButton } from '@/components/ui/ForestButton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Check, Lock, Coins, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Game {
  id: string;
  manche_active: number;
  phase: string;
  phase_locked: boolean;
}

interface Player {
  playerNumber: number;
  jetons: number;
}

interface BettingPanelProps {
  game: Game;
  player: Player;
  className?: string;
}

export function BettingPanel({ game, player, className }: BettingPanelProps) {
  const [submitting, setSubmitting] = useState(false);
  const [mise, setMise] = useState('0');
  const [currentBet, setCurrentBet] = useState<number | null>(null);

  const isActivePhase = game.phase === 'PHASE1_MISES';
  const isLocked = game.phase_locked;

  useEffect(() => {
    fetchCurrentBet();

    // Subscribe to real-time bet updates
    const channel = supabase
      .channel(`player-bets-${game.id}-${player.playerNumber}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'round_bets', 
        filter: `game_id=eq.${game.id}` 
      }, fetchCurrentBet)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [game.id, game.manche_active, player.playerNumber]);

  const fetchCurrentBet = async () => {
    const { data } = await supabase
      .from('round_bets')
      .select('mise')
      .eq('game_id', game.id)
      .eq('manche', game.manche_active)
      .eq('num_joueur', player.playerNumber)
      .maybeSingle();

    if (data) {
      setCurrentBet(data.mise);
      setMise(data.mise.toString());
    } else {
      setCurrentBet(null);
      setMise('0');
    }
  };

  const handleSubmitBet = async () => {
    const miseValue = parseInt(mise, 10);
    if (isNaN(miseValue) || miseValue < 0) {
      toast.error('La mise doit être un nombre positif ou nul');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('round_bets')
        .upsert(
          {
            game_id: game.id,
            manche: game.manche_active,
            num_joueur: player.playerNumber,
            mise: miseValue,
            mise_demandee: miseValue,
            status: 'SUBMITTED',
            submitted_at: new Date().toISOString(),
          },
          { onConflict: 'game_id,manche,num_joueur' }
        );

      if (error) {
        console.error('[BettingPanel] Bet submission error:', error);
        toast.error(`Erreur: ${error.message}`);
        return;
      }

      setCurrentBet(miseValue);

      if (miseValue > player.jetons) {
        toast.warning(`Mise enregistrée, mais ${miseValue} > votre solde (${player.jetons}). Elle sera forcée à 0 à la clôture.`);
      } else {
        toast.success('Mise enregistrée !');
      }
    } catch (err) {
      console.error('[BettingPanel] Unexpected error:', err);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`p-4 ${className}`}>
      {/* Phase indicator */}
      {!isActivePhase && (
        <div className="mb-4 p-3 rounded bg-muted/50 border border-border text-center">
          <AlertCircle className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            La phase de mises n'est pas active
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Phase actuelle: {game.phase}
          </p>
        </div>
      )}

      <div className="space-y-4">
        {/* Current balance */}
        <div className="p-3 rounded bg-secondary/50 border border-border text-center">
          <p className="text-xs text-muted-foreground">Votre solde</p>
          <div className="flex items-center justify-center gap-2">
            <Coins className="h-5 w-5 text-yellow-500" />
            <p className="text-xl font-bold text-yellow-500">{player.jetons} jetons</p>
          </div>
        </div>

        {currentBet !== null && (
          <div className={`p-3 rounded border text-center ${
            currentBet > player.jetons 
              ? 'bg-amber-500/10 border-amber-500/30' 
              : 'bg-green-500/10 border-green-500/20'
          }`}>
            <p className={`text-sm ${currentBet > player.jetons ? 'text-amber-400' : 'text-green-400'}`}>
              Mise soumise
            </p>
            <p className={`text-2xl font-bold ${currentBet > player.jetons ? 'text-amber-500' : 'text-green-500'}`}>
              {currentBet} jetons
            </p>
            {currentBet > player.jetons && (
              <p className="text-xs text-amber-400 mt-1">
                ⚠️ Supérieure à votre solde - sera forcée à 0
              </p>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="mise">Votre mise (max recommandé: {player.jetons})</Label>
          <Input
            id="mise"
            type="number"
            min="0"
            value={mise}
            onChange={(e) => setMise(e.target.value)}
            disabled={isLocked || !isActivePhase}
            className={`bg-background/50 ${
              parseInt(mise) > player.jetons ? 'border-amber-500 focus:border-amber-500' : ''
            }`}
          />
          {parseInt(mise) > player.jetons && (
            <p className="text-xs text-amber-500">
              Attention: cette mise dépasse votre solde et sera forcée à 0 à la clôture
            </p>
          )}
        </div>

        <ForestButton
          onClick={handleSubmitBet}
          disabled={submitting || isLocked || !isActivePhase}
          className="w-full"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Check className="h-4 w-4 mr-2" />
              {currentBet !== null ? 'Modifier ma mise' : 'Valider ma mise'}
            </>
          )}
        </ForestButton>

        {isLocked && isActivePhase && (
          <p className="text-xs text-center text-amber-500">
            <Lock className="h-3 w-3 inline mr-1" />
            Phase verrouillée par le MJ
          </p>
        )}
      </div>
    </div>
  );
}
