import { motion } from 'framer-motion';
import { SheriffRulesContextData } from './useSheriffRulesContext';
import { Shield, Coins, Target, Users, AlertTriangle } from 'lucide-react';

interface SheriffRulesMemoProps {
  context: SheriffRulesContextData;
  currentPageIndex: number;
  pages: { id: string; title: string }[];
  onNavigate: (index: number) => void;
}

export function SheriffRulesMemo({
  context,
  currentPageIndex,
  pages,
  onNavigate,
}: SheriffRulesMemoProps) {
  return (
    <div className="p-4 space-y-4">
      {/* Quick stats */}
      <div className="space-y-2">
        <h4 className="text-[#D4AF37] font-bold text-sm flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Configuration
        </h4>
        
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-[#9CA3AF]">Visa PVic:</span>
            <span className="text-[#E8E8E8]">{context.visaPvicPercent}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#9CA3AF]">Coût cagnotte:</span>
            <span className="text-[#E8E8E8]">{context.costPerPlayer}€/joueur</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#9CA3AF]">Floor cagnotte:</span>
            <span className="text-[#E8E8E8]">{context.floorPercent}%</span>
          </div>
        </div>
      </div>

      {/* Pool status */}
      <div className="space-y-2">
        <h4 className="text-[#CD853F] font-bold text-sm flex items-center gap-2">
          <Coins className="h-4 w-4" />
          Cagnotte
        </h4>
        
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-[#9CA3AF]">Initiale:</span>
            <span className="text-[#E8E8E8]">{context.poolInitial}€</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#9CA3AF]">Dépensée:</span>
            <span className="text-red-400">{context.poolSpent}€</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#9CA3AF]">Restante:</span>
            <span className="text-green-400">{context.poolRemaining}€</span>
          </div>
        </div>
      </div>

      {/* Duel rules summary */}
      <div className="space-y-2">
        <h4 className="text-[#F59E0B] font-bold text-sm flex items-center gap-2">
          <Target className="h-4 w-4" />
          Duels
        </h4>
        
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-[#9CA3AF]">Illégal trouvé:</span>
            <span className="text-green-400">+{context.gainPerIllegalFound}%/jeton</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#9CA3AF]">Fouille légal:</span>
            <span className="text-red-400">-{context.lossSearchNoIllegal}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#9CA3AF]">Passage illégal:</span>
            <span className="text-green-400">+{context.gainPerIllegalPassed}%/jeton</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#9CA3AF]">Attrapé illégal:</span>
            <span className="text-red-400">-{context.lossPerIllegalCaught}%/jeton</span>
          </div>
        </div>
      </div>

      {/* Players */}
      {!context.isDemo && context.totalPlayers > 0 && (
        <div className="space-y-2">
          <h4 className="text-[#9CA3AF] font-bold text-sm flex items-center gap-2">
            <Users className="h-4 w-4" />
            Joueurs
          </h4>
          
          <div className="text-xs">
            <span className="text-[#E8E8E8]">{context.totalPlayers} joueurs actifs</span>
            {context.totalPlayers % 2 === 1 && (
              <div className="flex items-center gap-1 mt-1 text-[#F59E0B]">
                <AlertTriangle className="h-3 w-3" />
                <span>Nombre impair → Dernier Duel</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="pt-4 border-t border-[#D4AF37]/20">
        <h4 className="text-[#9CA3AF] font-bold text-xs mb-2">Navigation rapide</h4>
        <div className="space-y-1">
          {pages.map((page, i) => (
            <button
              key={page.id}
              onClick={() => onNavigate(i)}
              className={`w-full text-left px-2 py-1 text-xs rounded transition-colors ${
                i === currentPageIndex
                  ? 'bg-[#D4AF37]/20 text-[#D4AF37]'
                  : 'text-[#9CA3AF] hover:text-white hover:bg-white/5'
              }`}
            >
              {i + 1}. {page.title}
            </button>
          ))}
        </div>
      </div>

      {/* Demo indicator */}
      {context.isDemo && (
        <div className="text-xs text-amber-400/70 text-center">
          Mode démo — Valeurs d'exemple
        </div>
      )}
    </div>
  );
}
