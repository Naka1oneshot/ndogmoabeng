import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Skull, Trophy, Sparkles, Swords } from 'lucide-react';

interface CoupDeGraceInfo {
  killerName: string;
  monsterName: string;
  reward: number;
}

interface PresentationAnimationsProps {
  gameId: string;
  sessionGameId: string | null;
  phase: string;
  enabled?: boolean;
}

export function usePresentationAnimations({
  gameId,
  sessionGameId,
  phase,
  enabled = true,
}: PresentationAnimationsProps) {
  const [showPhaseTransition, setShowPhaseTransition] = useState(false);
  const [phaseTransitionText, setPhaseTransitionText] = useState('');
  const [showCoupDeGrace, setShowCoupDeGrace] = useState(false);
  const [coupDeGraceInfo, setCoupDeGraceInfo] = useState<CoupDeGraceInfo | null>(null);
  
  // Track the previous phase to detect actual changes
  const previousPhaseRef = useRef<string | null>(null);
  const previousKillsCountRef = useRef<number>(0);
  // Track if the hook has been properly initialized (not just first render)
  const isInitializedRef = useRef(false);
  // Track the last enabled state to detect when hook becomes active
  const wasEnabledRef = useRef(false);

  const triggerPhaseTransition = useCallback((newPhase: string) => {
    const phaseNames: Record<string, string> = {
      'PHASE1_MISES': 'Phase des Mises',
      'PHASE2_POSITIONS': 'Phase des Actions',
      'PHASE3_SHOP': 'Phase Boutique',
      'SHOP': 'Phase Boutique',
      'PHASE4_COMBAT': 'Résolution du Combat',
      'RESOLUTION': 'Résolution du Combat',
    };
    setPhaseTransitionText(phaseNames[newPhase] || newPhase);
    setShowPhaseTransition(true);
    setTimeout(() => setShowPhaseTransition(false), 2500);
  }, []);

  const triggerCoupDeGrace = useCallback((killInfo: CoupDeGraceInfo) => {
    setCoupDeGraceInfo(killInfo);
    setShowCoupDeGrace(true);
    setTimeout(() => setShowCoupDeGrace(false), 3500);
  }, []);

  // Phase change detection - only trigger on actual phase changes after initialization
  useEffect(() => {
    // If hook is not enabled, reset state and return
    if (!enabled) {
      wasEnabledRef.current = false;
      return;
    }

    // If hook just became enabled (player joined mid-game), just record current phase without animating
    if (!wasEnabledRef.current) {
      wasEnabledRef.current = true;
      previousPhaseRef.current = phase;
      isInitializedRef.current = true;
      return;
    }

    // If not yet initialized (shouldn't happen at this point but safety check)
    if (!isInitializedRef.current) {
      previousPhaseRef.current = phase;
      isInitializedRef.current = true;
      return;
    }

    // Only trigger animation if phase actually changed from a known previous phase
    if (previousPhaseRef.current !== null && previousPhaseRef.current !== phase) {
      triggerPhaseTransition(phase);
    }
    
    previousPhaseRef.current = phase;
  }, [phase, enabled, triggerPhaseTransition]);

  // Subscribe to combat results for coup de grâce
  useEffect(() => {
    if (!enabled || !gameId) return;

    const fetchInitialKills = async () => {
      if (!sessionGameId) return;
      
      const { data: combatResults } = await supabase
        .from('combat_results')
        .select('kills')
        .eq('game_id', gameId)
        .eq('session_game_id', sessionGameId);
      
      if (combatResults) {
        const allKills = combatResults.flatMap(r => {
          const kills = r.kills as unknown as CoupDeGraceInfo[];
          return kills || [];
        });
        previousKillsCountRef.current = allKills.length;
      }
    };

    fetchInitialKills();

    const channel = supabase
      .channel(`player-animations-${gameId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'combat_results',
          filter: `game_id=eq.${gameId}`,
        },
        async () => {
          if (!sessionGameId) return;
          
          const { data: combatResults } = await supabase
            .from('combat_results')
            .select('kills')
            .eq('game_id', gameId)
            .eq('session_game_id', sessionGameId);
          
          if (combatResults) {
            const allKills = combatResults.flatMap(r => {
              const kills = r.kills as unknown as CoupDeGraceInfo[];
              return kills || [];
            });
            
            if (allKills.length > previousKillsCountRef.current && allKills.length > 0) {
              const latestKill = allKills[allKills.length - 1];
              triggerCoupDeGrace(latestKill);
            }
            previousKillsCountRef.current = allKills.length;
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, sessionGameId, enabled, triggerCoupDeGrace]);

  return {
    showPhaseTransition,
    phaseTransitionText,
    showCoupDeGrace,
    coupDeGraceInfo,
  };
}

interface PhaseTransitionOverlayProps {
  show: boolean;
  text: string;
}

export function PhaseTransitionOverlay({ show, text }: PhaseTransitionOverlayProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 animate-fade-in">
      <div className="text-center animate-scale-in">
        <div className="relative">
          <Swords className="h-20 w-20 sm:h-24 sm:w-24 text-primary mx-auto mb-4 animate-pulse" />
          <Sparkles className="absolute -top-2 -right-2 h-8 w-8 text-amber-400 animate-pulse" />
        </div>
        <h1 className="font-display text-3xl sm:text-5xl text-primary text-glow mb-2">{text}</h1>
        <p className="text-muted-foreground text-lg">Préparez-vous...</p>
      </div>
    </div>
  );
}

interface CoupDeGraceOverlayProps {
  show: boolean;
  info: CoupDeGraceInfo | null;
}

export function CoupDeGraceOverlay({ show, info }: CoupDeGraceOverlayProps) {
  if (!show || !info) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 animate-fade-in">
      <div className="text-center animate-scale-in">
        <Skull className="h-24 w-24 sm:h-32 sm:w-32 text-red-500 mx-auto mb-4 animate-pulse" />
        <h1 className="font-display text-3xl sm:text-5xl text-red-400 mb-2 animate-pulse">
          COUP DE GRÂCE!
        </h1>
        <p className="text-xl sm:text-2xl text-foreground mb-4">
          <span className="text-primary font-bold">{info.killerName}</span>
          {' '}a terrassé{' '}
          <span className="text-amber-400 font-bold">{info.monsterName}</span>
        </p>
        <div className="flex items-center justify-center gap-2 text-amber-400">
          <Trophy className="h-6 w-6 sm:h-8 sm:w-8" />
          <span className="text-2xl sm:text-3xl font-bold">+{info.reward}</span>
        </div>
      </div>
    </div>
  );
}
