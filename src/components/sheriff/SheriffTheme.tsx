// Sheriff de Ndogmoabeng - Theme configuration

export const SHERIFF_COLORS = {
  primary: '#D4AF37',      // Gold - Sheriff badge
  secondary: '#8B4513',    // Saddle brown - Western theme
  background: '#1A1510',   // Dark brown
  card: '#2A2215',         // Card background
  accent: '#CD853F',       // Peru - Accent
  success: '#4ADE80',      // Green for legal
  danger: '#EF4444',       // Red for illegal/penalties
  warning: '#F59E0B',      // Amber for decisions
  text: '#E8E8E8',         // Light text
  muted: '#9CA3AF',        // Muted text
};

// Bot config interface for type safety
export interface SheriffBotConfig {
  visa_pvic_percent?: number;
  cost_per_player?: number;
  duel_search_legal_penalty?: number;
  duel_illegal_found_bonus?: number;
  duel_illegal_pass_bonus?: number;
  duel_caught_illegal_penalty?: number;
}

// Default config values
export const DEFAULT_SHERIFF_CONFIG: Required<SheriffBotConfig> = {
  visa_pvic_percent: 50,
  cost_per_player: 5,
  duel_search_legal_penalty: 50,
  duel_illegal_found_bonus: 10,
  duel_illegal_pass_bonus: 10,
  duel_caught_illegal_penalty: 5,
};

// Dynamic VISA options based on config
export function getVisaOptions(config: SheriffBotConfig = {}) {
  const visaPvicPercent = config.visa_pvic_percent ?? DEFAULT_SHERIFF_CONFIG.visa_pvic_percent;
  const costPerPlayer = config.cost_per_player ?? DEFAULT_SHERIFF_CONFIG.cost_per_player;

  return {
    VICTORY_POINTS: {
      label: 'Points de Victoire',
      description: `Perdre ${visaPvicPercent}% de vos points de victoire actuels`,
      icon: '⭐',
      cost: `${visaPvicPercent}%`,
    },
    COMMON_POOL: {
      label: 'Cagnotte Commune',
      description: `Payer ${costPerPlayer}€ depuis la cagnotte commune`,
      icon: '💰',
      cost: `${costPerPlayer}€`,
    },
  };
}

// Dynamic token options - now supports range selection for illegal tokens
export function getTokenOptions(illegalTokenCount: number = 30) {
  const illegalAmount = illegalTokenCount - 20;
  
  return {
    LEGAL: {
      amount: 20,
      label: '20 Jetons (Légal)',
      description: 'Entrer légalement avec le maximum autorisé',
      icon: '✓',
      risk: 'Aucun risque',
    },
    ILLEGAL: {
      amount: illegalTokenCount,
      label: `${illegalTokenCount} Jetons (${illegalAmount} Illégaux)`,
      description: `Tenter d'entrer avec ${illegalAmount} jetons illégaux cachés`,
      icon: '⚠️',
      risk: 'Risque de fouille',
    },
  };
}

// Legacy exports for backwards compatibility - use getVisaOptions/getTokenOptions instead
export const VISA_OPTIONS = getVisaOptions();
export const TOKEN_OPTIONS = getTokenOptions();

export function getSheriffThemeClasses() {
  return {
    container: 'min-h-screen bg-gradient-to-b from-[#1A1510] to-[#0F0D08] text-[#E8E8E8]',
    card: 'bg-[#2A2215] border border-[#D4AF37]/20 rounded-lg',
    cardHover: 'hover:border-[#D4AF37]/50 transition-colors',
    header: 'bg-[#2A2215]/80 backdrop-blur border-b border-[#D4AF37]/20',
    button: 'bg-[#D4AF37] hover:bg-[#B8962E] text-[#1A1510] font-bold',
    buttonOutline: 'border-[#D4AF37]/50 text-[#D4AF37] hover:bg-[#D4AF37]/10',
    badge: 'bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/30',
    badgeLegal: 'bg-[#4ADE80]/20 text-[#4ADE80] border-[#4ADE80]/30',
    badgeIllegal: 'bg-[#EF4444]/20 text-[#EF4444] border-[#EF4444]/30',
    badgeWarning: 'bg-[#F59E0B]/20 text-[#F59E0B] border-[#F59E0B]/30',
    input: 'bg-[#1A1510] border-[#D4AF37]/30 text-[#E8E8E8] focus:border-[#D4AF37]',
  };
}

export const SHERIFF_ROLE_LABELS: Record<string, { name: string; color: string }> = {
  SHERIFF: { name: 'Shérif', color: SHERIFF_COLORS.primary },
  TRAVELER: { name: 'Voyageur', color: SHERIFF_COLORS.accent },
};

// Duel outcome descriptions
export const DUEL_OUTCOMES = {
  SEARCH_LEGAL: {
    searcher: 'Vous avez fouillé un voyageur légal. Pénalité: -10% PV',
    searched: 'Vous avez été fouillé mais vous étiez légal. Pas de pénalité.',
  },
  SEARCH_ILLEGAL: {
    searcher: 'Vous avez découvert des jetons illégaux! Bonus: +X% PV',
    searched: 'Vos jetons illégaux ont été confisqués. Pénalité: -X% PV et perte des jetons.',
  },
  NO_SEARCH_LEGAL: {
    searcher: 'Vous n\'avez pas fouillé. Pas de changement.',
    searched: 'Vous n\'avez pas été fouillé. Vos jetons sont intacts.',
  },
  NO_SEARCH_ILLEGAL: {
    searcher: 'Vous n\'avez pas fouillé un contrebandier! Occasion manquée.',
    searched: 'Vous avez passé avec des jetons illégaux! Bonus: +X% PV',
  },
};

// Helper to get duel rules text with dynamic values
export function getDuelRulesText(config: SheriffBotConfig = {}) {
  const searchLegalPenalty = config.duel_search_legal_penalty ?? DEFAULT_SHERIFF_CONFIG.duel_search_legal_penalty;
  const illegalFoundBonus = config.duel_illegal_found_bonus ?? DEFAULT_SHERIFF_CONFIG.duel_illegal_found_bonus;
  
  return {
    searchInfo: `Fouiller: Si légal → vous perdez ${searchLegalPenalty}% PV. Si illégal → vous gagnez ${illegalFoundBonus}% PV.`,
    passInfo: `Laisser passer: Pas de risque, mais l'adversaire peut passer avec de la contrebande.`,
  };
}
