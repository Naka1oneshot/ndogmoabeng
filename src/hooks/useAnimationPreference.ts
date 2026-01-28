import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'ndogmoabeng_animations_enabled';

export function useAnimationPreference() {
  const [animationsEnabled, setAnimationsEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? true : stored === 'true';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(animationsEnabled));
  }, [animationsEnabled]);

  const toggleAnimations = useCallback(() => {
    setAnimationsEnabled(prev => !prev);
  }, []);

  return {
    animationsEnabled,
    setAnimationsEnabled,
    toggleAnimations,
  };
}
