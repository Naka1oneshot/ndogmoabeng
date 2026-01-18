// Theme constants for RIVIERES game
export const RIVIERES_COLORS = {
  background: '#0B1020',
  surface: '#20232A',
  accent: '#D4AF37',
  danger: '#B22222',
  success: '#1B4D3E',
  text: '#E8E8E8',
  textMuted: '#9CA3AF',
};

export const rivieresGradient = 'bg-gradient-to-br from-[#0B1020] via-[#151B2D] to-[#0B1020]';
export const rivieresCardStyle = 'bg-[#20232A] border border-[#D4AF37]/20 rounded-lg';
export const rivieresDangerStyle = 'bg-[#B22222]/20 border border-[#B22222]/50 text-[#FF6B6B]';
export const rivieresSuccessStyle = 'bg-[#1B4D3E]/20 border border-[#1B4D3E]/50 text-[#4ADE80]';
export const rivieresAccentStyle = 'bg-[#D4AF37]/20 border border-[#D4AF37]/50 text-[#D4AF37]';

// Status display helpers
export const getStatusDisplay = (status: string) => {
  switch (status) {
    case 'EN_BATEAU':
      return { label: '🚣 En bateau', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
    case 'A_TERRE':
      return { label: '🏝️ À terre', className: 'bg-green-500/20 text-green-400 border-green-500/30' };
    case 'CHAVIRE':
      return { label: '💀 Chaviré', className: 'bg-red-500/20 text-red-400 border-red-500/30' };
    default:
      return { label: status, className: 'bg-gray-500/20 text-gray-400 border-gray-500/30' };
  }
};

export const getDecisionDisplay = (decision: string) => {
  switch (decision) {
    case 'RESTE':
      return { label: 'Je reste', className: 'text-blue-400' };
    case 'DESCENDS':
      return { label: 'Je descends', className: 'text-amber-400' };
    default:
      return { label: decision, className: 'text-gray-400' };
  }
};

export const getKeryndesDisplay = (choice: string) => {
  switch (choice) {
    case 'AV1_CANOT':
      return { label: '🛶 Canot', className: 'text-purple-400' };
    case 'AV2_REDUCE':
      return { label: '🌊 Réduction', className: 'text-cyan-400' };
    case 'NONE':
    default:
      return { label: '-', className: 'text-gray-500' };
  }
};
