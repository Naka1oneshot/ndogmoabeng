// Theme constants for INFECTION game type
// Dark mystical/infection aesthetic

export const INFECTION_COLORS = {
  // Backgrounds
  bgPrimary: '#0B0E14',
  bgSecondary: '#121A2B',
  bgCard: '#1A2235',
  bgHover: '#243048',
  
  // Accents
  accent: '#D4AF37', // Gold
  accentMuted: '#B8963A',
  danger: '#B00020',
  dangerMuted: '#8B0018',
  success: '#2AB3A6',
  successMuted: '#1E8A80',
  warning: '#E6A23C',
  
  // Team colors
  teamPV: '#B00020', // Porteurs de Virus - Red
  teamSY: '#2AB3A6', // Scientifiques - Teal
  teamNeutre: '#D4AF37', // Neutral roles - Gold
  teamCitoyen: '#6B7280', // Citizens - Gray
  
  // Text
  textPrimary: '#EAEAF2',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  
  // Borders
  border: '#2D3748',
  borderLight: '#4A5568',
} as const;

export const INFECTION_ROLE_LABELS: Record<string, { name: string; short: string; team: string; color: string }> = {
  BA: { name: 'Bras Armé', short: 'BA', team: 'PV', color: INFECTION_COLORS.teamPV },
  PV: { name: 'Porte Venin', short: 'PV', team: 'PV', color: INFECTION_COLORS.teamPV },
  SY: { name: 'Synthétiste', short: 'SY', team: 'SY', color: INFECTION_COLORS.teamSY },
  AE: { name: "Agent de l'État", short: 'AE', team: 'NEUTRE', color: INFECTION_COLORS.teamNeutre },
  OC: { name: 'Œil du Crépuscule', short: 'OC', team: 'NEUTRE', color: INFECTION_COLORS.teamNeutre },
  KK: { name: 'Sans Cercle', short: 'KK', team: 'CITOYEN', color: INFECTION_COLORS.teamCitoyen },
  CV: { name: 'Citoyen', short: 'CV', team: 'CITOYEN', color: INFECTION_COLORS.teamCitoyen },
};

export const INFECTION_TEAM_LABELS: Record<string, { name: string; color: string }> = {
  PV: { name: 'Porte Venins', color: INFECTION_COLORS.teamPV },
  SY: { name: 'Synthétistes', color: INFECTION_COLORS.teamSY },
  NEUTRE: { name: 'Neutres', color: INFECTION_COLORS.teamNeutre },
  CITOYEN: { name: 'Citoyens', color: INFECTION_COLORS.teamCitoyen },
};

// CSS class generator for infection theme
export function getInfectionThemeClasses() {
  return {
    container: 'bg-[#0B0E14] min-h-screen text-[#EAEAF2]',
    card: 'bg-[#121A2B] border border-[#2D3748] rounded-lg',
    cardHover: 'bg-[#121A2B] border border-[#2D3748] rounded-lg hover:bg-[#1A2235] transition-colors',
    header: 'bg-[#121A2B] border-b border-[#2D3748]',
    button: 'bg-[#D4AF37] text-[#0B0E14] hover:bg-[#B8963A] font-medium',
    buttonDanger: 'bg-[#B00020] text-white hover:bg-[#8B0018]',
    buttonSecondary: 'bg-[#1A2235] text-[#EAEAF2] border border-[#2D3748] hover:bg-[#243048]',
    input: 'bg-[#1A2235] border border-[#2D3748] text-[#EAEAF2] focus:border-[#D4AF37]',
    badge: 'bg-[#1A2235] text-[#D4AF37] border border-[#D4AF37]/30',
    badgeDanger: 'bg-[#B00020]/20 text-[#B00020] border border-[#B00020]/30',
    badgeSuccess: 'bg-[#2AB3A6]/20 text-[#2AB3A6] border border-[#2AB3A6]/30',
  };
}
