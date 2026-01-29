// Infection game clan advantages - extracted from actual game code
import type { ClanId, ClanAdvantage } from './types';

/**
 * Clan advantages for "Infection à Ndogmoabeng" game
 * 
 * Sources:
 * - Ezkar bonuses: InfectionFullPageClans.tsx
 * - Other clans have no specific bonuses in Infection
 */
export const INFECTION_CLAN_ADVANTAGES: Record<ClanId, ClanAdvantage[]> = {
  'maison-royale': [],
  'fraternite-zoulous': [],
  'maison-keryndes': [],
  'akande': [],
  'cercle-aseyra': [],
  'sources-akila': [],
  'ezkar': [
    {
      title: 'Antidote Ezkar',
      description: 'Tous les joueurs Ezkar reçoivent un antidote supplémentaire au début.',
      source: 'InfectionFullPageClans.tsx',
    },
    {
      title: 'Gilet Pare-Balles',
      description: 'Tous les joueurs Ezkar reçoivent un gilet pour se protéger d\'un tir.',
      source: 'InfectionFullPageClans.tsx',
    },
    {
      title: 'PV Ezkar : 2 doses',
      description: 'Un Porte-Venin Ezkar a 2 antidotes (rôle + clan).',
      source: 'InfectionFullPageClans.tsx',
    },
  ],
};
