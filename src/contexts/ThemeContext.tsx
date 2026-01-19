import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export type GameTheme = 'VILLAGE' | 'RIVIERES' | 'FORET' | 'INFECTION';

interface ThemeContextType {
  theme: GameTheme;
  setTheme: (theme: GameTheme) => void;
  isInGame: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Routes that are considered "in-game"
const IN_GAME_ROUTES = ['/mj', '/player/'];

// Map game type codes to themes
const GAME_TYPE_TO_THEME: Record<string, GameTheme> = {
  'RIVIERES': 'RIVIERES',
  'FORET': 'FORET',
  'INFECTION': 'INFECTION',
};

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<GameTheme>('VILLAGE');
  const [isInGame, setIsInGame] = useState(false);
  const location = useLocation();

  // Extract gameId from URL if present
  const getGameIdFromPath = (): string | null => {
    const pathParts = location.pathname.split('/');
    
    // /mj route - need to get game from MJ's current session
    if (location.pathname === '/mj') {
      return null; // Will be handled by MJ page itself
    }
    
    // /player/:gameId route
    if (pathParts[1] === 'player' && pathParts[2]) {
      return pathParts[2];
    }
    
    return null;
  };

  // Check if current route is in-game
  const checkIsInGame = (): boolean => {
    return IN_GAME_ROUTES.some(route => location.pathname.startsWith(route));
  };

  // Fetch game type and determine theme
  const fetchGameTheme = async (gameId: string): Promise<GameTheme> => {
    try {
      // First try to get the current session game's type
      const { data: game, error } = await supabase
        .from('games')
        .select(`
          selected_game_type_code,
          mode,
          current_session_game_id,
          session_games!fk_games_current_session_game(game_type_code)
        `)
        .eq('id', gameId)
        .single();

      if (error || !game) {
        console.warn('Could not fetch game for theme:', error);
        return 'VILLAGE';
      }

      // For adventure mode, use the current session game's type
      if (game.mode === 'ADVENTURE' && game.session_games) {
        const sessionGameType = (game.session_games as any)?.game_type_code;
        if (sessionGameType && GAME_TYPE_TO_THEME[sessionGameType]) {
          return GAME_TYPE_TO_THEME[sessionGameType];
        }
      }

      // For standalone mode, use the selected game type
      if (game.selected_game_type_code && GAME_TYPE_TO_THEME[game.selected_game_type_code]) {
        return GAME_TYPE_TO_THEME[game.selected_game_type_code];
      }

      return 'VILLAGE';
    } catch (err) {
      console.error('Error fetching game theme:', err);
      return 'VILLAGE';
    }
  };

  // Update theme based on route and game
  useEffect(() => {
    const updateTheme = async () => {
      const inGame = checkIsInGame();
      setIsInGame(inGame);

      if (!inGame) {
        // Not in game - use VILLAGE theme
        setThemeState('VILLAGE');
        return;
      }

      // In game - try to determine game type
      const gameId = getGameIdFromPath();
      
      if (gameId) {
        const gameTheme = await fetchGameTheme(gameId);
        setThemeState(gameTheme);
      } else {
        // MJ page without gameId in URL - will be set by MJ page
        // Keep current theme or default to VILLAGE
      }
    };

    updateTheme();
  }, [location.pathname]);

  // Apply theme class to document
  useEffect(() => {
    const root = document.documentElement;
    
    // Remove all theme classes
    root.classList.remove('theme-village', 'theme-rivieres', 'theme-foret', 'theme-infection');
    
    // Add current theme class
    root.classList.add(`theme-${theme.toLowerCase()}`);
    
    // Store in localStorage for persistence
    localStorage.setItem('ndogmoabeng-theme', theme);
  }, [theme]);

  const setTheme = (newTheme: GameTheme) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isInGame }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// Hook for game pages to set theme based on game type
export function useGameTheme(gameTypeCode: string | null | undefined) {
  const { setTheme, isInGame } = useTheme();

  useEffect(() => {
    if (isInGame && gameTypeCode && GAME_TYPE_TO_THEME[gameTypeCode]) {
      setTheme(GAME_TYPE_TO_THEME[gameTypeCode]);
    }
  }, [gameTypeCode, isInGame, setTheme]);
}
