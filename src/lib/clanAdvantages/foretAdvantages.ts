// Forêt game clan advantages - extracted from actual game code
import type { ClanId, ClanAdvantage } from './types';

/**
 * Clan advantages for "La Forêt de Ndogmoabeng" game
 * 
 * Sources:
 * - Royaux bonus: ForetRulesContent.tsx (×1.5 starting tokens)
 * - Akila shop discount: shop_prices table (cost_akila vs cost_normal)
 * - Akila sniper access: is_sniper_akila flag in shop_config
 * - Akandé default weapon: item_catalog "Par défaut" Akandé configuration
 */
export const FORET_CLAN_ADVANTAGES: Record<ClanId, ClanAdvantage[]> = {
  'maison-royale': [
    {
      title: 'Jetons de départ ×1.5',
      description: 'Les Royaux commencent avec 150 jetons au lieu de 100.',
      source: 'ForetRulesContent.tsx',
    },
  ],
  'fraternite-zoulous': [],
  'maison-keryndes': [],
  'akande': [
    {
      title: 'Dégâts par défaut améliorés',
      description: 'L\'arme "Par défaut" des Akandé inflige plus de dégâts.',
      source: 'item_catalog / combat_config',
    },
  ],
  'cercle-aseyra': [],
  'sources-akila': [
    {
      title: 'Réduction boutique',
      description: 'Tous les objets coûtent environ 50% moins cher pour les Akila.',
      source: 'shop_prices table (cost_akila)',
    },
    {
      title: 'Sniper Akila exclusif',
      description: 'Seuls les Akila peuvent utiliser le Sniper Akila (réservé).',
      source: 'is_sniper_akila flag',
    },
  ],
  'ezkar': [],
};
