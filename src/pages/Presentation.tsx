import { useParams, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PresentationModeView } from "@/components/mj/presentation/PresentationModeView";
import { RivieresPresentationView } from "@/components/rivieres/presentation/RivieresPresentationView";
import { InfectionPresentationView } from "@/components/infection/presentation/InfectionPresentationView";
import { SheriffPresentationView } from "@/components/sheriff/presentation/SheriffPresentationView";
import { AdventureCinematicDebugPanel } from "@/components/adventure/AdventureCinematicDebugPanel";
import { useAdventureCinematic } from "@/hooks/useAdventureCinematic";
import { Button } from "@/components/ui/button";
import { AlertTriangle, LogIn } from "lucide-react";

interface Game {
  id: string;
  name: string;
  status: string;
  phase: string;
  phase_locked: boolean;
  manche_active: number;
  selected_game_type_code: string | null;
  current_session_game_id: string | null;
  mode?: string;
  adventure_id?: string | null;
}

const Presentation = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const { user, session, loading: authLoading } = useAuth();
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);

  // Log auth state on mount for debugging
  useEffect(() => {
    console.log('[PRESENTATION] Auth state:', {
      userId: user?.id,
      email: user?.email,
      hasSession: !!session,
      authLoading,
    });
  }, [user, session, authLoading]);

  // Adventure cinematic hook for debug panel (MJ side)
  const isAdventureMode = game?.mode === 'ADVENTURE';
  const {
    broadcastCinematic,
    debugState: cinematicDebugState,
  } = useAdventureCinematic(isAdventureMode ? gameId : undefined, {
    enabled: isAdventureMode,
  });

  useEffect(() => {
    if (!gameId) return;

    const fetchGame = async () => {
      const { data, error } = await supabase
        .from("games")
        .select("id, name, status, phase, phase_locked, manche_active, selected_game_type_code, current_session_game_id, mode, adventure_id")
        .eq("id", gameId)
        .single();

      if (!error && data) {
        setGame(data);
      }
      setLoading(false);
    };

    fetchGame();

    // Subscribe to game updates
    const channel = supabase
      .channel(`presentation-game-${gameId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${gameId}` },
        (payload) => {
          setGame(payload.new as Game);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  // Show loading while auth is initializing
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Chargement...</div>
      </div>
    );
  }

  // Guard: No Supabase session detected
  if (!session || !user) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-6 p-4">
        <div className="flex items-center gap-3 text-destructive">
          <AlertTriangle className="w-8 h-8" />
          <span className="text-xl font-semibold">Session Supabase absente</span>
        </div>
        <p className="text-muted-foreground text-center max-w-md">
          Vous devez être connecté pour accéder à la vue présentation MJ.
          Les fonctionnalités comme le broadcast de cinématiques nécessitent une authentification.
        </p>
        <Button
          onClick={() => window.location.href = '/auth'}
          className="flex items-center gap-2"
        >
          <LogIn className="w-4 h-4" />
          Se connecter
        </Button>
        <p className="text-muted-foreground text-sm">
          Après connexion, revenez sur cette page.
        </p>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Partie introuvable</div>
      </div>
    );
  }

  // Debug panel for MJ (visible in adventure mode)
  const debugPanel = isAdventureMode ? (
    <AdventureCinematicDebugPanel
      gameId={gameId}
      isHost={true}
      debugState={cinematicDebugState}
      onBroadcastTest={broadcastCinematic}
    />
  ) : null;

  // Route to appropriate presentation based on game type
  if (game.selected_game_type_code === 'RIVIERES') {
    return (
      <>
        {debugPanel}
        <RivieresPresentationView game={game} onClose={() => window.close()} />
      </>
    );
  }

  if (game.selected_game_type_code === 'INFECTION') {
    return (
      <>
        {debugPanel}
        <InfectionPresentationView game={game} onClose={() => window.close()} />
      </>
    );
  }

  if (game.selected_game_type_code === 'SHERIFF') {
    return (
      <>
        {debugPanel}
        <SheriffPresentationView game={game} onClose={() => window.close()} />
      </>
    );
  }

  // Default to Forest presentation
  return (
    <>
      {debugPanel}
      <PresentationModeView game={game} onClose={() => window.close()} />
    </>
  );
};

export default Presentation;
