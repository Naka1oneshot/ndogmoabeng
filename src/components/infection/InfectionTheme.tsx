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

// Role configuration with victory conditions from rules document
export interface InfectionRoleConfig {
  name: string;
  short: string;
  team: string;
  color: string;
  description: string;
  startingInventory: string[];
  victoryConditions: { condition: string; pvic: number }[];
}

export const INFECTION_ROLE_LABELS: Record<string, InfectionRoleConfig> = {
  BA: { 
    name: 'Bras Armé', 
    short: 'BA', 
    team: 'SY', 
    color: INFECTION_COLORS.teamSY,
    description: '1 Balle par manche (facultatif). Peut corrompre l\'agent de l\'état.',
    startingInventory: ['1 arme sans balle', '1 balle reçue à chaque manche (max 1)'],
    victoryConditions: [
      { condition: 'PV meurent en 2 manches', pvic: 50 },
      { condition: 'PV meurent en 3 manches', pvic: 30 },
      { condition: 'PV meurent en 4 manches', pvic: 15 },
    ]
  },
  CV: { 
    name: 'Citoyen du Village', 
    short: 'CV', 
    team: 'CITOYEN', 
    color: INFECTION_COLORS.teamCitoyen,
    description: 'Peut corrompre l\'agent de l\'état. Vote pour désigner les porte-venins.',
    startingInventory: [],
    victoryConditions: [
      { condition: 'Tous les PV meurent', pvic: 20 },
      { condition: 'Mission SY réussie', pvic: 20 },
      { condition: 'Vivant à la mort des PV', pvic: 10 },
      { condition: 'Meilleurs soupçons (partage)', pvic: 10 },
    ]
  },
  KK: { 
    name: 'Le Sans Cercle', 
    short: 'KK', 
    team: 'CITOYEN', 
    color: INFECTION_COLORS.teamCitoyen,
    description: 'Peut corrompre l\'agent de l\'état. Vote pour désigner les porte-venins.',
    startingInventory: [],
    victoryConditions: [
      { condition: 'Meurt durant les 2 premières manches', pvic: 50 },
      { condition: 'Meurt durant la 3ème manche', pvic: 30 },
      { condition: 'Meurt durant la 4ème manche', pvic: 15 },
      { condition: 'Meilleurs soupçons (partage)', pvic: 10 },
    ]
  },
  OC: { 
    name: 'Œil du Crépuscule', 
    short: 'OC', 
    team: 'SY', 
    color: INFECTION_COLORS.teamSY,
    description: '1 fois par manche, découvre le rôle d\'un joueur. Peut corrompre l\'agent.',
    startingInventory: ['1 boule de cristal par manche (max 1)'],
    victoryConditions: [
      { condition: 'Tous les PV meurent', pvic: 20 },
      { condition: 'Mission SY réussie', pvic: 20 },
      { condition: 'Vivant à la mort des PV', pvic: 10 },
      { condition: 'Meilleurs soupçons (partage)', pvic: 10 },
    ]
  },
  PV: { 
    name: 'Porte Venins', 
    short: 'PV', 
    team: 'PV', 
    color: INFECTION_COLORS.teamPV,
    description: '1 Dose de venin (obligatoire manche 1). 1 Antidote. 1 Balle pour toute la partie.',
    startingInventory: ['1 dose de venin (obligatoire manche 1)', '1 antidote', '1 balle'],
    victoryConditions: [
      { condition: 'Tuent tous les autres (sauf immunisés)', pvic: 40 },
    ]
  },
  SY: { 
    name: 'Synthétistes', 
    short: 'SY', 
    team: 'SY', 
    color: INFECTION_COLORS.teamSY,
    description: 'Crée un antidote en recherchant 2-3 fois sur le joueur avec anticorps. Choix unanime requis.',
    startingInventory: [],
    victoryConditions: [
      { condition: 'Mission SY réussie', pvic: 30 },
      { condition: 'Tous les PV meurent', pvic: 20 },
      { condition: 'Vivant à la mort des PV', pvic: 10 },
      { condition: 'Meilleurs soupçons (partage)', pvic: 10 },
    ]
  },
  AE: { 
    name: 'Agent de l\'État', 
    short: 'AE', 
    team: 'NEUTRE', 
    color: INFECTION_COLORS.teamNeutre,
    description: 'Peut saboter l\'arme du BA. Corrompu par citoyens (10 jetons) ou PV (15 jetons).',
    startingInventory: [],
    victoryConditions: [
      { condition: 'Par arme sabotée', pvic: 10 },
      { condition: 'Somme corruption reçue', pvic: 0 }, // Variable
      { condition: 'Meilleurs soupçons (partage)', pvic: 10 },
    ]
  },
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
