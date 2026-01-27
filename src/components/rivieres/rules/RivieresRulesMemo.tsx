import { Ship, Anchor, AlertTriangle, Coins, Users } from 'lucide-react';
import { RivieresRulesContextData } from './useRivieresRulesContext';

interface RivieresRulesMemoProps {
  context: RivieresRulesContextData;
  currentPageIndex: number;
  pages: { id: string; title: string }[];
  onNavigate: (index: number) => void;
}

const QUICK_TIPS: Record<number, { icon: React.ReactNode; title: string; tip: string }> = {
  0: {
    icon: <Ship className="h-4 w-4" />,
    title: 'Objectif',
    tip: 'Accumulez des jetons en restant le plus longtemps possible sur le bateau.',
  },
  1: {
    icon: <Coins className="h-4 w-4" />,
    title: 'Mise',
    tip: 'Votre mise rejoint la cagnotte. Plus de mises = plus de danger !',
  },
  2: {
    icon: <AlertTriangle className="h-4 w-4" />,
    title: 'Danger',
    tip: 'Si le danger dépasse les mises totales, le bateau chavire.',
  },
  3: {
    icon: <Users className="h-4 w-4" />,
    title: 'Simulation',
    tip: 'Testez différents scénarios sans affecter la vraie partie.',
  },
};

export function RivieresRulesMemo({
  context,
  currentPageIndex,
  pages,
  onNavigate,
}: RivieresRulesMemoProps) {
  const currentTip = QUICK_TIPS[currentPageIndex] || QUICK_TIPS[0];
  
  return (
    <div className="space-y-4 p-2">
      {/* Mini cycle */}
      <div className="bg-[#1a1f2e] rounded-lg p-3">
        <h4 className="text-[#D4AF37] text-xs font-bold mb-2 flex items-center gap-2">
          <Anchor className="h-3 w-3" />
          Cycle de jeu
        </h4>
        <div className="text-xs text-[#9CA3AF] space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 text-[10px] flex items-center justify-center">1</span>
            <span>Choisir: Rester ou Descendre</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 text-[10px] flex items-center justify-center">2</span>
            <span>Miser des jetons</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-red-500/20 text-red-400 text-[10px] flex items-center justify-center">3</span>
            <span>Confrontation au danger</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-green-500/20 text-green-400 text-[10px] flex items-center justify-center">4</span>
            <span>Distribution / Chavirement</span>
          </div>
        </div>
      </div>
      
      {/* Current page tip */}
      <div className="bg-[#D4AF37]/10 border border-[#D4AF37]/20 rounded-lg p-3">
        <div className="flex items-center gap-2 text-[#D4AF37] mb-1">
          {currentTip.icon}
          <span className="text-xs font-bold">{currentTip.title}</span>
        </div>
        <p className="text-xs text-[#E8E8E8]">{currentTip.tip}</p>
      </div>
      
      {/* Quick links */}
      <div className="bg-[#1a1f2e] rounded-lg p-3">
        <h4 className="text-[#9CA3AF] text-xs font-bold mb-2">Accès rapide</h4>
        <div className="space-y-1">
          {pages.map((page, i) => (
            <button
              key={page.id}
              onClick={() => onNavigate(i)}
              className={`w-full text-left text-xs px-2 py-1.5 rounded transition-colors ${
                i === currentPageIndex
                  ? 'bg-[#D4AF37]/20 text-[#D4AF37]'
                  : 'text-[#9CA3AF] hover:bg-white/5 hover:text-white'
              }`}
            >
              {i + 1}. {page.title}
            </button>
          ))}
        </div>
      </div>
      
      {/* Live context (if available) */}
      {!context.isDemo && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
          <h4 className="text-blue-400 text-xs font-bold mb-2">Partie en cours</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-[#9CA3AF]">Manche</span>
              <p className="text-white font-bold">{context.manche}/3</p>
            </div>
            <div>
              <span className="text-[#9CA3AF]">Niveau</span>
              <p className="text-white font-bold">{context.niveau}/5</p>
            </div>
            <div>
              <span className="text-[#9CA3AF]">Cagnotte</span>
              <p className="text-[#D4AF37] font-bold">{context.cagnotte} 🪙</p>
            </div>
            <div>
              <span className="text-[#9CA3AF]">En bateau</span>
              <p className="text-white font-bold">{context.playersEnBateau}/{context.totalPlayers}</p>
            </div>
          </div>
        </div>
      )}
      
      {context.isDemo && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
          <p className="text-amber-400 text-xs">
            💡 Les valeurs affichées sont des exemples.
          </p>
        </div>
      )}
    </div>
  );
}
