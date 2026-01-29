// Central registry for all clan advantages across games
import type { GameCode, ClanId, ClanAdvantage, ClanAdvantagesConfig } from './types';
import { FORET_CLAN_ADVANTAGES } from './foretAdvantages';
import { INFECTION_CLAN_ADVANTAGES } from './infectionAdvantages';

// All clan IDs in canonical order
export const ALL_CLAN_IDS: ClanId[] = [
  'maison-royale',
  'fraternite-zoulous',
  'maison-keryndes',
  'akande',
  'cercle-aseyra',
  'sources-akila',
  'ezkar',
];

// Game configurations with their advantages
const GAME_CONFIGS: ClanAdvantagesConfig[] = [
  {
    gameCode: 'FORET',
    gameName: 'La Forêt',
    advantages: FORET_CLAN_ADVANTAGES,
  },
  {
    gameCode: 'INFECTION',
    gameName: 'Infection',
    advantages: INFECTION_CLAN_ADVANTAGES,
  },
  {
    gameCode: 'RIVIERES',
    gameName: 'Les Rivières',
    advantages: {
      'maison-royale': [],
      'fraternite-zoulous': [],
      'maison-keryndes': [],
      'akande': [],
      'cercle-aseyra': [],
      'sources-akila': [],
      'ezkar': [],
    },
  },
  {
    gameCode: 'SHERIFF',
    gameName: 'Le Shérif',
    advantages: {
      'maison-royale': [],
      'fraternite-zoulous': [],
      'maison-keryndes': [],
      'akande': [],
      'cercle-aseyra': [],
      'sources-akila': [],
      'ezkar': [],
    },
  },
  {
    gameCode: 'LION',
    gameName: 'Le Lion',
    advantages: {
      'maison-royale': [],
      'fraternite-zoulous': [],
      'maison-keryndes': [],
      'akande': [],
      'cercle-aseyra': [],
      'sources-akila': [],
      'ezkar': [],
    },
  },
];

/**
 * Get all game configurations
 */
export function getGameConfigs(): ClanAdvantagesConfig[] {
  return GAME_CONFIGS;
}

/**
 * Get advantages for a specific game
 */
export function getAdvantagesByGame(gameCode: GameCode): ClanAdvantagesConfig | undefined {
  return GAME_CONFIGS.find((config) => config.gameCode === gameCode);
}

/**
 * Get all advantages for a specific clan across all games
 */
export function getAdvantagesByClan(clanId: ClanId): { gameCode: GameCode; gameName: string; advantages: ClanAdvantage[] }[] {
  return GAME_CONFIGS
    .map((config) => ({
      gameCode: config.gameCode,
      gameName: config.gameName,
      advantages: config.advantages[clanId] || [],
    }))
    .filter((entry) => entry.advantages.length > 0);
}

/**
 * Check if a game has any clan advantages
 */
export function gameHasAdvantages(gameCode: GameCode): boolean {
  const config = getAdvantagesByGame(gameCode);
  if (!config) return false;
  return Object.values(config.advantages).some((advs) => advs.length > 0);
}

/**
 * Check if a clan has any advantages in any game
 */
export function clanHasAnyAdvantages(clanId: ClanId): boolean {
  return GAME_CONFIGS.some((config) => (config.advantages[clanId]?.length || 0) > 0);
}

// Re-export types
export type { GameCode, ClanId, ClanAdvantage, ClanAdvantagesConfig };
