import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PresentationModeView } from "@/components/mj/presentation/PresentationModeView";
import { RivieresPresentationView } from "@/components/rivieres/presentation/RivieresPresentationView";
import { InfectionPresentationView } from "@/components/infection/presentation/InfectionPresentationView";
import { SheriffPresentationView } from "@/components/sheriff/presentation/SheriffPresentationView";

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
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Chargement...</div>
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

  // Route to appropriate presentation based on game type
  if (game.selected_game_type_code === 'RIVIERES') {
    return <RivieresPresentationView game={game} onClose={() => window.close()} />;
  }

  if (game.selected_game_type_code === 'INFECTION') {
    return <InfectionPresentationView game={game} onClose={() => window.close()} />;
  }

  if (game.selected_game_type_code === 'SHERIFF') {
    return <SheriffPresentationView game={game} onClose={() => window.close()} />;
  }

  // Default to Forest presentation
  return <PresentationModeView game={game} onClose={() => window.close()} />;
};

export default Presentation;
