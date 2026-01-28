import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface GameTypeData {
  code: string;
  name: string;
  description: string | null;
  tagline: string | null;
  lieu: string | null;
  clan: string | null;
  personnages: string[] | null;
  objet_cle: string | null;
  image_url: string | null;
  min_players: number;
  is_active: boolean;
  status: string;
  homepage_order: number | null;
}

export function useGameTypes() {
  const [gameTypes, setGameTypes] = useState<GameTypeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchGameTypes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('game_types')
        .select('code, name, description, tagline, lieu, clan, personnages, objet_cle, image_url, min_players, is_active, status, homepage_order')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setGameTypes(data || []);
    } catch (err) {
      setError(err as Error);
      console.error('Error fetching game types:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGameTypes();
  }, []);

  return { gameTypes, loading, error, refetch: fetchGameTypes };
}
