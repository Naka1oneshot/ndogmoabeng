/**
 * Centralized game configuration registry
 * 
 * Single source of truth for all game types. Adding a new game requires
 * updating ONLY this file - TypeScript will enforce completeness elsewhere.
 */

import { Trees, Ship, Syringe, Shield, Heart, Sparkles, type LucideIcon } from 'lucide-react';

/**
 * All supported game type codes.
 * Adding a new code here will trigger TypeScript errors in places
 * that need to be updated (GAME_TYPE_INFO, lazy imports, etc.)
 */
export const GAME_TYPE_CODES = ['FORET', 'RIVIERES', 'INFECTION', 'SHERIFF', 'LION'] as const;
export type GameTypeCode = typeof GAME_TYPE_CODES[number];

/**
 * Game types that have fully implemented dashboards.
 * Games not in this list will show the "In Development" placeholder.
 * Using readonly string[] to allow .includes() with any string value.
 */
export const IMPLEMENTED_GAME_TYPES: readonly string[] = ['FORET', 'RIVIERES', 'INFECTION', 'SHERIFF', 'LION'];

/**
 * Check if a game type has an implemented dashboard
 */
export function isImplementedGame(code: string | null | undefined): boolean {
  return !!code && IMPLEMENTED_GAME_TYPES.includes(code);
}

/**
 * Game visual configuration for transitions, theming, and UI
 */
export interface GameTypeInfo {
  /** Display name shown to users */
  name: string;
  /** Lucide icon component */
  icon: LucideIcon;
  /** Tailwind text color class (e.g., 'text-[#4ADE80]') */
  color: string;
  /** Background color for full-screen overlays */
  bgColor: string;
  /** Accent background for cards/badges */
  accentBg: string;
}

/**
 * Complete visual configuration for each game type.
 * Used by GameTransitionAnimation, AdventureProgressDisplay, and theming.
 * 
 * TypeScript ensures every GameTypeCode has an entry - missing entries
 * will cause a compile error.
 */
export const GAME_TYPE_INFO: Record<GameTypeCode, GameTypeInfo> = {
  FORET: {
    name: 'La Forêt',
    icon: Trees,
    color: 'text-[#4ADE80]',
    bgColor: 'bg-[#1a2f1a]',
    accentBg: 'bg-[#2d4a2d]',
  },
  RIVIERES: {
    name: 'Les Rivières',
    icon: Ship,
    color: 'text-[#D4AF37]',
    bgColor: 'bg-[#0B1020]',
    accentBg: 'bg-[#1B4D3E]',
  },
  INFECTION: {
    name: 'Infection',
    icon: Syringe,
    color: 'text-[#B00020]',
    bgColor: 'bg-[#0B0E14]',
    accentBg: 'bg-[#1A2235]',
  },
  SHERIFF: {
    name: 'Le Shérif',
    icon: Shield,
    color: 'text-[#F59E0B]',
    bgColor: 'bg-[#1C1917]',
    accentBg: 'bg-[#422006]',
  },
  LION: {
    name: 'Le CŒUR du Lion',
    icon: Heart,
    color: 'text-rose-400',
    bgColor: 'bg-[#1a1215]',
    accentBg: 'bg-[#3d1f2a]',
  },
};

/**
 * Default/fallback configuration for unknown game types.
 * Should rarely be used - prefer explicit handling.
 */
export const DEFAULT_GAME_INFO: GameTypeInfo = {
  name: 'Jeu',
  icon: Sparkles,
  color: 'text-primary',
  bgColor: 'bg-background',
  accentBg: 'bg-secondary',
};

/**
 * Get game info with fallback to defaults.
 * Logs a warning if an unknown game type is encountered.
 */
export function getGameInfo(code: string | null | undefined): GameTypeInfo {
  if (!code) return DEFAULT_GAME_INFO;
  
  const info = GAME_TYPE_INFO[code as GameTypeCode];
  if (!info) {
    console.warn(`[games] Unknown game type code: "${code}". Using default config.`);
    return DEFAULT_GAME_INFO;
  }
  
  return info;
}
