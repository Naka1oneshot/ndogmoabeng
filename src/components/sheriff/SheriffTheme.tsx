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

export const VISA_OPTIONS = {
  VICTORY_POINTS: {
    label: 'Points de Victoire',
    description: 'Perdre 20% de vos points de victoire actuels',
    icon: '⭐',
    cost: '20%',
  },
  COMMON_POOL: {
    label: 'Cagnotte Commune',
    description: 'Payer 10€ depuis la cagnotte commune',
    icon: '💰',
    cost: '10€',
  },
};

export const TOKEN_OPTIONS = {
  LEGAL: {
    amount: 20,
    label: '20 Jetons (Légal)',
    description: 'Entrer légalement avec le maximum autorisé',
    icon: '✓',
    risk: 'Aucun risque',
  },
  ILLEGAL: {
    amount: 30,
    label: '30 Jetons (10 Illégaux)',
    description: 'Tenter d\'entrer avec 10 jetons illégaux cachés',
    icon: '⚠️',
    risk: 'Risque de fouille',
  },
};

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
