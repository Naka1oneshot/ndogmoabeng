import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type ColorMode = 'dark' | 'light';

interface ColorModeContextType {
  colorMode: ColorMode;
  setColorMode: (mode: ColorMode) => void;
  toggleColorMode: () => void;
}

const ColorModeContext = createContext<ColorModeContextType | undefined>(undefined);

const STORAGE_KEY = 'ndgm_theme';

interface ColorModeProviderProps {
  children: ReactNode;
}

export function ColorModeProvider({ children }: ColorModeProviderProps) {
  const [colorMode, setColorModeState] = useState<ColorMode>(() => {
    // Initialize from localStorage or default to dark
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') {
        return stored;
      }
    }
    return 'dark';
  });

  // Apply color mode class to document
  useEffect(() => {
    const root = document.documentElement;
    
    // Remove existing mode classes
    root.classList.remove('mode-dark', 'mode-light');
    
    // Add current mode class
    root.classList.add(`mode-${colorMode}`);
    
    // Store in localStorage for persistence
    localStorage.setItem(STORAGE_KEY, colorMode);
  }, [colorMode]);

  const setColorMode = (mode: ColorMode) => {
    setColorModeState(mode);
  };

  const toggleColorMode = () => {
    setColorModeState(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <ColorModeContext.Provider value={{ colorMode, setColorMode, toggleColorMode }}>
      {children}
    </ColorModeContext.Provider>
  );
}

export function useColorMode() {
  const context = useContext(ColorModeContext);
  if (context === undefined) {
    throw new Error('useColorMode must be used within a ColorModeProvider');
  }
  return context;
}
